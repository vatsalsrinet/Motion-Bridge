from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
import tempfile
from urllib.request import urlopen

import cv2
import mediapipe as mp
import numpy as np


MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
BLENDSHAPE_NAMES = (
    "eyeBlinkLeft", "eyeBlinkRight", "browDownLeft", "browDownRight",
    "jawOpen", "mouthSmileLeft", "mouthSmileRight", "mouthPucker",
)


class NoFaceDetected(Exception):
    """The frame was valid but MediaPipe found no face."""


class FeatureExtractionError(Exception):
    """A frame or MediaPipe result could not be converted to features."""


@dataclass(frozen=True)
class ExtractedFeatures:
    vector: np.ndarray
    yaw: float
    pitch: float
    roll: float


class FaceFeatureExtractor:
    """MediaPipe Tasks face features plus OpenCV head pose and scale-free geometry."""

    def __init__(self, model_path: str | None = None, landmarker=None) -> None:
        self.model_path = model_path or os.getenv("MOTIONBRIDGE_FACE_MODEL")
        self.landmarker = landmarker
        self._timestamp_ms = 0

    def close(self) -> None:
        if self.landmarker is not None and hasattr(self.landmarker, "close"):
            self.landmarker.close()

    def process(self, frame_bgr: np.ndarray) -> ExtractedFeatures:
        if frame_bgr is None or frame_bgr.size == 0 or frame_bgr.ndim != 3:
            raise FeatureExtractionError("Malformed camera frame")
        self._ensure_landmarker()
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        self._timestamp_ms += 83
        result = self.landmarker.detect_for_video(image, self._timestamp_ms)
        if not result.face_landmarks:
            raise NoFaceDetected
        landmarks = result.face_landmarks[0]
        height, width = frame_bgr.shape[:2]
        pose = self._head_pose(landmarks, width, height)
        vector = np.concatenate((self._blendshapes(result), self._geometry(landmarks), np.asarray(pose)))
        if vector.size == 0 or not np.isfinite(vector).all():
            raise FeatureExtractionError("MediaPipe returned an invalid feature vector")
        return ExtractedFeatures(vector=vector.astype(np.float32), yaw=pose[0], pitch=pose[1], roll=pose[2])

    def _ensure_landmarker(self) -> None:
        if self.landmarker is not None:
            return
        path = Path(self.model_path) if self.model_path else Path(tempfile.gettempdir()) / "motionbridge_face_landmarker.task"
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            with urlopen(MODEL_URL, timeout=30) as response, path.open("wb") as output:
                output.write(response.read())
        options = mp.tasks.vision.FaceLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(path)),
            running_mode=mp.tasks.vision.RunningMode.VIDEO,
            num_faces=1,
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=True,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.landmarker = mp.tasks.vision.FaceLandmarker.create_from_options(options)

    def _blendshapes(self, result) -> np.ndarray:
        categories = result.face_blendshapes[0] if result.face_blendshapes else []
        by_name = {category.category_name: category.score for category in categories}
        return np.asarray([by_name.get(name, 0.0) for name in BLENDSHAPE_NAMES], dtype=np.float32)

    def _geometry(self, landmarks) -> np.ndarray:
        def point(index: int) -> np.ndarray:
            landmark = landmarks[index]
            return np.asarray([landmark.x, landmark.y, landmark.z], dtype=np.float32)

        left_eye, right_eye = point(33), point(263)
        face_width = max(float(np.linalg.norm(right_eye - left_eye)), 1e-4)
        face_height = max(float(np.linalg.norm(point(10) - point(152))), 1e-4)
        mouth_width = float(np.linalg.norm(point(61) - point(291))) / face_width
        mouth_open = float(np.linalg.norm(point(13) - point(14))) / face_height
        left_eye_open = float(np.linalg.norm(point(159) - point(145))) / face_height
        right_eye_open = float(np.linalg.norm(point(386) - point(374))) / face_height
        left_brow = float(np.linalg.norm(point(70) - point(159))) / face_height
        right_brow = float(np.linalg.norm(point(300) - point(386))) / face_height
        nose_offset = float(point(1)[0] - (left_eye[0] + right_eye[0]) / 2) / face_width
        return np.asarray([mouth_width, mouth_open, left_eye_open, right_eye_open, left_brow, right_brow, nose_offset], dtype=np.float32)

    def _head_pose(self, landmarks, width: int, height: int) -> tuple[float, float, float]:
        indices = [1, 152, 33, 263, 61, 291]
        model_points = np.asarray(
            [(0.0, 0.0, 0.0), (0.0, -63.6, -12.5), (-43.3, 32.7, -26.0),
             (43.3, 32.7, -26.0), (-28.9, -28.9, -24.1), (28.9, -28.9, -24.1)],
            dtype=np.float32,
        )
        image_points = np.asarray([(landmarks[i].x * width, landmarks[i].y * height) for i in indices], dtype=np.float32)
        camera_matrix = np.asarray([[width, 0, width / 2], [0, width, height / 2], [0, 0, 1]], dtype=np.float64)
        try:
            ok, rotation_vector, _ = cv2.solvePnP(model_points, image_points, camera_matrix, np.zeros((4, 1)), flags=cv2.SOLVEPNP_ITERATIVE)
            if not ok:
                return 0.0, 0.0, 0.0
            rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
            angles = cv2.RQDecomp3x3(rotation_matrix)[0]
            return float(angles[1]), float(angles[0]), float(angles[2])
        except (cv2.error, ValueError, TypeError):
            return 0.0, 0.0, 0.0
