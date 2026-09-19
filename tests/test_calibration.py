import numpy as np

from vision_backend.calibration import CalibrationManager
from vision_backend.config import VisionConfig


def small_config() -> VisionConfig:
    return VisionConfig(neutral_frames=5, gesture_repetitions=2, sample_window_min_s=0.1, sample_window_max_s=0.3)


def test_neutral_normalization_and_temporal_gesture_windows():
    calibration = CalibrationManager(small_config())
    calibration.begin("NEUTRAL")
    for index in range(5):
        calibration.observe(np.array([0.0, 0.0]), float(index) * 0.05)
    assert calibration.neutral_complete
    np.testing.assert_allclose(calibration.normalize(np.array([0.0, 0.0])), [0.0, 0.0])

    calibration.begin("NEXT")
    assert not calibration.observe(np.array([1.0, 0.0]), 0.0)
    assert calibration.observe(np.array([0.0, 0.0]), 0.12)
    assert calibration.status().next_current == 1
    calibration.observe(np.array([0.0, 0.0]), 0.13)
    calibration.observe(np.array([1.0, 0.0]), 0.5)
    assert calibration.observe(np.array([0.0, 0.0]), 0.62)
    calibration.observe(np.array([0.0, 0.0]), 0.63)
    assert calibration.status().next_current == 2


def test_overlapping_gestures_fail_quality():
    calibration = CalibrationManager(small_config())
    calibration.begin("NEUTRAL")
    for index in range(5):
        calibration.observe(np.zeros(2), index * 0.1)
    for gesture in ("NEXT", "SELECT"):
        calibration.begin(gesture)
        for offset in (0.0, 0.5):
            calibration.observe(np.array([1.0, 0.0]), offset)
            calibration.observe(np.zeros(2), offset + 0.12)
            calibration.observe(np.zeros(2), offset + 0.13)
    assert calibration.status().ready is False
    assert calibration.status().issue
