from dataclasses import dataclass
import os


@dataclass(frozen=True)
class VisionConfig:
    neutral_frames: int = int(os.getenv("MOTIONBRIDGE_NEUTRAL_FRAMES", "80"))
    gesture_repetitions: int = int(os.getenv("MOTIONBRIDGE_GESTURE_REPETITIONS", "5"))
    fps: int = int(os.getenv("MOTIONBRIDGE_FPS", "12"))
    movement_start_rms: float = float(os.getenv("MOTIONBRIDGE_MOVEMENT_START", "2.2"))
    neutral_return_rms: float = float(os.getenv("MOTIONBRIDGE_NEUTRAL_RETURN", "1.15"))
    sample_window_min_s: float = float(os.getenv("MOTIONBRIDGE_WINDOW_MIN", "0.30"))
    sample_window_max_s: float = float(os.getenv("MOTIONBRIDGE_WINDOW_MAX", "0.60"))
    confidence_threshold: float = float(os.getenv("MOTIONBRIDGE_CONFIDENCE", "0.62"))
    margin_threshold: float = float(os.getenv("MOTIONBRIDGE_MARGIN", "0.12"))
    cooldown_s: float = float(os.getenv("MOTIONBRIDGE_COOLDOWN", "0.70"))
    stable_s: float = float(os.getenv("MOTIONBRIDGE_STABLE", "0.25"))
    quality_threshold: float = float(os.getenv("MOTIONBRIDGE_QUALITY", "35"))


DEFAULT_CONFIG = VisionConfig()
