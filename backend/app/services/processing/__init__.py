from PIL import Image

from app.models.image import AdjustmentParameters
from app.services.processing.color import (
    apply_temperature_and_tint,
    apply_vibrance_and_saturation,
)
from app.services.processing.curves import apply_curves
from app.services.processing.detail import apply_sharpening
from app.services.processing.effects import apply_grain, apply_vignette
from app.services.processing.tone import apply_tone


def apply_pipeline(image: Image.Image, parameters: AdjustmentParameters) -> Image.Image:
    """Apply the shared preview/export pipeline in its documented order."""
    result = apply_temperature_and_tint(
        image, parameters.temperature, parameters.tint
    )
    result = apply_tone(result, parameters)
    result = apply_curves(result, parameters.curves)
    result = apply_vibrance_and_saturation(
        result, parameters.vibrance, parameters.saturation
    )
    result = apply_vignette(result, parameters.vignette)
    result = apply_sharpening(result, parameters.sharpening)
    return apply_grain(result, parameters.grain)
