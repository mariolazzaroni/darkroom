import numpy as np
from PIL import Image


def apply_vignette(image: Image.Image, vignette: float) -> Image.Image:
    if vignette == 0:
        return image

    pixels = np.asarray(image, dtype=np.float32) / 255.0
    height, width = pixels.shape[:2]
    y, x = np.ogrid[-1.0:1.0:height * 1j, -1.0:1.0:width * 1j]
    distance = np.sqrt(x * x + y * y)
    edge_mask = np.clip((distance - 0.25) / 0.9, 0.0, 1.0) ** 1.7
    factor = 1.0 + (vignette / 100.0) * 0.70 * edge_mask[..., None]
    return _from_float(pixels * factor)


def apply_grain(image: Image.Image, grain: float) -> Image.Image:
    if grain == 0:
        return image

    pixels = np.asarray(image, dtype=np.float32) / 255.0
    random = np.random.default_rng(2026)
    noise = random.normal(
        0.0, 0.10 * (grain / 100.0), size=(*pixels.shape[:2], 1)
    ).astype(np.float32)
    midtone_weight = 0.55 + 0.45 * (1.0 - np.abs(pixels.mean(axis=2, keepdims=True) - 0.5) * 2.0)
    return _from_float(pixels + noise * midtone_weight)


def _from_float(pixels: np.ndarray) -> Image.Image:
    return Image.fromarray(np.clip(pixels * 255.0, 0, 255).astype(np.uint8))

