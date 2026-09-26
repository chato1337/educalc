# Configuraciones de la institución

Primera pieza de la ficha institucional configurable. El boletín ya no usa imágenes fijas: cada institución guarda la URL pública de sus dos escudos.

## Quién

| Rol | Lee la institución | Sube escudos |
| --- | --- | --- |
| ADMIN | Todas | Cualquier institución de su alcance |
| COORDINATOR | La suya | Solo la suya |
| TEACHER, PARENT | La suya, si el listado se la devuelve | No (403) |

El PDF del boletín lo arma el servidor con la institución de la matrícula. No depende de quién lo descarga.

## Datos

En `Institution`:

| Campo | Uso |
| --- | --- |
| `bulletin_logo_left_url` | Escudo a la izquierda del nombre |
| `bulletin_logo_right_url` | Escudo a la derecha del nombre |

Son de solo lectura en el CRUD. Solo cambian con la subida. Vacío significa que el boletín no pinta ese lado.

## Acciones

`POST /api/institutions/{id}/bulletin-logo-left/` y `.../bulletin-logo-right/`.

Multipart, campo `file`. Tipos: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`.

1. Sin archivo o tipo no permitido → 400. La URL guardada no cambia.
2. Si ya había URL, se intenta borrar el objeto anterior. Un fallo de borrado no detiene la subida.
3. La imagen pasa por el pipeline S3 en la carpeta `bulletin-logos` (lado máximo 800 px, JPEG).
4. Si la subida no devuelve URL → 500. No se escribe la URL nueva.
5. Si sale bien → 200 con la institución y la URL nueva.

Un coordinador que apunta a otra institución recibe 404.

## Boletín

`build_bulletin_context` copia las dos URLs de la institución. Si están vacías, la plantilla omite el `<img>`. Las URLs que antes estaban fijas en el servicio ya no se usan: hay que subir los escudos de cada institución una vez.

## Archivos

| Área | Ruta |
| --- | --- |
| Modelo | `backend/core/models.py`, migración `0017_institution_bulletin_logos` |
| API | `InstitutionViewSet.bulletin_logo_left` / `bulletin_logo_right` |
| Boletín | `backend/core/bulletin_service.py` |
| Pruebas | `backend/core/tests_bulletin_logos.py` |
| UI | `frontend/src/features/institutions/BulletinLogosPage.tsx` |
| Menú | `/bulletin-logos`, roles ADMIN y COORDINATOR |

## Pruebas

```bash
cd backend && pipenv run python manage.py test core.tests_bulletin_logos -v1
```
