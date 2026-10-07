import os
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from app.database import save_image_metadata, get_image_metadata, IMAGES_DIR
from app.models import ImageUploadResponse

router = APIRouter(prefix="/api")

ALLOWED_MIME_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp"
}

MAX_FILE_SIZE = 20 * 1024 * 1024

@router.post("/images", response_model=ImageUploadResponse)
async def upload_image(file: UploadFile = File(...)):
    mime_type = file.content_type or ""
    if mime_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type: {mime_type}. Allowed types: PNG, JPEG, GIF, WEBP"
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Image too large. Maximum size allowed is {MAX_FILE_SIZE // (1024*1024)} MB"
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    ext = ALLOWED_MIME_TYPES[mime_type.lower()]
    image_id = uuid.uuid4().hex[:12]
    filename = f"{image_id}{ext}"
    target_path = IMAGES_DIR / filename

    try:
        with open(target_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save image: {str(e)}")

    save_image_metadata(
        image_id=image_id,
        filename=filename,
        mime_type=mime_type,
        size=len(content)
    )

    return ImageUploadResponse(
        image_id=image_id,
        src=f"api/images/{image_id}",
        filename=filename,
        mime_type=mime_type,
        size=len(content)
    )

@router.get("/images/{image_id}")
async def get_image(image_id: str):
    safe_id = Path(image_id).name
    meta = get_image_metadata(safe_id)
    if not meta:
        matching_files = list(IMAGES_DIR.glob(f"{safe_id}.*"))
        if not matching_files:
            raise HTTPException(status_code=404, detail="Image not found")
        file_path = matching_files[0]
        mime_type = "image/png"
    else:
        file_path = IMAGES_DIR / meta["filename"]
        mime_type = meta["mime_type"]

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    return FileResponse(
        path=file_path,
        media_type=mime_type,
        filename=file_path.name
    )
