from __future__ import annotations

from dataclasses import dataclass
import numpy as np
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler


LABELS = ("NEUTRAL", "NEXT", "SELECT")


@dataclass(frozen=True)
class Prediction:
    label: str
    confidence: int
    scores: dict[str, int]
    distances: dict[str, float]


class PersonalizedClassifier:
    """Small, probability-producing KNN model for a single calibrated user."""

    def __init__(self, confidence_threshold: float = 0.62, margin_threshold: float = 0.12) -> None:
        self.confidence_threshold = confidence_threshold
        self.margin_threshold = margin_threshold
        self.scaler = StandardScaler()
        self.model: KNeighborsClassifier | None = None
        self._unknown_distance = float("inf")

    @property
    def trained(self) -> bool:
        return self.model is not None

    def fit(self, features: np.ndarray, labels: np.ndarray) -> None:
        if features.ndim != 2 or len(features) < 3 or not np.isfinite(features).all():
            raise ValueError("Training features are invalid")
        if set(labels.tolist()) != set(LABELS):
            raise ValueError("Training requires NEUTRAL, NEXT, and SELECT classes")
        self.scaler.fit(features)
        scaled = self.scaler.transform(features)
        neighbors = max(1, min(5, len(features)))
        self.model = KNeighborsClassifier(n_neighbors=neighbors, weights="distance")
        self.model.fit(scaled, labels)
        train_distances, _ = self.model.kneighbors(scaled, n_neighbors=min(2, len(features)))
        nearest = train_distances[:, -1]
        self._unknown_distance = float(np.percentile(nearest, 95) * 3.0 + 1.5)

    def predict(self, features: np.ndarray) -> Prediction:
        if self.model is None:
            return Prediction("UNKNOWN", 0, {label: 0 for label in LABELS}, {})
        vector = np.asarray(features, dtype=np.float32).reshape(1, -1)
        if not np.isfinite(vector).all():
            return Prediction("UNKNOWN", 0, {label: 0 for label in LABELS}, {})
        scaled = self.scaler.transform(vector)
        probabilities = self.model.predict_proba(scaled)[0]
        class_probabilities = {str(label): float(probabilities[index]) for index, label in enumerate(self.model.classes_)}
        scores = {label: int(round(class_probabilities.get(label, 0.0) * 100)) for label in LABELS}
        ranked = sorted(((label, class_probabilities.get(label, 0.0)) for label in LABELS), key=lambda item: item[1], reverse=True)
        winner, winner_probability = ranked[0]
        margin = winner_probability - ranked[1][1]
        distances: dict[str, float] = {}
        neighbor_distances, neighbor_indices = self.model.kneighbors(scaled, n_neighbors=min(5, len(self.model._fit_X)))
        for distance, index in zip(neighbor_distances[0], neighbor_indices[0]):
            label = str(self.model._y[index])
            distances[label] = min(distances.get(label, float("inf")), float(distance))
        best_distance = min(distances.values(), default=float("inf"))
        accepted = winner_probability >= self.confidence_threshold and margin >= self.margin_threshold and best_distance <= self._unknown_distance
        confidence = int(round(np.clip(winner_probability, 0, 1) * 100))
        return Prediction(winner if accepted else "UNKNOWN", confidence, scores, distances)
