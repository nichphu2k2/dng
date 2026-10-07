from typing import List, Literal, Optional, Union
from pydantic import BaseModel, Field

class TextBlock(BaseModel):
    type: Literal["text"] = "text"
    content: str = ""

class ImageBlock(BaseModel):
    type: Literal["image"] = "image"
    id: str
    src: Optional[str] = ""

DocumentBlock = Union[TextBlock, ImageBlock]

class DocumentModel(BaseModel):
    type: Literal["document"] = "document"
    blocks: List[DocumentBlock] = Field(default_factory=list)

class DocumentState(BaseModel):
    id: int = 1
    line1: str = ""
    line2: str = ""
    line3: str = ""
    content: str = ""
    version: int = 1
    updated_at: str = ""

class DocumentUpdateRequest(BaseModel):
    line1: str
    line2: str
    line3: str
    content: str
    version: Optional[int] = None

class ImageUploadResponse(BaseModel):
    image_id: str
    src: str
    filename: str
    mime_type: str
    size: int
