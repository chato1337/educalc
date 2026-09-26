import logging
import os
from typing import Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class S3Service:
    def __init__(self, access_key, secret_key, region, bucket, custom_domain=None, endpoint_url=None):
        client_config = {
            "aws_access_key_id": access_key,
            "aws_secret_access_key": secret_key,
            "region_name": region,
        }
        if endpoint_url:
            client_config["endpoint_url"] = endpoint_url

        self.s3_client = boto3.client("s3", **client_config)
        self.bucket_name = bucket
        self.custom_domain = custom_domain
        self.endpoint_url = endpoint_url
        self.region = region

    def upload_file(self, file_obj, key: str, content_type: str = None) -> Optional[str]:
        try:
            extra_args = {}
            if content_type:
                extra_args["ContentType"] = content_type
            self.s3_client.upload_fileobj(file_obj, self.bucket_name, key, ExtraArgs=extra_args)
            return self.get_file_url(key)
        except ClientError as exc:
            logger.error("Error uploading file: %s", exc)
            return None

    def delete_file(self, key: str) -> bool:
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            return True
        except ClientError as exc:
            logger.error("Error deleting file: %s", exc)
            return False

    def get_file_url(self, key: str) -> str:
        if self.custom_domain:
            return f"{self.custom_domain}/{self.bucket_name}/{key}"
        if self.endpoint_url:
            return f"{self.endpoint_url}/{self.bucket_name}/{key}"
        return f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{key}"

    def generate_presigned_url(self, key: str, expiration: int = 3600) -> Optional[str]:
        try:
            return self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": key},
                ExpiresIn=expiration,
            )
        except ClientError as exc:
            logger.error("Error generating presigned URL: %s", exc)
            return None

    def file_exists(self, key: str) -> bool:
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=key)
            return True
        except ClientError:
            return False


def build_s3_service() -> S3Service:
    """Build a client from process env. Domain and endpoint share one variable."""
    custom_domain = _optional_env("AWS_S3_CUSTOM_DOMAIN")
    return S3Service(
        access_key=os.getenv("AWS_ACCESS_KEY_ID"),
        secret_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region=os.getenv("AWS_S3_REGION_NAME") or "us-east-1",
        bucket=os.getenv("AWS_STORAGE_BUCKET_NAME"),
        custom_domain=custom_domain,
        endpoint_url=custom_domain,
    )


def _optional_env(name: str) -> Optional[str]:
    value = (os.getenv(name) or "").strip()
    return value or None
