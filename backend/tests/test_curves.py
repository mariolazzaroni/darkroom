from io import BytesIO

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import create_app
from app.models.image import AdjustmentParameters, CurveSet, identity_curve
from app.services.processing.curves import apply_curves, build_curve_lut


def test_identity_curve_is_linear_and_does_not_change_image() -> None:
    lut = build_curve_lut(identity_curve())
    assert np.max(np.abs(lut - np.linspace(0.0, 1.0, len(lut)))) < 1e-6

    image = Image.fromarray(
        np.random.default_rng(7).integers(0, 256, (32, 32, 3), dtype=np.uint8)
    )
    rendered = apply_curves(image, CurveSet())
    np.testing.assert_array_equal(np.asarray(rendered), np.asarray(image))


def test_s_curve_is_smooth_monotonic_and_shape_preserving() -> None:
    lut = build_curve_lut([(0, 0), (64, 45), (128, 128), (192, 215), (255, 255)])
    assert np.all(np.diff(lut) >= 0)
    assert lut[1024] < 64 / 255
    assert lut[3072] > 192 / 255
    assert 0 <= lut.min() <= lut.max() <= 1


def test_raised_black_and_lowered_white_points() -> None:
    black_lut = build_curve_lut([(0, 20), (255, 255)])
    white_lut = build_curve_lut([(0, 0), (255, 235)])
    assert black_lut[0] == pytest.approx(20 / 255, abs=1e-6)
    assert white_lut[-1] == pytest.approx(235 / 255, abs=1e-6)


@pytest.mark.parametrize(("channel", "index"), [("red", 0), ("green", 1), ("blue", 2)])
def test_individual_channel_curve_only_targets_that_channel(
    channel: str, index: int
) -> None:
    source = np.full((8, 8, 3), 96, dtype=np.uint8)
    curve = [(0, 0), (96, 170), (255, 255)]
    rendered = np.asarray(
        apply_curves(Image.fromarray(source), CurveSet(**{channel: curve}))
    )
    assert rendered[..., index].mean() > 150
    other_channels = [candidate for candidate in range(3) if candidate != index]
    for other in other_channels:
        assert abs(float(rendered[..., other].mean()) - 96) <= 1


def test_rgb_curve_targets_all_channels() -> None:
    source = np.full((8, 8, 3), (50, 100, 150), dtype=np.uint8)
    curve = [(0, 18), (128, 150), (255, 240)]
    rendered = np.asarray(apply_curves(Image.fromarray(source), CurveSet(rgb=curve)))
    assert np.all(rendered.mean(axis=(0, 1)) > source.mean(axis=(0, 1)))


def test_rgb_and_channel_curves_are_applied_in_sequence() -> None:
    image = Image.new("RGB", (12, 12), (80, 100, 120))
    rgb_curve = [(0, 10), (128, 145), (255, 250)]
    red_curve = [(0, 0), (128, 190), (255, 255)]
    rgb_only = np.asarray(apply_curves(image, CurveSet(rgb=rgb_curve)))
    combined = np.asarray(
        apply_curves(image, CurveSet(rgb=rgb_curve, red=red_curve))
    )
    assert combined[..., 0].mean() > rgb_only[..., 0].mean()
    np.testing.assert_allclose(combined[..., 1:], rgb_only[..., 1:], atol=1)


def test_curve_defaults_reset_one_and_all_channels() -> None:
    edited = CurveSet(
        rgb=[(0, 15), (255, 245)],
        red=[(0, 0), (128, 150), (255, 255)],
        green=[(0, 8), (255, 255)],
        blue=[(0, 0), (255, 235)],
    )
    edited.red = identity_curve()
    assert edited.red == identity_curve()
    assert edited.rgb != identity_curve()

    reset_all = CurveSet()
    assert all(
        getattr(reset_all, channel) == identity_curve()
        for channel in ("rgb", "red", "green", "blue")
    )


def test_invalid_curve_points_are_rejected() -> None:
    with pytest.raises(ValueError):
        CurveSet(rgb=[(0, 0), (128, 140), (128, 150), (255, 255)])
    with pytest.raises(ValueError):
        CurveSet(rgb=[(1, 0), (255, 255)])


def test_export_applies_curves_at_full_resolution(tmp_path) -> None:
    client = TestClient(create_app(tmp_path))
    source = Image.new("RGB", (120, 80), (90, 110, 130))
    buffer = BytesIO()
    source.save(buffer, format="JPEG", quality=95)
    upload = client.post(
        "/api/images",
        files={"file": ("curve-test.jpg", buffer.getvalue(), "image/jpeg")},
    )
    image_id = upload.json()["image_id"]
    curves = {
        "rgb": [[0, 12], [128, 155], [255, 245]],
        "red": [[0, 0], [128, 185], [255, 255]],
        "green": [[0, 0], [255, 255]],
        "blue": [[0, 0], [255, 240]],
    }

    exported = client.post(
        f"/api/images/{image_id}/export",
        json={"curves": curves, "quality": 95},
    )

    assert exported.status_code == 200
    with Image.open(BytesIO(exported.content)) as rendered:
        rendered.load()
        assert rendered.size == (120, 80)
        assert rendered.mode == "RGB"
        assert not np.allclose(np.asarray(rendered).mean(axis=(0, 1)), (90, 110, 130), atol=3)


def test_adjustment_payload_serializes_independent_curves() -> None:
    parameters = AdjustmentParameters(
        curves={"rgb": [[0, 20], [255, 255]], "red": [[0, 0], [255, 240]]}
    )
    payload = parameters.model_dump(mode="json")
    assert payload["curves"]["rgb"] == [[0, 20], [255, 255]]
    assert payload["curves"]["green"] == [[0, 0], [255, 255]]
