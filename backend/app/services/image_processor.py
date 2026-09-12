from __future__ import annotations

from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

import numpy as np
from fastapi import UploadFile
from PIL import Image, ImageEnhance, ImageOps, UnidentifiedImageError

from app.models.image import AdjustmentParameters

SUPPORTED_FORMATS = {"JPEG": ".jpg", "PNG": ".png"}
PREVIEW_MAX_SIZE = (1600, 1600)


class InvalidImageError(ValueError):
    pass


class StoredImageNotFoundError(FileNotFoundError):
    pass


class ImageProcessor:
    def __init__(self, storage_dir: Path) -> None:
        self.storage_dir = storage_dir
        self.originals_dir = storage_dir / "originals"
        self.originals_dir.mkdir(parents=True, exist_ok=True)

    async def store_upload(self, upload: UploadFile) -> tuple[str, int, int]:
        contents = await upload.read()
        if not contents:
            raise InvalidImageError("Il file caricato è vuoto")

        try:
            with Image.open(BytesIO(contents)) as image:
                image.load()
                image_format = image.format
                width, height = image.size
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise InvalidImageError("Carica un'immagine JPEG o PNG valida") from exc

        if image_format not in SUPPORTED_FORMATS:
            raise InvalidImageError("Sono supportati soltanto file JPEG e PNG")

        image_id = str(uuid4())
        destination = self.originals_dir / f"{image_id}{SUPPORTED_FORMATS[image_format]}"
        destination.write_bytes(contents)
        return image_id, width, height

    def render_preview(self, image_id: str, parameters: AdjustmentParameters) -> bytes:
        image = self._open_original(image_id)
        image.thumbnail(PREVIEW_MAX_SIZE, Image.Resampling.LANCZOS)
        return self._render(image, parameters, quality=88)

    def render_export(self, image_id: str, parameters: AdjustmentParameters) -> bytes:
        image = self._open_original(image_id)
        return self._render(image, parameters, quality=95)

    def _open_original(self, image_id: str) -> Image.Image:
        try:
            UUID(image_id)
        except ValueError as exc:
            raise StoredImageNotFoundError(image_id) from exc

        matches = list(self.originals_dir.glob(f"{image_id}.*"))
        if len(matches) != 1:
            raise StoredImageNotFoundError(image_id)

        with Image.open(matches[0]) as original:
            oriented = ImageOps.exif_transpose(original)
            return oriented.convert("RGB").copy()

    def _render(
        self, image: Image.Image, parameters: AdjustmentParameters, quality: int
    ) -> bytes:
        # Every operation starts from an in-memory copy of the untouched upload.
        result = image.copy()
        result = ImageEnhance.Brightness(result).enhance(2.0**parameters.exposure)
        result = ImageEnhance.Contrast(result).enhance(1.0 + parameters.contrast / 100.0)
        result = ImageEnhance.Color(result).enhance(1.0 + parameters.saturation / 100.0)
        result = self._apply_temperature(result, parameters.temperature)

        output = BytesIO()
        result.save(output, format="JPEG", quality=quality, optimize=True)
        return output.getvalue()

    @staticmethod
    def _apply_temperature(image: Image.Image, temperature: float) -> Image.Image:
        if temperature == 0:
            return image

        pixels = np.asarray(image, dtype=np.float32).copy()
        strength = temperature / 100.0
        pixels[..., 0] *= 1.0 + 0.18 * strength
        pixels[..., 2] *= 1.0 - 0.18 * strength
        pixels[..., 1] *= 1.0 + 0.03 * strength
        return Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8))
