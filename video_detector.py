"""Lazy-loading adapter for the team's spatial and temporal video detector."""

from pathlib import Path
from threading import Lock
import math


class VideoModelUnavailable(RuntimeError):
    """Raised when the video model or one of its dependencies is unavailable."""


class InvalidVideoError(ValueError):
    """Raised when a video cannot be decoded into frames."""


PROJECT_DIR = Path(__file__).resolve().parent
MODEL_DIR = PROJECT_DIR / "models"
VIDEO_SEQUENCE_LENGTH = 8  # Must match video_seq_len in the teammate's training config.
_MODEL_FILES = (
    "fine_tuned_v1.pt",
    "fine_tuned.pt",
    "best_model.pt",
    "video_gru.pt",
)

_detector = None
_load_lock = Lock()
_inference_lock = Lock()


def _get_detector():
    global _detector
    if _detector is not None:
        return _detector

    with _load_lock:
        if _detector is not None:
            return _detector

        missing = [name for name in _MODEL_FILES if not (MODEL_DIR / name).is_file()]
        if missing:
            raise VideoModelUnavailable(
                "Video detector weights are missing: " + ", ".join(missing)
            )

        try:
            from detector import DeepfakeDetector

            detector = DeepfakeDetector(
                model_path=str(MODEL_DIR / "fine_tuned.pt"),
                gru_model_path=str(MODEL_DIR / "video_gru.pt"),
                num_video_frames=VIDEO_SEQUENCE_LENGTH,
            )
        except Exception as exc:
            raise VideoModelUnavailable(
                "The video detector could not be initialized. Check PyTorch, OpenCV, "
                "facenet-pytorch, and the supplied checkpoints."
            ) from exc

        if not all((detector.model_v1, detector.model_ft, detector.model_base)):
            raise VideoModelUnavailable(
                "One or more EfficientNet checkpoints could not be loaded."
            )
        if not detector.gru_is_trained:
            raise VideoModelUnavailable("The trained video GRU checkpoint could not be loaded.")

        _detector = detector
        return _detector


def analyze_video(video_path: str) -> dict:
    """Analyze a video path and return API-friendly confidence fields."""
    detector = _get_detector()
    try:
        with _inference_lock:
            result = detector.predict_video(video_path)
    except (FileNotFoundError, ValueError) as exc:
        raise InvalidVideoError("The uploaded video has no readable frames.") from exc
    except RuntimeError as exc:
        if "Could not open video" in str(exc) or "No readable frames" in str(exc):
            raise InvalidVideoError("The uploaded video could not be decoded.") from exc
        raise VideoModelUnavailable("Video analysis failed while running the model.") from exc

    try:
        fake_probability = float(result["Fake Confidence"])
        real_probability = float(result["Real Confidence"])
        prediction = str(result["Label"]).upper()
        gru_temporal_score = float(result.get("GRU Temporal Score", 0.0))
        frame_fake_scores = [float(score) for score in result.get("Frame Fake Scores", [])]
    except (KeyError, TypeError, ValueError) as exc:
        raise VideoModelUnavailable("The video detector returned an invalid result.") from exc

    if (
        prediction not in {"REAL", "FAKE"}
        or not math.isfinite(fake_probability)
        or not math.isfinite(real_probability)
        or not math.isfinite(gru_temporal_score)
        or not 0 <= fake_probability <= 1
        or not 0 <= real_probability <= 1
    ):
        raise VideoModelUnavailable("The video detector returned invalid confidence values.")

    # Do not present a decisive fake label when the spatial ensemble strongly
    # favors real frames but the GRU alone flags temporal artifacts.
    model_conflict = bool(
        frame_fake_scores
        and max(frame_fake_scores) <= 0.25
        and gru_temporal_score >= 0.75
    )
    if model_conflict:
        prediction = "UNCERTAIN"

    if fake_probability >= 0.90:
        threat_level = "CRITICAL"
    elif fake_probability >= 0.70:
        threat_level = "HIGH"
    elif fake_probability >= 0.50:
        threat_level = "MEDIUM"
    elif fake_probability >= 0.30:
        threat_level = "LOW"
    else:
        threat_level = "SAFE"

    return {
        "prediction": prediction,
        "confidence": round(max(real_probability, fake_probability) * 100, 2),
        "real_probability": round(real_probability, 6),
        "fake_probability": round(fake_probability, 6),
        "threat_level": threat_level,
        "model_conflict": model_conflict,
        "frames_analyzed": int(result.get("Frames Analyzed", 0)),
        "faces_detected": int(result.get("Faces Detected", 0)),
        "gru_temporal_score": round(gru_temporal_score, 6),
        "temporal_flicker": round(float(result.get("Temporal Flicker", 0.0)), 6),
    }
