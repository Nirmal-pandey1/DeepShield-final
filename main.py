from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import logging
import os
from pathlib import Path
import uuid

from database import engine, Base, get_db
import db_models
import schemas
from auth import hash_password, verify_password, create_access_token, get_current_user
from image_detector import ImageModelUnavailable, InvalidImageError, predict_image

logger = logging.getLogger("deepshield")
app = FastAPI()
Base.metadata.create_all(bind=engine)

origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.get("/")
def health_check():
    return {"status": "ok"}


@app.post("/signup", response_model=schemas.UserOut)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(db_models.User).filter(db_models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = db_models.User(name=user.name, email=user.email, hashed_password=hash_password(user.password))
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(db_models.User).filter(db_models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/me", response_model=schemas.UserOut)
def get_me(current_user: db_models.User = Depends(get_current_user)):
    return current_user


ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".mp4", ".mov", ".avi", ".webm", ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"}
MAX_FILE_SIZE = 50 * 1024 * 1024
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads")).resolve()


@app.post("/upload", response_model=schemas.UploadOut, status_code=status.HTTP_201_CREATED)
async def upload_file(file: UploadFile = File(...), current_user: db_models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    original_name = (file.filename or "upload").replace("\\", "/").rsplit("/", 1)[-1]
    original_name = original_name[:255] or "upload"
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {extension or 'unknown'}")
    user_upload_dir = UPLOAD_DIR / str(current_user.id)
    stored_name = f"{uuid.uuid4().hex}{extension}"
    destination = user_upload_dir / stored_name
    try:
        user_upload_dir.mkdir(parents=True, exist_ok=True)
        size = 0
        with destination.open("xb") as uploaded_file:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    raise HTTPException(status_code=413, detail="File too large (max 50MB)")
                uploaded_file.write(chunk)
        upload = db_models.Upload(user_id=current_user.id, filename=original_name, stored_name=stored_name)
        db.add(upload)
        db.commit()
        db.refresh(upload)
        return upload
    except HTTPException:
        db.rollback()
        destination.unlink(missing_ok=True)
        raise
    except Exception:
        db.rollback()
        destination.unlink(missing_ok=True)
        logger.exception("Upload failed")
        raise HTTPException(status_code=500, detail="Upload failed. Please try again.")
    finally:
        await file.close()


@app.post("/analyze/image", response_model=schemas.ImageAnalysisOut, status_code=status.HTTP_201_CREATED)
async def analyze_image(file: UploadFile = File(...), current_user: db_models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    original_name = (file.filename or "upload").replace("\\", "/").rsplit("/", 1)[-1]
    original_name = original_name[:255] or "upload"
    extension = Path(original_name).suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png"}:
        raise HTTPException(status_code=400, detail="Image analysis accepts JPG, JPEG, and PNG files.")

    destination = None
    try:
        image_bytes = await file.read(MAX_FILE_SIZE + 1)
        if len(image_bytes) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large (max 50MB)")
        if not image_bytes:
            raise HTTPException(status_code=400, detail="The uploaded image is empty.")

        try:
            prediction = predict_image(image_bytes)
        except InvalidImageError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except ImageModelUnavailable as exc:
            logger.exception("Image model is unavailable")
            raise HTTPException(status_code=503, detail=str(exc)) from exc

        user_upload_dir = UPLOAD_DIR / str(current_user.id)
        stored_name = f"{uuid.uuid4().hex}{extension}"
        destination = user_upload_dir / stored_name
        user_upload_dir.mkdir(parents=True, exist_ok=True)
        with destination.open("xb") as uploaded_file:
            uploaded_file.write(image_bytes)

        upload = db_models.Upload(
            user_id=current_user.id,
            filename=original_name,
            stored_name=stored_name,
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)
        return {"upload": upload, **prediction}
    except HTTPException:
        db.rollback()
        if destination is not None:
            destination.unlink(missing_ok=True)
        raise
    except Exception:
        db.rollback()
        if destination is not None:
            destination.unlink(missing_ok=True)
        logger.exception("Image analysis failed")
        raise HTTPException(status_code=500, detail="Image analysis failed. Please try again.")
    finally:
        await file.close()


@app.get("/history", response_model=list[schemas.UploadOut])
def get_upload_history(current_user: db_models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(db_models.Upload).filter(db_models.Upload.user_id == current_user.id).order_by(db_models.Upload.created_at.desc()).all()
