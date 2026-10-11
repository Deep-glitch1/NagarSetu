"""
NagarSetu image classification service.

EfficientNetV2-S model with 4 classes:
- GARBAGE
- GOOD_ROAD
- OTHER
- ROAD_DAMAGED
"""

from typing import TypedDict

from PIL import Image
import io


# ============================================================
# RESULT TYPE
# ============================================================

class ClassificationResult(TypedDict):
    category_code: str
    confidence: float


# ============================================================
# CLASSIFICATION
# ============================================================

def classify_photo(photo_bytes: bytes) -> ClassificationResult:
    """
    Classify a citizen-submitted complaint photo.

    Args:
        photo_bytes: Raw image bytes.

    Returns:
        {
            "category_code": "ROAD_DAMAGED",
            "confidence": 0.95
        }
    """

    if not photo_bytes:
        raise ValueError("photo_bytes cannot be empty")

    try:
        from app.ml.predict import (
            model,
            transform,
            device,
            CLASS_NAMES,
        )
        import torch
    except (FileNotFoundError, PermissionError) as exc:
        raise RuntimeError(
            "Image classification is unavailable because the trained model "
            "file is missing or is not a readable file."
        ) from exc

    # Convert bytes -> PIL Image
    image = Image.open(
        io.BytesIO(photo_bytes)
    ).convert("RGB")

    # Same preprocessing used during training
    image_tensor = transform(image)

    # Add batch dimension
    image_tensor = image_tensor.unsqueeze(0)

    # Move to CPU/GPU
    image_tensor = image_tensor.to(device)

    # Prediction
    with torch.no_grad():

        output = model(image_tensor)

        probabilities = torch.softmax(
            output,
            dim=1
        )

        confidence, predicted_index = torch.max(
            probabilities,
            dim=1
        )

    predicted_index = predicted_index.item()
    confidence = confidence.item()

    return {
        "category_code": CLASS_NAMES[predicted_index],
        "confidence": float(confidence),
    }