"""
NagarSetu image classification service.

EfficientNetV2-S model with 4 classes:
- GARBAGE
- GOOD_ROAD
- OTHER
- ROAD_DAMAGED
"""

from io import BytesIO
from typing import TypedDict

import torch
from PIL import Image, UnidentifiedImageError

from app.ml.predict import (
    model,
    transform,
    device,
    CLASS_NAMES,
)


class ClassificationResult(TypedDict):
    category_code: str
    confidence: float


def classify_photo( photo_bytes: bytes, ) -> ClassificationResult:

    if not photo_bytes:
        raise ValueError(
            "photo_bytes cannot be empty"
        )

    try:
        image = Image.open(
            BytesIO(photo_bytes)
        ).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError(
            "Uploaded file is not a valid image."
        ) from exc

    image_tensor = transform(image)
    image_tensor = image_tensor.unsqueeze(0)
    image_tensor = image_tensor.to(device)

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
    confidence = float(
        confidence.item()
    )

    if not 0 <= predicted_index < len(
        CLASS_NAMES
    ):
        raise RuntimeError(
            "Model returned an invalid class index."
        )

    return {
        "category_code":
            CLASS_NAMES[predicted_index],
        "confidence":
            confidence,
    }