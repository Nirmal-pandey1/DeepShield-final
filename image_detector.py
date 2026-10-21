"""Image inference for the team's EfficientNet-B0 deepfake model."""

from functools import lru_cache
from io import BytesIO
import os
from pathlib import Path
from threading import Lock


class ImageModelUnavailable(RuntimeError):
    """Raised when the model or its runtime dependencies are unavailable."""


class InvalidImageError(ValueError):
    """Raised when an uploaded file cannot be decoded as an image."""


MODEL_PATH = Path(
    os.getenv(
        "IMAGE_MODEL_PATH",
        str(Path(__file__).resolve().parent / "models" / "best_model-v3.pt"),
    )
).expanduser()

_model = None
_face_detector = None
_torch = None
_device = None
_model_lock = Lock()


def _load_model():
    global _model, _face_detector, _torch, _device
    if _model is not None:
        return _model, _face_detector, _torch, _device

    with _model_lock:
        if _model is not None:
            return _model, _face_detector, _torch, _device

        if not MODEL_PATH.is_file():
            raise ImageModelUnavailable(
                f"Image model weights were not found at {MODEL_PATH}."
            )

        try:
            import torch
            from facenet_pytorch import MTCNN
            from torchvision import models
        except Exception as exc:
            raise ImageModelUnavailable(
                "PyTorch, torchvision, and facenet-pytorch are required for image analysis. "
                "Install the backend requirements and restart the server."
            ) from exc

        try:
            device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
            # The checkpoint contains the trained EfficientNet weights, so avoid
            # downloading ImageNet initialization weights at startup.
            model = models.efficientnet_b0(weights=None)
            model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, 2)
            state_dict = torch.load(
                MODEL_PATH,
                map_location=device,
                weights_only=True,
            )
            if isinstance(state_dict, dict) and "state_dict" in state_dict:
                state_dict = state_dict["state_dict"]
            elif isinstance(state_dict, dict) and "model_state_dict" in state_dict:
                state_dict = state_dict["model_state_dict"]
            if isinstance(state_dict, dict) and state_dict and all(
                key.startswith("model.") for key in state_dict
            ):
                state_dict = {key.removeprefix("model."): value for key, value in state_dict.items()}
            model.load_state_dict(state_dict, strict=True)
            model.to(device)
            model.eval()
            face_detector = MTCNN(
                image_size=224,
                margin=20,
                keep_all=False,
                post_process=False,
                select_largest=True,
                thresholds=[0.5, 0.6, 0.6],
                device=device,
            )
        except ImageModelUnavailable:
            raise
        except Exception as exc:
            raise ImageModelUnavailable(
                "The image model could not be loaded. Check that the weights match "
                "the EfficientNet-B0 architecture."
            ) from exc

        _model, _face_detector, _torch, _device = model, face_detector, torch, device
        return _model, _face_detector, _torch, _device


@lru_cache(maxsize=1)
def _image_transform():
    try:
        from torchvision import transforms
    except Exception as exc:
        raise ImageModelUnavailable(
            "PyTorch and torchvision are required for image analysis. "
            "Install the backend requirements and restart the server."
        ) from exc

    return transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ]
    )


def predict_image(image_bytes: bytes) -> dict:
    """Return the team's REAL/FAKE prediction for uploaded image bytes."""
    try:
        from PIL import Image, UnidentifiedImageError
    except ImportError as exc:
        raise ImageModelUnavailable(
            "Pillow is required for image analysis. Install the backend requirements."
        ) from exc

    try:
        with Image.open(BytesIO(image_bytes)) as source:
            image = source.convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise InvalidImageError("The uploaded file is not a valid image.") from exc

    model, face_detector, torch, device = _load_model()
    face = face_detector(image)
    if face is None:
        face_image = image
    else:
        face_array = face.permute(1, 2, 0).cpu().numpy().clip(0, 255).astype("uint8")
        face_image = Image.fromarray(face_array)

    tensor = _image_transform()(face_image).unsqueeze(0).to(device)
    with torch.inference_mode():
        probabilities = torch.softmax(model(tensor), dim=1)[0].cpu()

    # The team's ImageFolder labels use 0 = FAKE and 1 = REAL.
    fake_probability = float(probabilities[0].item())
    real_probability = float(probabilities[1].item())
    prediction = "FAKE" if fake_probability >= real_probability else "REAL"
    confidence = max(real_probability, fake_probability)

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
        "confidence": round(confidence * 100, 2),
        "real_probability": round(real_probability, 6),
        "fake_probability": round(fake_probability, 6),
        "threat_level": threat_level,
    }
