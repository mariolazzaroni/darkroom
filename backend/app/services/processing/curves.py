from __future__ import annotations

import numpy as np
from PIL import Image

from app.models.image import CurvePoint, CurveSet, identity_curve

LUT_SIZE = 4096


def build_curve_lut(
    points: list[CurvePoint], size: int = LUT_SIZE
) -> np.ndarray:
    """Build a shape-preserving PCHIP LUT in normalized 0-1 space."""
    x = np.asarray([point[0] for point in points], dtype=np.float64) / 255.0
    y = np.asarray([point[1] for point in points], dtype=np.float64) / 255.0
    tangents = _pchip_tangents(x, y)
    samples = np.linspace(0.0, 1.0, size, dtype=np.float64)

    interval = np.searchsorted(x, samples, side="right") - 1
    interval = np.clip(interval, 0, len(x) - 2)
    x0 = x[interval]
    x1 = x[interval + 1]
    y0 = y[interval]
    y1 = y[interval + 1]
    h = x1 - x0
    t = (samples - x0) / h

    h00 = 2 * t**3 - 3 * t**2 + 1
    h10 = t**3 - 2 * t**2 + t
    h01 = -2 * t**3 + 3 * t**2
    h11 = t**3 - t**2
    values = (
        h00 * y0
        + h10 * h * tangents[interval]
        + h01 * y1
        + h11 * h * tangents[interval + 1]
    )
    return np.clip(values, 0.0, 1.0).astype(np.float32)


def apply_curves(image: Image.Image, curves: CurveSet) -> Image.Image:
    if all(
        getattr(curves, channel) == identity_curve()
        for channel in ("rgb", "red", "green", "blue")
    ):
        return image

    pixels = np.asarray(image, dtype=np.float32) / 255.0
    rgb_lut = build_curve_lut(curves.rgb)
    pixels = _apply_lut(pixels, rgb_lut)

    for channel_index, channel_name in enumerate(("red", "green", "blue")):
        channel_points = getattr(curves, channel_name)
        if channel_points != identity_curve():
            channel_lut = build_curve_lut(channel_points)
            pixels[..., channel_index] = _apply_lut(
                pixels[..., channel_index], channel_lut
            )

    return Image.fromarray(np.rint(np.clip(pixels, 0.0, 1.0) * 255.0).astype(np.uint8))


def _apply_lut(values: np.ndarray, lut: np.ndarray) -> np.ndarray:
    indices = np.rint(np.clip(values, 0.0, 1.0) * (len(lut) - 1)).astype(np.int32)
    return lut[indices]


def _pchip_tangents(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    count = len(x)
    h = np.diff(x)
    slopes = np.diff(y) / h
    tangents = np.zeros(count, dtype=np.float64)

    if count == 2:
        tangents[:] = slopes[0]
        return tangents

    for index in range(1, count - 1):
        before = slopes[index - 1]
        after = slopes[index]
        if before == 0 or after == 0 or np.sign(before) != np.sign(after):
            tangents[index] = 0.0
        else:
            weight_before = 2 * h[index] + h[index - 1]
            weight_after = h[index] + 2 * h[index - 1]
            tangents[index] = (weight_before + weight_after) / (
                weight_before / before + weight_after / after
            )

    tangents[0] = _endpoint_tangent(h[0], h[1], slopes[0], slopes[1])
    tangents[-1] = _endpoint_tangent(
        h[-1], h[-2], slopes[-1], slopes[-2]
    )
    return tangents


def _endpoint_tangent(
    adjacent_h: float,
    next_h: float,
    adjacent_slope: float,
    next_slope: float,
) -> float:
    tangent = (
        (2 * adjacent_h + next_h) * adjacent_slope
        - adjacent_h * next_slope
    ) / (adjacent_h + next_h)
    if np.sign(tangent) != np.sign(adjacent_slope):
        return 0.0
    if (
        np.sign(adjacent_slope) != np.sign(next_slope)
        and abs(tangent) > abs(3 * adjacent_slope)
    ):
        return 3 * adjacent_slope
    return float(tangent)
