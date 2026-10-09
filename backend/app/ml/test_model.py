from pathlib import Path
from predict import predict_image


BASE_DIR = Path(__file__).resolve().parent

IMAGE_PATH = BASE_DIR / "test_image.jpg"


result = predict_image(IMAGE_PATH)

print(result)