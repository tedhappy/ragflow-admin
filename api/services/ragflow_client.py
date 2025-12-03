#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import time
import logging
import httpx
from typing import Optional, Any
from ragflow_sdk import RAGFlow
from api.settings import settings


# Logger for this module
logger = logging.getLogger(__name__)

# Configuration for pagination
MAX_PAGE_SIZE = 10000  # Maximum items to fetch for counting
CACHE_TTL = 300  # Cache TTL in seconds (5 minutes)
HTTP_TIMEOUT = 30  # HTTP request timeout in seconds


class RAGFlowAPIError(Exception):
    """Custom exception for RAGFlow API errors."""
    
    def __init__(self, message: str, code: int = -1, details: Any = None):
        self.message = message
        self.code = code
        self.details = details
        super().__init__(self.message)


class TotalCountCache:
    """Simple cache for total counts to avoid repeated large queries."""
    
    def __init__(self, ttl: int = CACHE_TTL):
        self._cache: dict = {}
        self._ttl = ttl
    
    def get(self, key: str) -> Optional[int]:
        """Get cached total count if not expired."""
        if key in self._cache:
            value, timestamp = self._cache[key]
            if time.time() - timestamp < self._ttl:
                return value
            del self._cache[key]
        return None
    
    def set(self, key: str, value: int):
        """Cache total count with current timestamp."""
        self._cache[key] = (value, time.time())
    
    def invalidate(self, key: str = None):
        """Invalidate cache entry or all entries."""
        if key:
            self._cache.pop(key, None)
        else:
            self._cache.clear()


# Global cache instance
_total_cache = TotalCountCache()


def serialize_sdk_object(obj) -> dict:
    """Convert SDK object to dictionary for JSON serialization."""
    if hasattr(obj, '__dict__'):
        result = {}
        for key, value in obj.__dict__.items():
            if key.startswith('_'):
                continue
            if hasattr(value, '__dict__') and not isinstance(value, (str, int, float, bool, list, dict, type(None))):
                result[key] = serialize_sdk_object(value)
            else:
                result[key] = value
        return result
    return obj


class RAGFlowClient:
    """Async HTTP client for RAGFlow API with connection pooling."""
    
    _instance = None
    _client = None
    _http_client: Optional[httpx.AsyncClient] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._client is None:
            self._client = RAGFlow(
                api_key=settings.ragflow_api_key,
                base_url=settings.ragflow_base_url
            )
            self._api_url = f"{settings.ragflow_base_url}/api/v1"
            self._headers = {
                "Authorization": f"Bearer {settings.ragflow_api_key}",
                "Content-Type": "application/json"
            }

    @property
    def client(self) -> RAGFlow:
        return self._client

    def _get_http_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client with connection pooling."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                base_url=self._api_url,
                headers=self._headers,
                timeout=HTTP_TIMEOUT,
                limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
            )
        return self._http_client

    async def _get(self, path: str, params: dict = None) -> dict:
        """Make async GET request to RAGFlow API."""
        client = self._get_http_client()
        try:
            start_time = time.time()
            resp = await client.get(path, params=params)
            elapsed = time.time() - start_time
            logger.debug(f"GET {path} completed in {elapsed:.3f}s, status={resp.status_code}")
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error on GET {path}: {e.response.status_code}")
            raise RAGFlowAPIError(f"HTTP {e.response.status_code}", code=e.response.status_code)
        except httpx.RequestError as e:
            logger.error(f"Request error on GET {path}: {str(e)}")
            raise RAGFlowAPIError(f"Request failed: {str(e)}")

    async def _post(self, path: str, json: dict = None) -> dict:
        """Make async POST request to RAGFlow API."""
        client = self._get_http_client()
        try:
            start_time = time.time()
            resp = await client.post(path, json=json)
            elapsed = time.time() - start_time
            logger.debug(f"POST {path} completed in {elapsed:.3f}s, status={resp.status_code}")
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error on POST {path}: {e.response.status_code}")
            raise RAGFlowAPIError(f"HTTP {e.response.status_code}", code=e.response.status_code)
        except httpx.RequestError as e:
            logger.error(f"Request error on POST {path}: {str(e)}")
            raise RAGFlowAPIError(f"Request failed: {str(e)}")

    async def _delete(self, path: str, json: dict = None) -> dict:
        """Make async DELETE request to RAGFlow API."""
        client = self._get_http_client()
        try:
            start_time = time.time()
            resp = await client.request("DELETE", path, json=json)
            elapsed = time.time() - start_time
            logger.debug(f"DELETE {path} completed in {elapsed:.3f}s, status={resp.status_code}")
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error on DELETE {path}: {e.response.status_code}")
            raise RAGFlowAPIError(f"HTTP {e.response.status_code}", code=e.response.status_code)
        except httpx.RequestError as e:
            logger.error(f"Request error on DELETE {path}: {str(e)}")
            raise RAGFlowAPIError(f"Request failed: {str(e)}")
    
    async def close(self):
        """Close the HTTP client."""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
            self._http_client = None

    # Dataset operations (using HTTP to get accurate total count)
    async def list_datasets(self, page: int = 1, page_size: int = 20, **kwargs) -> dict:
        """List all datasets with pagination."""
        params = {
            "page": page,
            "page_size": page_size,
            "orderby": kwargs.get("orderby", "create_time"),
            "desc": kwargs.get("desc", True),
        }
        if kwargs.get("name"):
            params["name"] = kwargs["name"]
        if kwargs.get("id"):
            params["id"] = kwargs["id"]
        
        result = await self._get("/datasets", params=params)
        if result.get("code") == 0:
            # RAGFlow returns total_datasets for datasets count
            total = result.get("total") or result.get("total_datasets") or len(result.get("data", []))
            return {
                "items": result.get("data", []),
                "total": total
            }
        raise RAGFlowAPIError(result.get("message", "Failed to list datasets"))

    async def create_dataset(self, name: str, **kwargs) -> dict:
        """Create a new dataset."""
        payload = {"name": name, **kwargs}
        result = await self._post("/datasets", json=payload)
        if result.get("code") == 0:
            return result.get("data", {})
        raise RAGFlowAPIError(result.get("message", "Failed to create dataset"))

    async def delete_datasets(self, ids: list):
        """Delete datasets by IDs."""
        result = await self._delete("/datasets", json={"ids": ids})
        _total_cache.invalidate("datasets:")  # Invalidate datasets cache
        if result.get("code") != 0:
            raise RAGFlowAPIError(result.get("message", "Failed to delete datasets"))
        return result

    # Chat operations (RAGFlow API doesn't return total, so we fetch all and paginate)
    async def list_chats(self, page: int = 1, page_size: int = 20, **kwargs) -> dict:
        """List all chats with pagination."""
        cache_key = f"chats:{kwargs.get('name', '')}"
        
        # Build request params - fetch all for accurate count
        params = {
            "page": 1,
            "page_size": MAX_PAGE_SIZE,
            "orderby": kwargs.get("orderby", "create_time"),
            "desc": kwargs.get("desc", True),
        }
        if kwargs.get("name"):
            params["name"] = kwargs["name"]
        if kwargs.get("id"):
            params["id"] = kwargs["id"]
        
        result = await self._get("/chats", params=params)
        if result.get("code") == 0:
            all_items = result.get("data", [])
            total = len(all_items)
            
            # Update cache
            _total_cache.set(cache_key, total)
            
            # Manual pagination
            start = (page - 1) * page_size
            end = start + page_size
            items = all_items[start:end]
            return {
                "items": items,
                "total": total
            }
        raise RAGFlowAPIError(result.get("message", "Failed to list chats"))

    async def delete_chats(self, ids: list):
        """Delete chats by IDs."""
        result = await self._delete("/chats", json={"ids": ids})
        _total_cache.invalidate("chats:")  # Invalidate chats cache
        if result.get("code") != 0:
            raise RAGFlowAPIError(result.get("message", "Failed to delete chats"))
        return result

    # Agent operations (RAGFlow API doesn't return total, so we fetch all and paginate)
    async def list_agents(self, page: int = 1, page_size: int = 20, **kwargs) -> dict:
        """List all agents with pagination."""
        cache_key = f"agents:{kwargs.get('title', '')}"
        
        # Build request params - fetch all for accurate count
        params = {
            "page": 1,
            "page_size": MAX_PAGE_SIZE,
            "orderby": kwargs.get("orderby", "update_time"),
            "desc": kwargs.get("desc", True),
        }
        if kwargs.get("title"):
            params["title"] = kwargs["title"]
        if kwargs.get("id"):
            params["id"] = kwargs["id"]
        
        result = await self._get("/agents", params=params)
        if result.get("code") == 0:
            all_items = result.get("data", [])
            total = len(all_items)
            
            # Update cache
            _total_cache.set(cache_key, total)
            
            # Manual pagination
            start = (page - 1) * page_size
            end = start + page_size
            items = all_items[start:end]
            return {
                "items": items,
                "total": total
            }
        raise RAGFlowAPIError(result.get("message", "Failed to list agents"))
    
    def invalidate_cache(self, resource: str = None):
        """Invalidate cached total counts."""
        if resource:
            _total_cache.invalidate(resource)
        else:
            _total_cache.invalidate()


ragflow_client = RAGFlowClient()
