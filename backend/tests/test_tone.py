import numpy as np
from PIL import Image

from app.models.image import AdjustmentParameters
from app.services.processing.tone import apply_tone, apply_tonal_regions


def grayscale_ramp(width: int = 256) -> Image.Image:
    values = np.linspace(0, 255, width, dtype=np.uint8)
    pixels = np.repeat(values[None, :, None], 3, axis=2)
    return Image.fromarray(pixels)


def render_ramp(parameter: str, value: float) -> np.ndarray:
    rendered = apply_tone(
        grayscale_ramp(), AdjustmentParameters(**{parameter: value})
    )
    return np.asarray(rendered, dtype=np.float32)[0, :, 0]


def test_zero_values_do_not_modify_the_image() -> None:
    source = np.random.default_rng(42).integers(0, 256, (40, 60, 3), dtype=np.uint8)
    rendered = apply_tone(Image.fromarray(source), AdjustmentParameters())
    np.testing.assert_array_equal(np.asarray(rendered), source)


def test_highlights_target_bright_regions_more_than_dark_regions() -> None:
    original = np.arange(256, dtype=np.float32)
    for value in (-100, 100):
        difference = np.abs(render_ramp("highlights", value) - original)
        assert difference[180:245].mean() > difference[20:90].mean() * 8


def test_shadows_target_dark_regions_more_than_bright_regions() -> None:
    original = np.arange(256, dtype=np.float32)
    for value in (-100, 100):
        difference = np.abs(render_ramp("shadows", value) - original)
        assert difference[25:110].mean() > difference[180:245].mean() * 8


def test_whites_are_more_concentrated_near_white_than_highlights() -> None:
    original = np.arange(256, dtype=np.float32)
    highlights = np.abs(render_ramp("highlights", -100) - original)
    whites = np.abs(render_ramp("whites", -100) - original)
    highlight_focus = highlights[225:250].mean() / max(
        highlights[150:200].mean(), 1e-6
    )
    white_focus = whites[225:250].mean() / max(whites[150:200].mean(), 1e-6)
    assert white_focus > highlight_focus * 2


def test_blacks_are_more_concentrated_near_black_than_shadows() -> None:
    original = np.arange(256, dtype=np.float32)
    shadows = np.abs(render_ramp("shadows", 100) - original)
    blacks = np.abs(render_ramp("blacks", 100) - original)
    shadow_focus = shadows[5:35].mean() / max(
        shadows[55:110].mean(), 1e-6
    )
    black_focus = blacks[5:35].mean() / max(blacks[55:110].mean(), 1e-6)
    assert black_focus > shadow_focus * 2


def test_float_pipeline_stays_in_range_and_has_no_tonal_discontinuities() -> None:
    values = np.linspace(0.0, 1.0, 4096, dtype=np.float32)
    ramp = np.repeat(values[None, :, None], 3, axis=2)
    for parameter, value in (
        ("highlights", -100),
        ("shadows", 100),
        ("whites", -100),
        ("blacks", 100),
    ):
        rendered = apply_tonal_regions(ramp, **{parameter: value})[0, :, 0]
        assert rendered.min() >= 0.0
        assert rendered.max() <= 1.0
        assert np.max(np.abs(np.diff(rendered))) < 0.002
        assert np.all(np.diff(rendered) >= -1e-6)


def test_small_values_are_delicate_compared_with_extremes() -> None:
    original = np.arange(256, dtype=np.float32)
    for parameter, direction in (
        ("highlights", -1),
        ("shadows", 1),
        ("whites", -1),
        ("blacks", 1),
    ):
        subtle = np.abs(render_ramp(parameter, direction * 20) - original).mean()
        extreme = np.abs(render_ramp(parameter, direction * 100) - original).mean()
        assert subtle < extreme * 0.35


def test_combined_extreme_controls_keep_the_tonal_order() -> None:
    values = np.linspace(0.0, 1.0, 4096, dtype=np.float32)
    ramp = np.repeat(values[None, :, None], 3, axis=2)
    rendered = apply_tonal_regions(
        ramp, highlights=-100, shadows=100, whites=-100, blacks=100
    )[0, :, 0]
    assert np.all(np.diff(rendered) >= -1e-6)


def test_shadow_recovery_preserves_chromaticity_without_channel_clipping() -> None:
    pixel = np.array([[[0.08, 0.16, 0.24]]], dtype=np.float32)
    rendered = apply_tonal_regions(pixel, shadows=80)
    np.testing.assert_allclose(
        rendered[0, 0] / rendered[0, 0].sum(),
        pixel[0, 0] / pixel[0, 0].sum(),
        atol=1e-5,
    )
