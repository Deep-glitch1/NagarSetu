from fastapi import APIRouter, UploadFile, File, HTTPException

from app.services.classifier import classify_photo


router = APIRouter(
    prefix="/ml",
    tags=["Machine Learning"],
)


@router.post("/classify")
async def classify_image(
    file: UploadFile = File(...)
):
    """
    Classify an uploaded complaint image.
    """

    # Basic image validation
    if not file.content_type:
        raise HTTPException(
            status_code=400,
            detail="File type could not be determined."
        )

    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Only image files are allowed."
        )

    # Read uploaded image
    photo_bytes = await file.read()

    if not photo_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty."
        )

    try:
        result = classify_photo(photo_bytes)

        return {
            "success": True,
            "filename": file.filename,
            "prediction": result["category_code"],
            "confidence": result["confidence"],
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Image classification failed: {str(e)}"
        )