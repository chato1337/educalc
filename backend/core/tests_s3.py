import io
from unittest.mock import patch

from botocore.exceptions import ClientError
from django.test import SimpleTestCase
from PIL import Image
from rest_framework import status

from core.services.file_utils import (
    BadRequest,
    StorageError,
    delete_file_from_s3,
    upload_file_to_s3,
    upload_for_resource,
)
from core.services.image_utils import optimize_image
from core.services.s3_service import S3Service, build_s3_service


class _Upload:
    def __init__(self, name, content_type, data: bytes):
        self.name = name
        self.content_type = content_type
        self._buffer = io.BytesIO(data)

    def read(self, *args):
        return self._buffer.read(*args)

    def seek(self, *args):
        return self._buffer.seek(*args)

    def tell(self):
        return self._buffer.tell()


class _Resource:
    def __init__(self, file_url=None):
        self.file_url = file_url
        self.saved = 0

    def save(self):
        self.saved += 1


class _FakeS3:
    def __init__(self, bucket_name="educalc", url=None, fail=False):
        self.bucket_name = bucket_name
        self.url = url
        self.fail = fail
        self.uploads = []
        self.deleted = []

    def upload_file(self, file_obj, key, content_type=None):
        self.uploads.append((key, content_type, file_obj.read()))
        if self.fail:
            return None
        if self.url:
            return self.url
        return f"https://cdn.example.com/{self.bucket_name}/{key}"

    def delete_file(self, key):
        self.deleted.append(key)
        return True


def _client_error(operation: str) -> ClientError:
    return ClientError({"Error": {"Code": "403", "Message": "denied"}}, operation)


def _jpeg_bytes(size, color="red", exif_orientation=None) -> bytes:
    image = Image.new("RGB", size, color)
    buffer = io.BytesIO()
    save_kwargs = {"format": "JPEG"}
    if exif_orientation is not None:
        exif = image.getexif()
        exif[274] = exif_orientation
        save_kwargs["exif"] = exif
    image.save(buffer, **save_kwargs)
    return buffer.getvalue()


class S3ServiceTests(SimpleTestCase):
    def _service(self, **kwargs):
        params = {
            "access_key": "AKI",
            "secret_key": "SECRET",
            "region": "us-east-1",
            "bucket": "educalc",
        }
        params.update(kwargs)
        with patch("core.services.s3_service.boto3.client") as client:
            service = S3Service(**params)
        return service, client

    def test_client_omits_endpoint_without_domain(self):
        _service, client = self._service()
        client.assert_called_once_with(
            "s3",
            aws_access_key_id="AKI",
            aws_secret_access_key="SECRET",
            region_name="us-east-1",
        )

    def test_client_uses_domain_as_endpoint(self):
        _service, client = self._service(
            custom_domain="https://cdn.example.com",
            endpoint_url="https://cdn.example.com",
        )
        self.assertEqual(
            client.call_args.kwargs["endpoint_url"],
            "https://cdn.example.com",
        )

    def test_upload_sends_content_type_and_returns_public_url(self):
        service, _client = self._service(custom_domain="https://cdn.example.com")
        body = io.BytesIO(b"data")
        url = service.upload_file(body, "media/file.jpg", content_type="image/jpeg")
        self.assertEqual(url, "https://cdn.example.com/educalc/media/file.jpg")
        extra = service.s3_client.upload_fileobj.call_args.kwargs["ExtraArgs"]
        self.assertEqual(extra, {"ContentType": "image/jpeg"})

    def test_upload_without_content_type_sends_no_extra_args(self):
        service, _client = self._service()
        service.upload_file(io.BytesIO(b"data"), "docs/file.pdf")
        extra = service.s3_client.upload_fileobj.call_args.kwargs["ExtraArgs"]
        self.assertEqual(extra, {})

    def test_upload_client_error_returns_none_without_logging_secret(self):
        service, _client = self._service()
        service.s3_client.upload_fileobj.side_effect = _client_error("PutObject")
        with self.assertLogs("core.services.s3_service", level="ERROR") as logs:
            url = service.upload_file(io.BytesIO(b"data"), "media/file.jpg")
        self.assertIsNone(url)
        self.assertNotIn("SECRET", "\n".join(logs.output))

    def test_delete_and_presigned_url(self):
        service, _client = self._service()
        self.assertTrue(service.delete_file("media/file.jpg"))
        service.s3_client.delete_object.assert_called_once_with(
            Bucket="educalc", Key="media/file.jpg"
        )
        service.s3_client.generate_presigned_url.return_value = "https://signed"
        signed = service.generate_presigned_url("media/file.jpg")
        self.assertEqual(signed, "https://signed")
        service.s3_client.generate_presigned_url.assert_called_once_with(
            "get_object",
            Params={"Bucket": "educalc", "Key": "media/file.jpg"},
            ExpiresIn=3600,
        )

    def test_delete_and_presign_client_error(self):
        service, _client = self._service()
        service.s3_client.delete_object.side_effect = _client_error("DeleteObject")
        service.s3_client.generate_presigned_url.side_effect = _client_error("GetObject")
        with self.assertLogs("core.services.s3_service", level="ERROR"):
            self.assertFalse(service.delete_file("media/file.jpg"))
            self.assertIsNone(service.generate_presigned_url("media/file.jpg", expiration=60))

    def test_file_exists_treats_any_client_error_as_missing(self):
        service, _client = self._service()
        self.assertTrue(service.file_exists("media/file.jpg"))
        service.s3_client.head_object.side_effect = _client_error("HeadObject")
        self.assertFalse(service.file_exists("media/missing.jpg"))

    def test_public_url_order(self):
        with_domain, _client = self._service(
            custom_domain="https://cdn.example.com",
            endpoint_url="https://minio.internal",
        )
        self.assertEqual(
            with_domain.get_file_url("media/a.jpg"),
            "https://cdn.example.com/educalc/media/a.jpg",
        )
        endpoint_only, _client = self._service(
            custom_domain=None,
            endpoint_url="https://minio.internal",
        )
        self.assertEqual(
            endpoint_only.get_file_url("media/a.jpg"),
            "https://minio.internal/educalc/media/a.jpg",
        )
        aws, _client = self._service()
        self.assertEqual(
            aws.get_file_url("media/a.jpg"),
            "https://educalc.s3.us-east-1.amazonaws.com/media/a.jpg",
        )

    @patch("core.services.s3_service.boto3.client")
    def test_build_s3_service_reads_env(self, _client):
        env = {
            "AWS_ACCESS_KEY_ID": "AKI",
            "AWS_SECRET_ACCESS_KEY": "SECRET",
            "AWS_STORAGE_BUCKET_NAME": "educalc",
            "AWS_S3_REGION_NAME": "",
            "AWS_S3_CUSTOM_DOMAIN": "https://cdn.example.com",
            "AWS_DEFAULT_ACL": "public-read",
        }
        with patch.dict("os.environ", env, clear=False):
            service = build_s3_service()
        self.assertEqual(service.region, "us-east-1")
        self.assertEqual(service.bucket_name, "educalc")
        self.assertEqual(service.custom_domain, "https://cdn.example.com")
        self.assertEqual(service.endpoint_url, "https://cdn.example.com")
        self.assertEqual(
            _client.call_args.kwargs["aws_access_key_id"],
            "AKI",
        )


class ImageOptimizationTests(SimpleTestCase):
    def test_large_image_becomes_jpeg_within_folder_limit(self):
        uploaded = _Upload("photo.png", "image/png", _jpeg_bytes((2000, 1000)))
        optimized = optimize_image(uploaded, folder="avatars")
        image = Image.open(optimized)
        self.assertEqual(image.format, "JPEG")
        self.assertEqual(optimized.name, "photo.jpg")
        self.assertEqual(optimized.content_type, "image/jpeg")
        self.assertLessEqual(max(image.size), 800)
        self.assertEqual(image.size, (800, 400))

    def test_small_image_keeps_size_and_becomes_jpeg(self):
        uploaded = _Upload("icon.webp", "image/webp", _jpeg_bytes((40, 20), color="blue"))
        optimized = optimize_image(uploaded, folder="media")
        image = Image.open(optimized)
        self.assertEqual(image.format, "JPEG")
        self.assertEqual(image.size, (40, 20))

    def test_alpha_is_flattened_onto_white(self):
        image = Image.new("RGBA", (32, 32), (255, 0, 0, 0))
        for x in range(16):
            for y in range(32):
                image.putpixel((x, y), (255, 0, 0, 255))
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        optimized = optimize_image(_Upload("mark.png", "image/png", buffer.getvalue()))
        result = Image.open(optimized)
        self.assertEqual(result.mode, "RGB")
        red = result.getpixel((4, 4))
        white = result.getpixel((28, 4))
        self.assertGreater(red[0], 250)
        self.assertLess(red[1], 5)
        self.assertLess(red[2], 5)
        self.assertGreater(min(white), 250)

    def test_animated_gif_keeps_first_frame_as_jpeg(self):
        frames = [
            Image.new("RGB", (10, 10), "red"),
            Image.new("RGB", (10, 10), "blue"),
        ]
        buffer = io.BytesIO()
        frames[0].save(
            buffer,
            format="GIF",
            save_all=True,
            append_images=frames[1:],
            duration=100,
            loop=0,
        )
        optimized = optimize_image(_Upload("anim.gif", "image/gif", buffer.getvalue()))
        result = Image.open(optimized)
        self.assertEqual(result.format, "JPEG")
        self.assertEqual(result.size, (10, 10))
        red, green, blue = result.getpixel((0, 0))
        self.assertGreater(red, 250)
        self.assertLess(green, 5)
        self.assertLess(blue, 5)

    def test_exif_orientation_is_applied(self):
        uploaded = _Upload(
            "turned.jpg",
            "image/jpeg",
            _jpeg_bytes((20, 10), exif_orientation=6),
        )
        result = Image.open(optimize_image(uploaded, folder="media"))
        self.assertEqual(result.size, (10, 20))


class FilePipelineTests(SimpleTestCase):
    def test_image_upload_uses_folder_prefix_and_jpeg(self):
        s3 = _FakeS3()
        uploaded = _Upload("scan.PNG", "image/png", _jpeg_bytes((30, 30)))
        url = upload_file_to_s3(uploaded, folder="media", s3=s3)
        key, content_type, body = s3.uploads[0]
        self.assertRegex(key, r"^media/[0-9a-f-]{36}\.jpg$")
        self.assertEqual(content_type, "image/jpeg")
        self.assertTrue(body.startswith(b"\xff\xd8"))
        self.assertEqual(url, f"https://cdn.example.com/educalc/{key}")

    def test_non_image_keeps_extension_and_bytes(self):
        s3 = _FakeS3()
        uploaded = _Upload("notes.txt", "text/plain", b"hola")
        upload_file_to_s3(uploaded, folder="uploads", s3=s3)
        key, content_type, body = s3.uploads[0]
        self.assertRegex(key, r"^uploads/[0-9a-f-]{36}\.txt$")
        self.assertEqual(content_type, "text/plain")
        self.assertEqual(body, b"hola")

    def test_optimization_failure_uploads_original(self):
        s3 = _FakeS3()
        uploaded = _Upload("broken.png", "image/png", b"not-an-image")
        with self.assertLogs("core.services.file_utils", level="ERROR"):
            upload_file_to_s3(uploaded, folder="media", s3=s3)
        key, content_type, body = s3.uploads[0]
        self.assertTrue(key.endswith(".png"))
        self.assertEqual(content_type, "image/png")
        self.assertEqual(body, b"not-an-image")

    def test_delete_extracts_key_after_bucket(self):
        s3 = _FakeS3()
        delete_file_from_s3("https://cdn.example.com/educalc/media/file.jpg", s3=s3)
        self.assertEqual(s3.deleted, ["media/file.jpg"])

    def test_delete_extracts_virtual_hosted_key(self):
        s3 = _FakeS3()
        delete_file_from_s3(
            "https://educalc.s3.us-east-1.amazonaws.com/avatars/file.jpg",
            s3=s3,
        )
        self.assertEqual(s3.deleted, ["avatars/file.jpg"])

    def test_delete_without_bucket_uses_filename_only(self):
        s3 = _FakeS3()
        delete_file_from_s3("https://other.example.com/media/file.jpg", s3=s3)
        self.assertEqual(s3.deleted, ["file.jpg"])

    def test_delete_empty_url_skips_client(self):
        with patch("core.services.file_utils.build_s3_service") as build:
            self.assertFalse(delete_file_from_s3(""))
            self.assertFalse(delete_file_from_s3(None))
        build.assert_not_called()


class UploadForResourceTests(SimpleTestCase):
    def test_upload_persists_url(self):
        resource = _Resource(file_url="https://cdn.example.com/educalc/media/old.jpg")
        uploaded = _Upload("new.png", "image/png", _jpeg_bytes((20, 20)))
        with patch("core.services.file_utils.delete_file_from_s3", return_value=True) as delete_mock, patch(
            "core.services.file_utils.upload_file_to_s3",
            return_value="https://cdn.example.com/media/file.jpg",
        ) as upload_mock:
            url = upload_for_resource(resource, uploaded, folder="media")
        delete_mock.assert_called_once_with("https://cdn.example.com/educalc/media/old.jpg")
        upload_mock.assert_called_once()
        self.assertEqual(upload_mock.call_args.kwargs["folder"], "media")
        self.assertEqual(url, "https://cdn.example.com/media/file.jpg")
        self.assertEqual(resource.file_url, url)
        self.assertEqual(resource.saved, 1)

    def test_missing_file_does_not_change_url(self):
        resource = _Resource(file_url="https://cdn.example.com/media/old.jpg")
        with patch("core.services.file_utils.delete_file_from_s3") as delete_mock, patch(
            "core.services.file_utils.upload_file_to_s3"
        ) as upload_mock:
            with self.assertRaises(BadRequest) as caught:
                upload_for_resource(resource, None, folder="media")
        self.assertEqual(caught.exception.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(caught.exception), "file is required")
        self.assertEqual(resource.file_url, "https://cdn.example.com/media/old.jpg")
        self.assertEqual(resource.saved, 0)
        delete_mock.assert_not_called()
        upload_mock.assert_not_called()

    def test_unsupported_type_does_not_change_url(self):
        resource = _Resource(file_url="https://cdn.example.com/media/old.jpg")
        uploaded = _Upload("notes.txt", "text/plain", b"hola")
        with self.assertRaises(BadRequest) as caught:
            upload_for_resource(resource, uploaded, folder="media")
        self.assertEqual(str(caught.exception), "unsupported file type")
        self.assertEqual(resource.file_url, "https://cdn.example.com/media/old.jpg")
        self.assertEqual(resource.saved, 0)

    def test_failed_upload_does_not_write_url(self):
        resource = _Resource(file_url="https://cdn.example.com/media/old.jpg")
        uploaded = _Upload("new.png", "image/png", _jpeg_bytes((20, 20)))
        with patch("core.services.file_utils.delete_file_from_s3", return_value=False), patch(
            "core.services.file_utils.upload_file_to_s3",
            return_value=None,
        ):
            with self.assertRaises(StorageError) as caught:
                upload_for_resource(resource, uploaded, folder="avatars")
        self.assertEqual(caught.exception.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(resource.file_url, "https://cdn.example.com/media/old.jpg")
        self.assertEqual(resource.saved, 0)

    def test_url_field_writes_the_named_attribute(self):
        resource = _Resource()
        resource.crest_url = "https://cdn.example.com/old.jpg"
        uploaded = _Upload("new.png", "image/png", _jpeg_bytes((20, 20)))
        with patch("core.services.file_utils.delete_file_from_s3", return_value=True) as delete_mock, patch(
            "core.services.file_utils.upload_file_to_s3",
            return_value="https://cdn.example.com/bulletin-logos/new.jpg",
        ):
            url = upload_for_resource(
                resource,
                uploaded,
                folder="bulletin-logos",
                url_field="crest_url",
            )
        delete_mock.assert_called_once_with("https://cdn.example.com/old.jpg")
        self.assertEqual(url, "https://cdn.example.com/bulletin-logos/new.jpg")
        self.assertEqual(resource.crest_url, url)
        self.assertIsNone(resource.file_url)

    def test_delete_failure_still_persists_new_url(self):
        resource = _Resource(file_url="https://cdn.example.com/media/old.jpg")
        uploaded = _Upload("new.jpg", "image/jpeg", _jpeg_bytes((20, 20)))
        with patch("core.services.file_utils.delete_file_from_s3", return_value=False), patch(
            "core.services.file_utils.upload_file_to_s3",
            return_value="https://cdn.example.com/avatars/new.jpg",
        ):
            url = upload_for_resource(resource, uploaded, folder="avatars")
        self.assertEqual(url, "https://cdn.example.com/avatars/new.jpg")
        self.assertEqual(resource.saved, 1)
