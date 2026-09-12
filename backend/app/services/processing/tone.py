import numpy as np
from PIL import Image, ImageEnhance

from app.models.image import AdjustmentParameters


def apply_tone(image: Image.Image, parameters: AdjustmentParameters) -> Image.Image:
    pixels = np.asarray(image, dtype=np.float32) / 255.0
    pixels *= 2.0**parameters.exposure
    pixels = np.clip(pixels, 0.0, 1.0)

    pixels = _adjust_region(pixels, parameters.highlights, "highlights")
    pixels = _adjust_region(pixels, parameters.shadows, "shadows")
    pixels = _adjust_region(pixels, parameters.whites, "whites")
    pixels = _adjust_region(pixels, parameters.blacks, "blacks")

    result = Image.fromarray(np.clip(pixels * 255.0, 0, 255).astype(np.uint8))
    return ImageEnhance.Contrast(result).enhance(
        max(0.0, 1.0 + parameters.contrast / 100.0)
    )


def _adjust_region(pixels: np.ndarray, value: float, region: str) -> np.ndarray:
    if value == 0:
        return pixels

    luminance = np.sum(
        pixels * np.array([0.2126, 0.7152, 0.0722], dtype=np.float32), axis=2, keepdims=True
    )
    strength = value / 100.0

    if region == "highlights":
        mask = np.clip((luminance - 0.35) / 0.65, 0.0, 1.0) ** 1.5
        scale = 0.55
    elif region == "shadows":
        mask = np.clip((0.65 - luminance) / 0.65, 0.0, 1.0) ** 1.5
        scale = 0.55
    elif region == "whites":
        mask = np.clip((luminance - 0.65) / 0.35, 0.0, 1.0) ** 2
        scale = 0.45
    else:
        mask = np.clip((0.35 - luminance) / 0.35, 0.0, 1.0) ** 2
        scale = 0.45

    if strength > 0:
        pixels = pixels + strength * scale * mask * (1.0 - pixels)
    else:
        pixels = pixels + strength * scale * mask * pixels
    return np.clip(pixels, 0.0, 1.0)

