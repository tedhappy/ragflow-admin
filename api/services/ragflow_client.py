#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import time
import httpx
from ragflow_sdk import RAGFlow
from api.settings import settings


# Configuration for pagination
MAX_PAGE_SIZE = 10000  # Maximum items to fetch for counting
CACHE_TTL = 300  # Cache TTL in seconds (5 minutes)


class TotalCountCache:
    """Simple cache for total counts to avoid repeated large queries."""
    
    def __init__(self, ttl: int = CACHE_TTL):
        self._cache: dict = {}
        self._ttl = ttl
    
    def get(self, key: str) -> int | None:
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
    _instance = None
    _client = None

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

    def _get(self, path: str, params: dict = None) -> dict:
        """Make GET request to RAGFlow API."""
        with httpx.Client() as client:
            resp = client.get(f"{self._api_url}{path}", params=params, headers=self._headers)
            return resp.json()

    def _post(self, path: str, json: dict = None) -> dict:
        """Make POST request to RAGFlow API."""
        with httpx.Client() as client:
            resp = client.post(f"{self._api_url}{path}", json=json, headers=self._headers)
            return resp.json()

    def _delete(self, path: str, json: dict = None) -> dict:
        """Make DELETE request to RAGFlow API."""
        with httpx.Client() as client:
            resp = client.delete(f"{self._api_url}{path}", json=json, headers=self._headers)
            return resp.json()

    # Dataset operations (using HTTP to get accurate total count)
    def list_datasets(self, page: int = 1, page_size: int = 20, **kwargs) -> dict:
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
        
        result = self._get("/datasets", params=params)
        if result.get("code") == 0:
            # RAGFlow returns total_datasets for datasets count
            total = result.get("total") or result.get("total_datasets") or len(result.get("data", []))
            return {
                "items": result.get("data", []),
                "total": total
            }
        raise Exception(result.get("message", "Failed to list datasets"))

    def create_dataset(self, name: str, **kwargs) -> dict:
        """Create a new dataset."""
        dataset = self._client.create_dataset(name=name, **kwargs)
        return serialize_sdk_object(dataset)

    def delete_datasets(self, ids: list):
        """Delete datasets by IDs."""
        result = self._client.delete_datasets(ids=ids)
        _total_cache.invalidate("datasets:")  # Invalidate datasets cache
        return result

    # Chat operations (RAGFlow API doesn't return total, so we fetch all and paginate)
    def list_chats(self, page: int = 1, page_size: int = 20, **kwargs) -> dict:
        """List all chats with pagination."""
        cache_key = f"chats:{kwargs.get('name', '')}"
        
        # Check cache for total count
        cached_total = _total_cache.get(cache_key)
        
        # Build request params
        params = {
            "page": 1,
            "page_size": MAX_PAGE_SIZE,  # Configurable max page size
            "orderby": kwargs.get("orderby", "create_time"),
            "desc": kwargs.get("desc", True),
        }
        if kwargs.get("name"):
            params["name"] = kwargs["name"]
        if kwargs.get("id"):
            params["id"] = kwargs["id"]
        
        result = self._get("/chats", params=params)
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
        raise Exception(result.get("message", "Failed to list chats"))

    def delete_chats(self, ids: list):
        """Delete chats by IDs."""
        result = self._client.delete_chats(ids=ids)
        _total_cache.invalidate("chats:")  # Invalidate chats cache
        return result

    # Agent operations (RAGFlow API doesn't return total, so we fetch all and paginate)
    def list_agents(self, page: int = 1, page_size: int = 20, **kwargs) -> dict:
        """List all agents with pagination."""
        cache_key = f"agents:{kwargs.get('title', '')}"
        
        # Build request params
        params = {
            "page": 1,
            "page_size": MAX_PAGE_SIZE,  # Configurable max page size
            "orderby": kwargs.get("orderby", "update_time"),
            "desc": kwargs.get("desc", True),
        }
        if kwargs.get("title"):
            params["title"] = kwargs["title"]
        if kwargs.get("id"):
            params["id"] = kwargs["id"]
        
        result = self._get("/agents", params=params)
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
        raise Exception(result.get("message", "Failed to list agents"))
    
    def invalidate_cache(self, resource: str = None):
        """Invalidate cached total counts."""
        if resource:
            _total_cache.invalidate(resource)
        else:
            _total_cache.invalidate()


ragflow_client = RAGFlowClient()
