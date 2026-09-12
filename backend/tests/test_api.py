from io import BytesIO
import logging

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageCms

from app.main import create_app


def make_image(image_format: str = "JPEG", size: tuple[int, int] = (32, 24)) -> bytes:
    buffer = BytesIO()
    width, height = size
    y, x = np.mgrid[0:height, 0:width]
    pixels = np.stack(
        (
            (x * 255 // max(width - 1, 1)),
            (y * 255 // max(height - 1, 1)),
            ((x + y) * 255 // max(width + height - 2, 1)),
        ),
        axis=2,
    ).astype(np.uint8)
    pixels[::4, ::4] = (255, 255, 255)
    Image.fromarray(pixels).save(buffer, format=image_format)
    return buffer.getvalue()


def upload_image(client: TestClient, size: tuple[int, int] = (64, 48)) -> tuple[str, bytes]:
    original = make_image(size=size)
    response = client.post(
        "/api/images", files={"file": ("photo.jpg", original, "image/jpeg")}
    )
    assert response.status_code == 201
    return response.json()["image_id"], original


def make_apple_exif_jpeg() -> bytes:
    buffer = BytesIO()
    image = Image.new("RGB", (1024, 768), (92, 126, 170))
    exif = Image.Exif()
    exif[271] = "Apple"
    exif[272] = "iPhone 16"
    exif[274] = 6
    color_profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    image.save(
        buffer,
        format="JPEG",
        quality=92,
        exif=exif,
        icc_profile=color_profile,
    )
    return buffer.getvalue()


def make_apple_exif_mpo() -> bytes:
    buffer = BytesIO()
    primary = Image.new("RGB", (96, 64), (205, 45, 30))
    secondary = Image.new("RGB", (96, 64), (25, 55, 210))
    exif = Image.Exif()
    exif[271] = "Apple"
    exif[272] = "iPhone 16"
    exif[274] = 6
    color_profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    primary.save(
        buffer,
        format="MPO",
        save_all=True,
        append_images=[secondary],
        quality=92,
        exif=exif,
        icc_profile=color_profile,
    )
    return buffer.getvalue()


def test_health(tmp_path) -> None:
    client = TestClient(create_app(tmp_path))
    assert client.get("/api/health").json() == {"status": "ok"}


def test_upload_preview_and_export_do_not_change_original(tmp_path) -> None:
    client = TestClient(create_app(tmp_path))
    image_id, original = upload_image(client)
    stored_file = next((tmp_path / "originals").iterdir())
    assert stored_file.read_bytes() == original

    parameters = {
        "exposure": 0.5,
        "contrast": 15,
        "highlights": -20,
        "shadows": 30,
        "whites": 10,
        "blacks": -10,
        "temperature": 20,
        "tint": 8,
        "vibrance": 25,
        "saturation": -10,
        "vignette": -15,
        "grain": 12,
        "sharpening": 20,
    }
    preview = client.post(f"/api/images/{image_id}/preview", json=parameters)
    exported = client.post(
        f"/api/images/{image_id}/export", json={**parameters, "quality": 90}
    )

    assert preview.status_code == 200
    assert preview.headers["content-type"] == "image/jpeg"
    assert exported.status_code == 200
    assert exported.headers["content-disposition"].startswith("attachment")
    assert stored_file.read_bytes() == original


def test_png_upload_preview_and_curve_export(tmp_path) -> None:
    client = TestClient(create_app(tmp_path))
    original = make_image("PNG", size=(70, 45))
    upload = client.post(
        "/api/images", files={"file": ("photo.PNG", original, "image/png")}
    )
    assert upload.status_code == 201
    image_id = upload.json()["image_id"]
    curve = {
        "rgb": [[0, 12], [128, 150], [255, 245]],
        "red": [[0, 0], [255, 255]],
        "green": [[0, 0], [255, 255]],
        "blue": [[0, 0], [255, 235]],
    }

    preview = client.post(
        f"/api/images/{image_id}/preview", json={"curves": curve}
    )
    exported = client.post(
        f"/api/images/{image_id}/export", json={"curves": curve, "quality": 95}
    )

    assert preview.status_code == 200
    assert exported.status_code == 200
    with Image.open(BytesIO(exported.content)) as rendered:
        rendered.load()
        assert rendered.format == "JPEG"
        assert rendered.mode == "RGB"
        assert rendered.size == (70, 45)

@pytest.mark.parametrize(
    ("parameter", "value"),
    [
        ("exposure", 1.0),
        ("contrast", 40),
        ("highlights", -60),
        ("shadows", 60),
        ("whites", 60),
        ("blacks", -60),
        ("temperature", 60),
        ("tint", 60),
        ("vibrance", 60),
        ("saturation", 60),
        ("vignette", -60),
        ("grain", 60),
        ("sharpening", 80),
    ],
)
def test_each_adjustment_changes_preview(tmp_path, parameter: str, value: float) -> None:
    client = TestClient(create_app(tmp_path))
    image_id, _ = upload_image(client)
    baseline = client.post(f"/api/images/{image_id}/preview", json={})
    adjusted = client.post(
        f"/api/images/{image_id}/preview", json={parameter: value}
    )
    assert baseline.status_code == 200
    assert adjusted.status_code == 200
    assert adjusted.content != baseline.content


def test_original_preview_and_full_resolution_export(tmp_path) -> None:
    client = TestClient(create_app(tmp_path))
    image_id, _ = upload_image(client, size=(96, 72))

    original_preview = client.get(f"/api/images/{image_id}/original-preview")
    export = client.post(
        f"/api/images/{image_id}/export",
        json={"exposure": 0.4, "quality": 100},
    )

    assert original_preview.status_code == 200
    assert export.status_code == 200
    assert export.headers["content-disposition"].startswith("attachment")
    with Image.open(BytesIO(export.content)) as exported_image:
        assert exported_image.size == (96, 72)


def test_rejects_invalid_adjustment_and_export_quality(tmp_path) -> None:
    client = TestClient(create_app(tmp_path))
    image_id, _ = upload_image(client)
    invalid_adjustment = client.post(
        f"/api/images/{image_id}/preview", json={"exposure": 6}
    )
    invalid_quality = client.post(
        f"/api/images/{image_id}/export", json={"quality": 85}
    )
    assert invalid_adjustment.status_code == 422
    assert invalid_quality.status_code == 422


def test_rejects_unsupported_file(tmp_path) -> None:
    client = TestClient(create_app(tmp_path))
    response = client.post(
        "/api/images", files={"file": ("notes.txt", b"not an image", "text/plain")}
    )
    assert response.status_code == 415
    assert "notes.txt" in response.json()["detail"]
    assert "text/plain" in response.json()["detail"]


@pytest.mark.parametrize(
    ("filename", "mime_type"),
    [
        ("IMG_0001.JPG", "application/octet-stream"),
        ("IMG_0002.JpEg", ""),
        ("camera-upload.bin", "image/x-unexpected"),
    ],
)
def test_accepts_standard_jpeg_with_apple_exif_regardless_of_browser_mime(
    tmp_path, caplog, filename: str, mime_type: str
) -> None:
    caplog.set_level(logging.INFO, logger="uvicorn.error")
    client = TestClient(create_app(tmp_path))
    original = make_apple_exif_jpeg()

    upload = client.post(
        "/api/images", files={"file": (filename, original, mime_type)}
    )

    assert upload.status_code == 201
    assert upload.json()["width"] == 768
    assert upload.json()["height"] == 1024
    image_id = upload.json()["image_id"]
    stored_file = next((tmp_path / "originals").iterdir())
    assert stored_file.read_bytes() == original

    preview = client.post(f"/api/images/{image_id}/preview", json={})
    assert preview.status_code == 200
    with Image.open(BytesIO(preview.content)) as rendered:
        rendered.load()
        assert rendered.format == "JPEG"
        assert rendered.mode == "RGB"
        assert rendered.size == (768, 1024)

    log_output = caplog.text
    assert filename in log_output
    assert (mime_type or "<assente>") in log_output
    assert "format='JPEG'" in log_output
    assert "mode='RGB'" in log_output
    assert "dimensions=1024x768" in log_output
    assert "oriented_dimensions=768x1024" in log_output


def test_accepts_mpo_as_jpeg_and_uses_first_frame(tmp_path, caplog) -> None:
    caplog.set_level(logging.INFO, logger="uvicorn.error")
    client = TestClient(create_app(tmp_path))
    original = make_apple_exif_mpo()
    with Image.open(BytesIO(original)) as source:
        assert source.format == "MPO"
        assert source.n_frames == 2

    upload = client.post(
        "/api/images",
        files={"file": ("IPHONE_MULTI.JPEG", original, "image/jpeg")},
    )

    assert upload.status_code == 201
    assert upload.json()["width"] == 64
    assert upload.json()["height"] == 96
    image_id = upload.json()["image_id"]
    stored_file = next((tmp_path / "originals").iterdir())
    assert stored_file.read_bytes() == original

    baseline = client.post(f"/api/images/{image_id}/preview", json={})
    adjusted = client.post(
        f"/api/images/{image_id}/preview",
        json={
            "exposure": 0.4,
            "temperature": 15,
            "contrast": 10,
            "curves": {"rgb": [[0, 10], [128, 150], [255, 245]]},
        },
    )
    exported = client.post(
        f"/api/images/{image_id}/export",
        json={
            "exposure": 0.4,
            "temperature": 15,
            "contrast": 10,
            "curves": {
                "rgb": [[0, 10], [128, 150], [255, 245]],
                "red": [[0, 0], [128, 175], [255, 255]],
            },
            "quality": 95,
        },
    )

    assert baseline.status_code == 200
    assert adjusted.status_code == 200
    assert adjusted.content != baseline.content
    assert exported.status_code == 200
    with Image.open(BytesIO(exported.content)) as rendered:
        rendered.load()
        assert rendered.format == "JPEG"
        assert rendered.mode == "RGB"
        assert rendered.size == (64, 96)
        red, _green, blue = np.asarray(rendered).mean(axis=(0, 1))
        assert red > blue

    assert "format='MPO'" in caplog.text
