import io
import os

from PIL import Image, ImageOps

MAX_DIMENSIONS = {
    "avatars": 800,
    "bulletin-logos": 800,
    "media": 1600,
}
DEFAULT_MAX_DIMENSION = 1600
JPEG_QUALITY = 82

try:
    _LANCZOS = Image.Resampling.LANCZOS
except AttributeError:  # Pillow < 9.1
    _LANCZOS = Image.LANCZOS


def optimize_image(file, folder: str = "uploads"):
    """Transpose EXIF, flatten alpha onto white, cap the long side, save JPEG."""
    file.seek(0)
    image = Image.open(file)
    if getattr(image, "is_animated", False):
        image.seek(0)
        image = image.copy()

    transposed = ImageOps.exif_transpose(image)
    if transposed is not None:
        image = transposed

    image = _flatten_to_rgb(image)
    limit = MAX_DIMENSIONS.get(folder, DEFAULT_MAX_DIMENSION)
    if image.width > limit or image.height > limit:
        image.thumbnail((limit, limit), _LANCZOS)

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    buffer.seek(0)
    original_name = getattr(file, "name", None) or "image"
    stem = os.path.splitext(os.path.basename(original_name))[0] or "image"
    buffer.name = f"{stem}.jpg"
    buffer.content_type = "image/jpeg"
    return buffer


def _flatten_to_rgb(image: Image.Image) -> Image.Image:
    has_alpha = image.mode in ("RGBA", "LA") or (
        image.mode == "P" and "transparency" in image.info
    )
    if has_alpha:
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, (255, 255, 255))
        background.paste(rgba, mask=rgba.split()[-1])
        return background
    if image.mode != "RGB":
        return image.convert("RGB")
    return image
