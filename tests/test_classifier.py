import numpy as np

from vision_backend.classifier import PersonalizedClassifier


def trained_classifier() -> PersonalizedClassifier:
    features = np.asarray(
        [[0, 0], [0.1, 0], [-0.1, 0], [0, 0.1],
         [4, 0], [4.1, 0], [3.9, 0], [4, 0.1],
         [0, 4], [0, 4.1], [0, 3.9], [0.1, 4]], dtype=float,
    )
    labels = np.asarray(["NEUTRAL"] * 4 + ["NEXT"] * 4 + ["SELECT"] * 4)
    model = PersonalizedClassifier(confidence_threshold=0.55, margin_threshold=0.1)
    model.fit(features, labels)
    return model


def test_classifier_training_confidence_and_scores():
    prediction = trained_classifier().predict(np.array([4.0, 0.0]))
    assert prediction.label == "NEXT"
    assert 0 <= prediction.confidence <= 100
    assert prediction.scores["NEXT"] > prediction.scores["NEUTRAL"]
    assert prediction.scores["NEXT"] > prediction.scores["SELECT"]


def test_far_input_becomes_unknown():
    prediction = trained_classifier().predict(np.array([20.0, 20.0]))
    assert prediction.label == "UNKNOWN"
    assert 0 <= prediction.confidence <= 100
