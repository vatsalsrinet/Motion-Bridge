from __future__ import annotations

import base64
import binascii
import time

import cv2
import numpy as np

from .calibration import CalibrationManager, CalibrationStatus
from .classifier import PersonalizedClassifier, Prediction
from .config import DEFAULT_CONFIG, VisionConfig
from .feature_extractor import FaceFeatureExtractor, NoFaceDetected
from .gesture_state_machine import GestureEvent, GestureStateMachine
from .models import CalibrationProgressPayload, ErrorPayload, EventPayload, PredictionPayload


class VisionSession:
    def __init__(self, config: VisionConfig = DEFAULT_CONFIG, extractor: FaceFeatureExtractor | None = None) -> None:
        self.config = config
        self.extractor = extractor or FaceFeatureExtractor()
        self.calibration = CalibrationManager(config)
        self.classifier = PersonalizedClassifier(config.confidence_threshold, config.margin_threshold)
        self.state_machine = GestureStateMachine(config.stable_s, config.cooldown_s)

    def close(self) -> None:
        self.extractor.close()

    def start_calibration(self, gesture: str) -> CalibrationProgressPayload:
        self.calibration.begin(gesture)
        self.classifier = PersonalizedClassifier(self.config.confidence_threshold, self.config.margin_threshold)
        self.state_machine.reset()
        return self.progress_payload()

    def reset(self) -> CalibrationProgressPayload:
        self.calibration.reset()
        self.classifier = PersonalizedClassifier(self.config.confidence_threshold, self.config.margin_threshold)
        self.state_machine.reset()
        return self.progress_payload()

    def process_frame(self, encoded_image: str) -> list[object]:
        try:
            frame = decode_image(encoded_image)
            extracted = self.extractor.process(frame)
        except NoFaceDetected:
            return [self.prediction_payload(Prediction("UNKNOWN", 0, {label: 0 for label in ("NEUTRAL", "NEXT", "SELECT")}, {}), False)]
        except (ValueError, binascii.Error, cv2.error) as error:
            return [ErrorPayload(message=f"Invalid frame: {error}", code="INVALID_FRAME")]
        except Exception as error:
            return [ErrorPayload(message=f"Vision processing failed: {error}", code="VISION_PROCESSING_FAILED")]

        now = time.monotonic()
        if self.calibration.mode != "IDLE":
            self.calibration.observe(extracted.vector, now)
            messages: list[object] = [self.progress_payload()]
            if self.calibration.ready and not self.classifier.trained:
                features, labels = self.calibration.training_data()
                self.classifier.fit(features, labels)
            current = Prediction("NEUTRAL" if self.calibration.mode == "NEUTRAL" else "UNKNOWN", 100 if self.calibration.mode == "NEUTRAL" else 0, {"NEUTRAL": 100 if self.calibration.mode == "NEUTRAL" else 0, "NEXT": 0, "SELECT": 0}, {})
            messages.insert(0, self.prediction_payload(current, True))
            return messages

        if not self.calibration.ready:
            return [self.prediction_payload(Prediction("UNKNOWN", 0, {label: 0 for label in ("NEUTRAL", "NEXT", "SELECT")}, {}), True), self.progress_payload()]
        if not self.classifier.trained:
            features, labels = self.calibration.training_data()
            self.classifier.fit(features, labels)
        prediction = self.classifier.predict(self.calibration.normalize(extracted.vector))
        messages = [self.prediction_payload(prediction, True), self.progress_payload()]
        event = self.state_machine.update(prediction, now)
        if event:
            messages.append(EventPayload(command=event.command, confidence=event.confidence))
        return messages

    def progress_payload(self) -> CalibrationProgressPayload:
        status = self.calibration.status()
        if status.mode == "NEUTRAL":
            current, required, gesture = status.neutral_current, status.neutral_required, "NEUTRAL"
            phase = status.phase
            quality = 0
        else:
            gesture = status.mode if status.mode in ("NEXT", "SELECT") else "PROFILE"
            current = status.next_current if gesture == "NEXT" else status.select_current if gesture == "SELECT" else 0
            required = status.gesture_required if gesture in ("NEXT", "SELECT") else status.gesture_required
            phase = status.phase
            quality = status.next_quality if gesture == "NEXT" else status.select_quality if gesture == "SELECT" else min(status.next_quality, status.select_quality)
        return CalibrationProgressPayload(
            gesture=gesture,
            current=current,
            required=required,
            phase=phase,
            quality=quality,
            ready=status.ready,
            issue=status.issue,
            neutral_current=status.neutral_current,
            neutral_required=status.neutral_required,
            next_current=status.next_current,
            select_current=status.select_current,
            gesture_required=status.gesture_required,
            next_quality=status.next_quality,
            select_quality=status.select_quality,
        )

    @staticmethod
    def prediction_payload(prediction: Prediction, face_detected: bool) -> PredictionPayload:
        return PredictionPayload(
            prediction=prediction.label,
            confidence=int(np.clip(prediction.confidence, 0, 100)),
            scores=prediction.scores,
            face_detected=face_detected,
            distances=prediction.distances,
        )


def decode_image(encoded: str) -> np.ndarray:
    payload = encoded.split(",", 1)[1] if "," in encoded else encoded
    raw = base64.b64decode(payload, validate=True)
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("image could not be decoded")
    return image
