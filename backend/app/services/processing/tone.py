import numpy as np
from PIL import Image, ImageEnhance

from app.models.image import AdjustmentParameters

LUMINANCE_WEIGHTS = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


def apply_tone(image: Image.Image, parameters: AdjustmentParameters) -> Image.Image:
    if all(
        value == 0
        for value in (
            parameters.exposure,
            parameters.contrast,
            parameters.highlights,
            parameters.shadows,
            parameters.whites,
            parameters.blacks,
        )
    ):
        return image

    pixels = np.asarray(image, dtype=np.float32) / 255.0
    pixels *= 2.0**parameters.exposure
    pixels = np.clip(pixels, 0.0, 1.0)

    pixels = apply_tonal_regions(
        pixels,
        highlights=parameters.highlights,
        shadows=parameters.shadows,
        whites=parameters.whites,
        blacks=parameters.blacks,
    )

    result = Image.fromarray(
        np.rint(np.clip(pixels, 0.0, 1.0) * 255.0).astype(np.uint8)
    )
    if parameters.contrast == 0:
        return result
    return ImageEnhance.Contrast(result).enhance(
        max(0.0, 1.0 + parameters.contrast / 100.0)
    )


def apply_tonal_regions(
    pixels: np.ndarray,
    *,
    highlights: float = 0.0,
    shadows: float = 0.0,
    whites: float = 0.0,
    blacks: float = 0.0,
) -> np.ndarray:
    """Remap luminance with smooth, overlapping masks while retaining hue."""
    if highlights == shadows == whites == blacks == 0:
        return pixels

    luminance = np.sum(pixels * LUMINANCE_WEIGHTS, axis=2, keepdims=True)
    # Each mapping is monotonic by construction. Applying them in sequence keeps
    # combinations monotonic too, rather than allowing summed masks to fold tones.
    target_luminance = luminance
    for region, value in (
        ("highlights", highlights),
        ("shadows", shadows),
        ("whites", whites),
        ("blacks", blacks),
    ):
        target_luminance = np.clip(
            target_luminance + _region_delta(target_luminance, value, region),
            0.0,
            1.0,
        )
    return _replace_luminance(pixels, luminance, target_luminance)


def _region_delta(luminance: np.ndarray, value: float, region: str) -> np.ndarray:
    if value == 0:
        return np.zeros_like(luminance)

    normalized = abs(value) / 100.0
    # A slightly eased response keeps ±20 delicate without weakening the extremes.
    amount = 0.65 * normalized + 0.35 * normalized**2
    positive = value > 0

    if region == "highlights":
        pivot = 0.32
        position = np.clip((luminance - pivot) / (1.0 - pivot), 0.0, 1.0)
        # A broad upper-tone bell, anchored at both the mids and absolute white.
        mask = position**2 * (1.0 - position)
        gain = 0.90 if positive else -2.20
        return amount * gain * (1.0 - pivot) * mask
    elif region == "shadows":
        pivot = 0.68
        position = np.clip(luminance / pivot, 0.0, 1.0)
        # Mirrored highlight bell: black and upper mids remain anchored.
        mask = position * (1.0 - position) ** 2
        gain = 2.20 if positive else -0.90
        return amount * gain * pivot * mask
    elif region == "whites":
        mask = _smoothstep(0.70, 0.97, luminance)
        if positive:
            return amount * 0.72 * mask * (1.0 - luminance)
        # Unlike Highlights, this deliberately lowers the white endpoint.
        return -amount * 0.18 * mask
    elif region == "blacks":
        mask = 1.0 - _smoothstep(0.0, 0.30, luminance)
        if positive:
            # Unlike Shadows, this deliberately lifts the black endpoint.
            return amount * 0.18 * mask
        return -amount * 0.72 * mask * luminance
    raise ValueError(f"Regione tonale sconosciuta: {region}")


def _smoothstep(edge_start: float, edge_end: float, value: np.ndarray) -> np.ndarray:
    position = np.clip((value - edge_start) / (edge_end - edge_start), 0.0, 1.0)
    return position * position * (3.0 - 2.0 * position)


def _replace_luminance(
    pixels: np.ndarray, luminance: np.ndarray, target_luminance: np.ndarray
) -> np.ndarray:
    """Preserve hue and saturation, compressing chroma only at gamut limits."""
    ratio = np.divide(
        target_luminance,
        luminance,
        out=np.ones_like(target_luminance),
        where=luminance > 1e-6,
    )
    scaled_chroma = (pixels - luminance) * ratio

    with np.errstate(divide="ignore", invalid="ignore"):
        upper_limit = np.where(
            scaled_chroma > 0,
            (1.0 - target_luminance) / scaled_chroma,
            np.inf,
        )
        lower_limit = np.where(
            scaled_chroma < 0,
            -target_luminance / scaled_chroma,
            np.inf,
        )
    chroma_scale = np.minimum(
        1.0,
        np.min(np.minimum(upper_limit, lower_limit), axis=2, keepdims=True),
    )
    result = target_luminance + scaled_chroma * chroma_scale
    return np.clip(result, 0.0, 1.0).astype(np.float32, copy=False)
