from typing import Literal

from pydantic import BaseModel, Field, field_validator

CurvePoint = tuple[int, int]


def identity_curve() -> list[CurvePoint]:
    return [(0, 0), (255, 255)]


class CurveSet(BaseModel):
    rgb: list[CurvePoint] = Field(default_factory=identity_curve)
    red: list[CurvePoint] = Field(default_factory=identity_curve)
    green: list[CurvePoint] = Field(default_factory=identity_curve)
    blue: list[CurvePoint] = Field(default_factory=identity_curve)

    @field_validator("rgb", "red", "green", "blue")
    @classmethod
    def validate_curve(cls, points: list[CurvePoint]) -> list[CurvePoint]:
        if not 2 <= len(points) <= 32:
            raise ValueError("Una curva deve contenere da 2 a 32 punti")
        if points[0][0] != 0 or points[-1][0] != 255:
            raise ValueError("Una curva deve iniziare a input 0 e terminare a input 255")

        previous_x = -1
        for x, y in points:
            if not 0 <= x <= 255 or not 0 <= y <= 255:
                raise ValueError("Input e Output dei punti devono essere compresi tra 0 e 255")
            if x <= previous_x:
                raise ValueError("Gli Input dei punti devono essere strettamente crescenti")
            previous_x = x
        return points


class AdjustmentParameters(BaseModel):
    exposure: float = 0.0
    contrast: float = 0.0
    highlights: float = 0.0
    shadows: float = 0.0
    whites: float = 0.0
    blacks: float = 0.0
    temperature: float = 0.0
    tint: float = 0.0
    vibrance: float = 0.0
    saturation: float = 0.0
    vignette: float = 0.0
    grain: float = 0.0
    sharpening: float = 0.0
    curves: CurveSet = Field(default_factory=CurveSet)

    @field_validator("exposure")
    @classmethod
    def validate_exposure(cls, value: float) -> float:
        if not -5.0 <= value <= 5.0:
            raise ValueError("L'esposizione deve essere compresa tra -5 e 5")
        return value

    @field_validator(
        "contrast",
        "highlights",
        "shadows",
        "whites",
        "blacks",
        "temperature",
        "tint",
        "vibrance",
        "saturation",
        "vignette",
    )
    @classmethod
    def validate_percentage(cls, value: float) -> float:
        if not -100.0 <= value <= 100.0:
            raise ValueError("Il valore deve essere compreso tra -100 e 100")
        return value

    @field_validator("grain", "sharpening")
    @classmethod
    def validate_positive_percentage(cls, value: float) -> float:
        if not 0.0 <= value <= 100.0:
            raise ValueError("Il valore deve essere compreso tra 0 e 100")
        return value


class ExportParameters(AdjustmentParameters):
    quality: Literal[70, 80, 90, 95, 100] = 95


class UploadResponse(BaseModel):
    image_id: str
    filename: str
    width: int
    height: int
