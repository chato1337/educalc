"""Shared OpenAPI / drf-spectacular helpers for ViewSets."""
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema


def bulk_csv_load_schema(
    *,
    summary: str,
    description: str,
    tags: list,
    request_serializer,
    response_serializer=None,
    response_description=None,
):
    """
    OpenAPI for POST ``bulk-load`` actions (multipart CSV).

    ``methods=['POST']`` is required so drf-spectacular registers the operation on custom actions.
    """
    stats_description = (
        response_description
        or "Loader statistics: created/updated counts, rows_processed, rows_skipped, errors[]."
    )
    return extend_schema(
        summary=summary,
        description=description,
        tags=tags,
        methods=["POST"],
        request={"multipart/form-data": request_serializer},
        responses={
            200: OpenApiResponse(
                response=response_serializer or OpenApiTypes.OBJECT,
                description=stats_description,
            ),
            400: OpenApiResponse(
                response=OpenApiTypes.OBJECT,
                description='Validation failure or {"error": "..."}.',
            ),
        },
    )


def openapi_error_response(description="Error payload with an ``error`` message."):
    return {
        400: OpenApiResponse(
            response=OpenApiTypes.OBJECT,
            description=description,
        ),
        404: OpenApiResponse(
            response=OpenApiTypes.OBJECT,
            description="Resource not found.",
        ),
    }
