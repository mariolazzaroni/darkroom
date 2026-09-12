from io import BytesIO

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from app.models.image import AdjustmentParameters, UploadResponse
from app.services.image_processor import InvalidImageError, StoredImageNotFoundError

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/images", response_model=UploadResponse, status_code=201)
async def upload_image(request: Request, file: UploadFile = File(...)) -> UploadResponse:
    try:
        image_id, width, height = await request.app.state.image_processor.store_upload(file)
    except InvalidImageError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc

    return UploadResponse(image_id=image_id, filename=file.filename or "immagine", width=width, height=height)


@router.post("/images/{image_id}/preview")
def create_preview(
    image_id: str, parameters: AdjustmentParameters, request: Request
) -> StreamingResponse:
    try:
        image_bytes = request.app.state.image_processor.render_preview(image_id, parameters)
    except StoredImageNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Immagine non trovata") from exc

    return _jpeg_response(image_bytes, "preview.jpg", inline=True)


@router.post("/images/{image_id}/export")
def export_image(
    image_id: str, parameters: AdjustmentParameters, request: Request
) -> StreamingResponse:
    try:
        image_bytes = request.app.state.image_processor.render_export(image_id, parameters)
    except StoredImageNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Immagine non trovata") from exc

    return _jpeg_response(image_bytes, "darkroom-export.jpg", inline=False)


def _jpeg_response(image_bytes: bytes, filename: str, inline: bool) -> StreamingResponse:
    disposition = "inline" if inline else "attachment"
    return StreamingResponse(
        BytesIO(image_bytes),
        media_type="image/jpeg",
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
    )

