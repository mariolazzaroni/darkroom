from pydantic import BaseModel, field_validator


class AdjustmentParameters(BaseModel):
    exposure: float = 0.0
    contrast: float = 0.0
    saturation: float = 0.0
    temperature: float = 0.0

    @field_validator("exposure")
    @classmethod
    def validate_exposure(cls, value: float) -> float:
        if not -2.0 <= value <= 2.0:
            raise ValueError("L'esposizione deve essere compresa tra -2 e 2")
        return value

    @field_validator("contrast", "saturation", "temperature")
    @classmethod
    def validate_percentage(cls, value: float) -> float:
        if not -100.0 <= value <= 100.0:
            raise ValueError("Il valore deve essere compreso tra -100 e 100")
        return value


class UploadResponse(BaseModel):
    image_id: str
    filename: str
    width: int
    height: int
