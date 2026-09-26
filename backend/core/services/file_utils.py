import logging
import os
import uuid
from typing import Optional

from rest_framework import status
from rest_framework.exceptions import APIException

from core.services.image_utils import optimize_image
from core.services.s3_service import S3Service, build_s3_service

logger = logging.getLogger(__name__)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"}


class BadRequest(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Bad request"
    default_code = "bad_request"


class StorageError(APIException):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = "upload failed"
    default_code = "storage_error"


def generate_unique_filename(original_filename: str, prefix: str = "") -> str:
    _name, ext = os.path.splitext(original_filename)
    unique_id = str(uuid.uuid4())
    return f"{prefix}{unique_id}{ext}" if prefix else f"{unique_id}{ext}"


def upload_file_to_s3(file, folder: str = "uploads", s3: S3Service = None) -> Optional[str]:
    if _is_image(file):
        try:
            file = optimize_image(file, folder=folder)
        except Exception:
            logger.exception("Image optimization failed; uploading original")
            file.seek(0)

    s3 = s3 or build_s3_service()
    key = generate_unique_filename(file.name, f"{folder}/")
    return s3.upload_file(file_obj=file, key=key, content_type=file.content_type)


def delete_file_from_s3(file_url: str, s3: S3Service = None) -> bool:
    if not file_url:
        return False
    s3 = s3 or build_s3_service()
    return s3.delete_file(_extract_key(file_url, s3.bucket_name))


def upload_for_resource(resource, uploaded_file, folder: str, url_field: str = "file_url"):
    """Replace a stored URL. The endpoint calls this; it does not talk to the SDK."""
    if uploaded_file is None:
        raise BadRequest("file is required")
    if uploaded_file.content_type not in ALLOWED_IMAGE_TYPES:
        raise BadRequest("unsupported file type")

    current_url = getattr(resource, url_field)
    if current_url:
        delete_file_from_s3(current_url)

    file_url = upload_file_to_s3(uploaded_file, folder=folder)
    if not file_url:
        raise StorageError("upload failed")

    setattr(resource, url_field, file_url)
    resource.save()
    return file_url


def _is_image(file) -> bool:
    return (getattr(file, "content_type", None) or "").lower().startswith("image/")


def _extract_key(file_url: str, bucket_name: str) -> str:
    """Key after `{bucket}/`, or the object path of a virtual-hosted AWS URL."""
    if bucket_name:
        marker = f"{bucket_name}/"
        if marker in file_url:
            return file_url.split(marker)[-1]
        host = file_url.split("://", 1)[-1].split("/", 1)[0]
        if host.startswith(f"{bucket_name}.s3.") and host.endswith(".amazonaws.com"):
            _host, _sep, key = file_url.split("://", 1)[-1].partition("/")
            return key
        if bucket_name in file_url:
            return file_url.split(marker)[-1]
    return file_url.split("/")[-1]
