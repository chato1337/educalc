# Guía de implementación: almacenamiento S3

Cómo montar un cliente S3 (o compatible, por ejemplo MinIO) y un pipeline de subida en otro servicio. La base guarda una URL. El binario vive en el bucket.

Referencia de comportamiento: `services/s3_service.py`, `services/file_utils.py`, `services/image_utils.py`.

## Piezas

| Pieza | Responsabilidad |
| --- | --- |
| Cliente de almacenamiento | Credenciales, `upload`, `delete`, URL pública, URL firmada, existencia |
| Pipeline de archivos | Nombre único, optimización de imágenes, extracción de la key al borrar |
| Optimización de imagen | EXIF, recorte, JPEG antes de subir |
| Endpoint HTTP | Multipart, validar tipo, reemplazar la URL anterior, persistir la nueva |

El endpoint no habla con el SDK. Llama al pipeline. El pipeline instancia el cliente en cada operación.

```
archivo del request
    → validar presencia y tipo
    → borrar el objeto de la URL anterior, si existe
    → subir
         → si es imagen, optimizar; si falla, subir el original
         → key = {folder}/{uuid}{ext}
    → guardar la URL en el recurso
```

## Variables

| Variable | Uso |
| --- | --- |
| `AWS_ACCESS_KEY_ID` | Access key |
| `AWS_SECRET_ACCESS_KEY` | Secret key |
| `AWS_STORAGE_BUCKET_NAME` | Bucket |
| `AWS_S3_REGION_NAME` | Región. Default `us-east-1` |
| `AWS_S3_CUSTOM_DOMAIN` | Host público. Si tiene valor, también es el endpoint del cliente |
| `AWS_DEFAULT_ACL` | Opcional. El cliente de referencia no lo envía al subir |

Dependencia: `boto3`. Imágenes: Pillow.

`AWS_S3_ENDPOINT_URL` no se lee aparte. Endpoint y URL pública salen de `AWS_S3_CUSTOM_DOMAIN`:

```python
AWS_S3_CUSTOM_DOMAIN = os.getenv("AWS_S3_CUSTOM_DOMAIN")
AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_CUSTOM_DOMAIN")
```

- Con dominio: el SDK y la URL pública usan ese host. Sirve cuando un proxy expone la API y los objetos en el mismo origen.
- Sin dominio: no hay `endpoint_url` y la URL es `https://{bucket}.s3.{region}.amazonaws.com/{key}`.

No loguees la access key. Si dejas un log de arranque, recorta el valor y no lo copies a tickets.

## Cliente

```python
import logging
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
```

| Método | Entrada | Salida | Fallo |
| --- | --- | --- | --- |
| `upload_file` | File-like, key, MIME opcional | URL | `ClientError` → `None` |
| `delete_file` | Key | `True` | `ClientError` → `False` |
| `get_file_url` | Key | URL pública | No lanza |
| `generate_presigned_url` | Key, segundos (default 3600) | URL firmada de lectura | `ClientError` → `None` |
| `file_exists` | Key | `True` si `head_object` responde | Cualquier `ClientError` → `False` |

`upload_file` solo manda `ContentType`. No setea ACL. La visibilidad la define la policy del bucket o del proxy.

Orden de la URL:

1. `{custom_domain}/{bucket}/{key}`
2. `{endpoint_url}/{bucket}/{key}` si no hay dominio
3. URL virtual-hosted de AWS

Si dominio y endpoint se cargan de la misma variable, la rama 2 no se usa cuando el dominio está definido. La URL persistida no va firmada. `generate_presigned_url` queda para lectura temporal de un bucket privado.

## Pipeline de archivos

```python
import logging
import os
import uuid
from typing import Optional

logger = logging.getLogger(__name__)


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
    if s3.bucket_name in file_url:
        key = file_url.split(f"{s3.bucket_name}/")[-1]
    else:
        key = file_url.split("/")[-1]
    return s3.delete_file(key)


def _is_image(file) -> bool:
    return (getattr(file, "content_type", None) or "").lower().startswith("image/")
```

`build_s3_service()` lee la config del proceso y devuelve `S3Service`.

Key: `{folder}/{uuid}{ext}`. Tras optimizar una imagen, la extensión es `.jpg`. Un archivo que no es imagen se sube con su extensión.

Borrado:

- Si la URL contiene el nombre del bucket, la key es todo lo que va después de `{bucket}/`.
- Si no lo contiene, la key es solo el último segmento y se pierde el folder. Una URL de otro origen no apunta al objeto correcto.

La URL que arma `get_file_url` incluye el bucket, así que un reemplazo borra el objeto anterior.

## Imágenes

Solo si `content_type` empieza por `image/`. Si Pillow no abre el archivo, se sube el original. Un fallo de compresión no debe ser un 500.

| Parámetro | Valor de referencia |
| --- | --- |
| Lado máximo por defecto | 1600 px |
| Calidad JPEG | 82 |
| Mapa por folder | el servicio define el tope de cada prefijo |

Pasos: `exif_transpose` → RGB (fondo blanco si había alpha) → `thumbnail` LANCZOS si pasa el tope → JPEG con `optimize=True`. PNG, WebP y GIF estático salen `.jpg`. Un GIF animado queda en un solo frame.

```python
MAX_DIMENSIONS = {
    "avatars": 800,
    "media": 1600,
}
DEFAULT_MAX_DIMENSION = 1600
JPEG_QUALITY = 82
```

Tipos que el endpoint puede aceptar: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`. HEIC y AVIF quedan fuera de esa lista salvo que el servicio los agregue.

## Endpoint

El recurso ya existe. El upload es una acción aparte, no parte del alta.

1. Campo de URL nullable en el recurso.
2. Request multipart. Campo de archivo con nombre fijo.
3. Sin archivo o tipo no permitido → 400. No toques la URL guardada.
4. Si ya hay URL, llama `delete_file_from_s3`. El endpoint puede seguir aunque el delete falle.
5. `upload_file_to_s3(file, folder="...")`. El folder es el prefijo de la key y la clave del mapa de tamaños.
6. Si la subida devuelve vacío → 500. No escribas la URL. El objeto anterior ya se intentó borrar.
7. Persiste la URL nueva y devuélvela.

```python
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"}

def upload_for_resource(resource, uploaded_file, folder: str):
    if uploaded_file is None:
        raise BadRequest("file is required")
    if uploaded_file.content_type not in ALLOWED_IMAGE_TYPES:
        raise BadRequest("unsupported file type")

    if resource.file_url:
        delete_file_from_s3(resource.file_url)

    file_url = upload_file_to_s3(uploaded_file, folder=folder)
    if not file_url:
        raise StorageError("upload failed")

    resource.file_url = file_url
    resource.save()
    return file_url
```

Usa `S3Service` directo solo para URL firmada o `file_exists`. Subida y borrado pasan por el pipeline.

## Pruebas

Mockea el pipeline en los tests del endpoint. No hace falta bucket para validar 400, 500 y que la URL se guarda.

```python
def test_upload_persists_url(upload_mock, delete_mock):
    upload_mock.return_value = "https://cdn.example.com/media/file.jpg"
    # POST multipart → 200 y el recurso queda con esa URL

def test_missing_file_does_not_change_url():
    # sin archivo → 400 y la URL anterior sigue igual
```

La optimización se prueba en memoria: una imagen más grande que el tope del folder sale JPEG dentro del límite; una más chica conserva el tamaño y cambia a JPEG.

Contra un bucket real: key, secret, bucket y, si aplica, dominio. La respuesta trae la URL y el objeto queda en `{folder}/{uuid}.jpg`.

## Límites de esta implementación

- No hay borrado suelto: el objeto anterior se elimina solo al reemplazar la URL.
- El ACL del entorno no viaja en el upload.
- `file_exists` no distingue 403 de 404.
- Una URL sin el nombre del bucket se borra por el nombre de archivo, sin folder.
- El GIF animado se aplana a JPEG.
- No genera variantes ni thumbnails extra: un tamaño por folder.
