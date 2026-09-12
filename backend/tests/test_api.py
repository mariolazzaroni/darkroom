from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from app.main import create_app


def make_image(image_format: str = "JPEG", size: tuple[int, int] = (32, 24)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, (120, 80, 40)).save(buffer, format=image_format)
    return buffer.getvalue()


def test_health(tmp_path) -> None:
    client = TestClient(create_app(tmp_path))
    assert client.get("/api/health").json() == {"status": "ok"}


def test_upload_preview_and_export_do_not_change_original(tmp_path) -> None:
    client = TestClient(create_app(tmp_path))
    original = make_image()

    upload = client.post(
        "/api/images", files={"file": ("photo.jpg", original, "image/jpeg")}
    )
    assert upload.status_code == 201
    image_id = upload.json()["image_id"]
    stored_file = next((tmp_path / "originals").iterdir())
    assert stored_file.read_bytes() == original

    parameters = {
        "exposure": 0.5,
        "contrast": 15,
        "saturation": -10,
        "temperature": 20,
    }
    preview = client.post(f"/api/images/{image_id}/preview", json=parameters)
    exported = client.post(f"/api/images/{image_id}/export", json=parameters)

    assert preview.status_code == 200
    assert preview.headers["content-type"] == "image/jpeg"
    assert exported.status_code == 200
    assert exported.headers["content-disposition"].startswith("attachment")
    assert stored_file.read_bytes() == original


def test_rejects_unsupported_file(tmp_path) -> None:
    client = TestClient(create_app(tmp_path))
    response = client.post(
        "/api/images", files={"file": ("notes.txt", b"not an image", "text/plain")}
    )
    assert response.status_code == 415

