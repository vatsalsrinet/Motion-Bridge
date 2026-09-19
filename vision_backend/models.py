from typing import Dict, Literal, Union
from pydantic import BaseModel, Field

Gesture = Literal["NEXT", "SELECT", "NEUTRAL"]
PredictionLabel = Literal["NEXT", "SELECT", "NEUTRAL", "UNKNOWN"]


class FrameMessage(BaseModel):
    type: Literal["frame"]
    image: str = Field(min_length=1)


class CalibrationMessage(BaseModel):
    type: Literal["start_calibration"]
    gesture: Gesture


class ResetMessage(BaseModel):
    type: Literal["reset"]


class PredictionPayload(BaseModel):
    type: Literal["prediction"] = "prediction"
    prediction: PredictionLabel
    confidence: int = Field(ge=0, le=100)
    scores: Dict[str, int] = Field(default_factory=dict)
    face_detected: bool = False
    distances: Dict[str, float] = Field(default_factory=dict)


class CalibrationProgressPayload(BaseModel):
    type: Literal["calibration_progress"] = "calibration_progress"
    gesture: str
    current: int = Field(ge=0)
    required: int = Field(ge=0)
    phase: str = "IDLE"
    quality: int = Field(default=0, ge=0, le=100)
    ready: bool = False
    issue: str | None = None


class EventPayload(BaseModel):
    type: Literal["event"] = "event"
    command: Literal["NEXT", "SELECT", "NEUTRAL"]
    confidence: int = Field(ge=0, le=100)


class ErrorPayload(BaseModel):
    type: Literal["error"] = "error"
    message: str
    code: str = "VISION_ERROR"


IncomingMessage = Union[FrameMessage, CalibrationMessage, ResetMessage]
