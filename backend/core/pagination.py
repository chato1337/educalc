"""Global limit/offset pagination for list endpoints."""

import os

from rest_framework.pagination import LimitOffsetPagination

_DEFAULT = int(os.getenv("API_DEFAULT_LIMIT", "20"))
_MAX = int(os.getenv("API_MAX_LIMIT", "500"))


class StandardLimitOffsetPagination(LimitOffsetPagination):
    """Limit/offset pagination with a configurable default and hard cap on page size."""

    default_limit = _DEFAULT
    max_limit = _MAX
