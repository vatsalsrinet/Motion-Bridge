from vision_backend.classifier import Prediction
from vision_backend.gesture_state_machine import GestureStateMachine


def prediction(label: str, confidence: int = 90) -> Prediction:
    return Prediction(label, confidence, {"NEUTRAL": 0, "NEXT": 90, "SELECT": 10}, {})


def test_stability_cooldown_and_neutral_rearm():
    state = GestureStateMachine(stable_s=0.2, cooldown_s=0.5)
    assert state.update(prediction("NEXT"), 0.0) is None
    assert state.update(prediction("NEXT"), 0.1) is None
    event = state.update(prediction("NEXT"), 0.31)
    assert event and event.command == "NEXT"
    assert state.update(prediction("NEXT"), 1.0) is None
    neutral = state.update(Prediction("NEUTRAL", 95, {"NEUTRAL": 95, "NEXT": 3, "SELECT": 2}, {}), 1.0)
    assert neutral and neutral.command == "NEUTRAL"
    assert state.update(prediction("SELECT"), 1.1) is None
    assert state.update(prediction("SELECT"), 1.2) is None
    event = state.update(prediction("SELECT"), 1.41)
    assert event and event.command == "SELECT"
