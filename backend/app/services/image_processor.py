from __future__ import annotations

from collections import OrderedDict
from io import BytesIO
import logging
from pathlib import Path
from threading import Lock
from uuid import UUID, uuid4

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.models.image import AdjustmentParameters
from app.services.processing import apply_pipeline

SUPPORTED_FORMATS = {"JPEG": ".jpg", "MPO": ".jpg", "PNG": ".png"}
PREVIEW_MAX_SIZE = (1600, 1600)
PREVIEW_CACHE_SIZE = 24
logger = logging.getLogger("uvicorn.error")


class InvalidImageError(ValueError):
    pass


class StoredImageNotFoundError(FileNotFoundError):
    pass


class ImageProcessor:
    def __init__(self, storage_dir: Path) -> None:
        self.storage_dir = storage_dir
        self.originals_dir = storage_dir / "originals"
        self.originals_dir.mkdir(parents=True, exist_ok=True)
        self._preview_cache: OrderedDict[tuple, bytes] = OrderedDict()
        self._cache_lock = Lock()

    async def store_upload(self, upload: UploadFile) -> tuple[str, int, int]:
        filename = upload.filename or "<senza nome>"
        mime_type = upload.content_type or "<assente>"
        extension = Path(filename).suffix.lower() or "<assente>"
        logger.info(
            "Upload immagine: filename=%r mime=%r extension=%r",
            filename,
            mime_type,
            extension,
        )

        contents = await upload.read()
        if not contents:
            raise InvalidImageError(
                f"Il file '{filename}' è vuoto (MIME ricevuto: {mime_type})"
            )

        try:
            with Image.open(BytesIO(contents)) as image:
                image_format = image.format
                if image_format == "MPO":
                    image.seek(0)
                image.load()
                image_mode = image.mode
                raw_size = image.size
                oriented = ImageOps.exif_transpose(image)
                width, height = oriented.size
                compatible_rgb = oriented.convert("RGB")
                compatible_rgb.load()
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            logger.warning(
                "Decodifica immagine fallita: filename=%r mime=%r extension=%r errore=%s: %s",
                filename,
                mime_type,
                extension,
                type(exc).__name__,
                exc,
            )
            raise InvalidImageError(
                f"Impossibile decodificare '{filename}' con Pillow "
                f"(MIME: {mime_type}, estensione: {extension}, "
                f"errore: {type(exc).__name__}: {exc})"
            ) from exc

        logger.info(
            "Immagine decodificata: filename=%r mime=%r extension=%r "
            "format=%r mode=%r dimensions=%sx%s oriented_dimensions=%sx%s",
            filename,
            mime_type,
            extension,
            image_format,
            image_mode,
            raw_size[0],
            raw_size[1],
            width,
            height,
        )

        if image_format not in SUPPORTED_FORMATS:
            raise InvalidImageError(
                f"Il contenuto di '{filename}' è stato decodificato come {image_format or 'sconosciuto'}; "
                "Darkroom supporta soltanto JPEG (incluso MPO) e PNG"
            )

        image_id = str(uuid4())
        destination = self.originals_dir / f"{image_id}{SUPPORTED_FORMATS[image_format]}"
        destination.write_bytes(contents)
        return image_id, width, height

    def render_preview(self, image_id: str, parameters: AdjustmentParameters) -> bytes:
        cache_key = (image_id, parameters.model_dump_json())
        with self._cache_lock:
            cached = self._preview_cache.get(cache_key)
            if cached is not None:
                self._preview_cache.move_to_end(cache_key)
                return cached

        image = self._open_original(image_id)
        image.thumbnail(PREVIEW_MAX_SIZE, Image.Resampling.LANCZOS)
        rendered = self._render(image, parameters, quality=88)
        with self._cache_lock:
            self._preview_cache[cache_key] = rendered
            self._preview_cache.move_to_end(cache_key)
            while len(self._preview_cache) > PREVIEW_CACHE_SIZE:
                self._preview_cache.popitem(last=False)
        return rendered

    def render_original_preview(self, image_id: str) -> bytes:
        return self.render_preview(image_id, AdjustmentParameters())

    def render_export(
        self, image_id: str, parameters: AdjustmentParameters, quality: int = 95
    ) -> bytes:
        image = self._open_original(image_id)
        return self._render(image, parameters, quality=quality)

    def _open_original(self, image_id: str) -> Image.Image:
        try:
            UUID(image_id)
        except ValueError as exc:
            raise StoredImageNotFoundError(image_id) from exc

        matches = list(self.originals_dir.glob(f"{image_id}.*"))
        if len(matches) != 1:
            raise StoredImageNotFoundError(image_id)

        with Image.open(matches[0]) as original:
            if original.format == "MPO":
                original.seek(0)
            original.load()
            oriented = ImageOps.exif_transpose(original)
            return oriented.convert("RGB").copy()

    def _render(
        self, image: Image.Image, parameters: AdjustmentParameters, quality: int
    ) -> bytes:
        # Every operation starts from an in-memory copy of the untouched upload.
        result = apply_pipeline(image.copy(), parameters)

        output = BytesIO()
        result.save(
            output,
            format="JPEG",
            quality=quality,
            optimize=True,
            subsampling=0 if quality >= 95 else 2,
        )
        return output.getvalue()
