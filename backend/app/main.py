from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.services.image_processor import ImageProcessor


def create_app(storage_dir: Optional[Path] = None) -> FastAPI:
    app = FastAPI(title="Darkroom API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.state.image_processor = ImageProcessor(
        storage_dir or Path(__file__).resolve().parents[1] / "storage"
    )
    app.include_router(router, prefix="/api")
    return app


app = create_app()
