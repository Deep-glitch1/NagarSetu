"""
ML Classifier Service — Algorithm 1

NagarSetu uses a CNN (MobileNetV2 + transfer learning) to classify
a citizen's complaint photo into one of five civic categories:

    POTHOLE, GARBAGE, STREET_LIGHT, WATER_LEAK, ROAD_DAMAGE

STATUS: STUB
-----------
The real trained model is not ready yet. This module returns a
fixed category so that the rest of the complaint pipeline
(duplicate detection, routing, priority scoring, DB persistence)
can be built and tested independently of ML training.

REPLACEMENT PLAN
----------------
When the real model is trained:

    1. Save it to: app/models/civic_classifier.keras
    2. Replace the body of classify_photo() below.
    3. Do NOT change the return signature — the pipeline depends on it.

The rest of the system will continue working without any changes.
"""

from typing import TypedDict


class ClassificationResult(TypedDict):
    category_code: str   # UPPERCASE code matching complaint_categories.code
    confidence: float    # 0.0 – 1.0


# The five categories the real model will be trained on.
# These MUST match the codes in the complaint_categories table.
SUPPORTED_CATEGORIES = (
    "POTHOLE",
    "GARBAGE",
    "STREET_LIGHT",
    "WATER_LEAK",
    "ROAD_DAMAGE",
)


def classify_photo(photo_bytes: bytes) -> ClassificationResult:
    """
    Classify a civic complaint photo into a category.

    Parameters
    ----------
    photo_bytes : bytes
        Raw bytes of the uploaded image file.

    Returns
    -------
    ClassificationResult
        A dict with two keys:
            category_code : str   — matches complaint_categories.code
            confidence    : float — 0.0 to 1.0

    Notes
    -----
    STUB IMPLEMENTATION.
    Always returns POTHOLE with confidence 0.95.

    The real implementation will:
        1. Load civic_classifier.keras into memory at app startup.
        2. Resize the incoming image to 224x224.
        3. Normalise pixel values to 0–1.
        4. Run inference.
        5. Apply argmax to pick the winning class.
    """

    # --------------------------------------------------------
    # Sanity check — reject empty input even in stub mode.
    # --------------------------------------------------------

    if not photo_bytes:
        raise ValueError("classify_photo received empty photo bytes")

    # --------------------------------------------------------
    # STUB RETURN
    # --------------------------------------------------------

    return {
        "category_code": "POTHOLE",
        "confidence": 0.95,
    }