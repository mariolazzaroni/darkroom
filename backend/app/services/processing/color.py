import numpy as np
from PIL import Image, ImageEnhance


def apply_temperature_and_tint(
    image: Image.Image, temperature: float, tint: float
) -> Image.Image:
    if temperature == 0 and tint == 0:
        return image

    pixels = np.asarray(image, dtype=np.float32) / 255.0
    result = pixels.copy()
    warmth = temperature / 100.0
    tint_strength = tint / 100.0

    result[..., 0] *= 1.0 + 0.20 * warmth + 0.05 * tint_strength
    result[..., 1] *= 1.0 - 0.12 * tint_strength
    result[..., 2] *= 1.0 - 0.20 * warmth + 0.05 * tint_strength
    return _from_float(result)


def apply_vibrance(image: Image.Image, vibrance: float) -> Image.Image:
    if vibrance == 0:
        return image

    pixels = np.asarray(image, dtype=np.float32) / 255.0
    luminance = np.sum(pixels * np.array([0.2126, 0.7152, 0.0722]), axis=2, keepdims=True)
    saturation = np.max(pixels, axis=2, keepdims=True) - np.min(
        pixels, axis=2, keepdims=True
    )
    strength = vibrance / 100.0
    adaptive = (1.0 - saturation) * strength * 0.9
    result = luminance + (pixels - luminance) * (1.0 + adaptive)
    return _from_float(result)


def apply_vibrance_and_saturation(
    image: Image.Image, vibrance: float, saturation: float
) -> Image.Image:
    result = apply_vibrance(image, vibrance)
    return ImageEnhance.Color(result).enhance(max(0.0, 1.0 + saturation / 100.0))


def _from_float(pixels: np.ndarray) -> Image.Image:
    return Image.fromarray(np.clip(pixels * 255.0, 0, 255).astype(np.uint8))
