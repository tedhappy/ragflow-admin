#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import time
import logging
import httpx
from typing import Optional, Any
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
    _initialized = False
    _http_client: Optional[httpx.AsyncClient] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self._load_config()
            self._initialized = True

    def _load_config(self):
        """Load configuration from settings."""
        self._api_url = f"{settings.ragflow_base_url}/api/v1"
        self._headers = {
            "Authorization": f"Bearer {settings.ragflow_api_key}",
            "Content-Type": "application/json"
        }

    def reload(self):
        """Reload configuration and reset HTTP client."""
        self._load_config()
        if self._http_client is not None and not self._http_client.is_closed:
            # Close the old client asynchronously would be ideal, but for simplicity we'll let it be garbage collected
            self._http_client = None
        logger.info(f"RAGFlowClient reloaded with URL: {self._api_url}")

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

    # Dataset operations - RAGFlow API name param is exact match, so we use local filtering for search
    async def list_datasets(self, page: int = 1, page_size: int = 20, **kwargs) -> dict:
        """
        List datasets with pagination and filtering.
        
        Note: RAGFlow's name parameter does exact match, not partial match.
        For search functionality, we fetch all and filter locally.
        """
        name_filter = kwargs.get("name", "")
        
        # If searching by name, fetch all and filter locally for partial match
        if name_filter:
            params = {
                "page": 1,
                "page_size": MAX_PAGE_SIZE,
                "orderby": kwargs.get("orderby", "create_time"),
                "desc": kwargs.get("desc", True),
            }
            if kwargs.get("id"):
                params["id"] = kwargs["id"]
            
            result = await self._get("/datasets", params=params)
            if result.get("code") == 0:
                all_items = result.get("data", [])
                
                # Local filtering (case-insensitive partial match)
                name_lower = name_filter.lower()
                all_items = [
                    item for item in all_items 
                    if name_lower in (item.get("name", "") or "").lower()
                ]
                
                total = len(all_items)
                start = (page - 1) * page_size
                end = start + page_size
                return {
                    "items": all_items[start:end],
                    "total": total
                }
            raise RAGFlowAPIError(result.get("message", "Failed to list datasets"))
        
        # No filter - use RAGFlow's pagination directly
        params = {
            "page": page,
            "page_size": page_size,
            "orderby": kwargs.get("orderby", "create_time"),
            "desc": kwargs.get("desc", True),
        }
        if kwargs.get("id"):
            params["id"] = kwargs["id"]
        
        result = await self._get("/datasets", params=params)
        if result.get("code") == 0:
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
        _total_cache.invalidate()  # Invalidate all cache after delete
        if result.get("code") != 0:
            raise RAGFlowAPIError(result.get("message", "Failed to delete datasets"))
        return result

    # Chat operations - RAGFlow API name param is exact match, so we use local filtering for search
    async def list_chats(self, page: int = 1, page_size: int = 20, **kwargs) -> dict:
        """
        List chat assistants with pagination and filtering.
        
        Note: RAGFlow's name parameter does exact match, not partial match.
        For search functionality, we fetch all and filter locally.
        """
        name_filter = kwargs.get("name", "")
        
        # If searching by name, fetch all and filter locally for partial match
        if name_filter:
            params = {
                "page": 1,
                "page_size": MAX_PAGE_SIZE,
                "orderby": kwargs.get("orderby", "create_time"),
                "desc": kwargs.get("desc", True),
            }
            if kwargs.get("id"):
                params["id"] = kwargs["id"]
            
            result = await self._get("/chats", params=params)
            if result.get("code") == 0:
                all_items = result.get("data", [])
                
                # Local filtering (case-insensitive partial match)
                name_lower = name_filter.lower()
                all_items = [
                    item for item in all_items 
                    if name_lower in (item.get("name", "") or "").lower()
                ]
                
                total = len(all_items)
                start = (page - 1) * page_size
                end = start + page_size
                return {
                    "items": all_items[start:end],
                    "total": total
                }
            raise RAGFlowAPIError(result.get("message", "Failed to list chats"))
        
        # No filter - use RAGFlow's pagination directly
        params = {
            "page": page,
            "page_size": page_size,
            "orderby": kwargs.get("orderby", "create_time"),
            "desc": kwargs.get("desc", True),
        }
        if kwargs.get("id"):
            params["id"] = kwargs["id"]
        
        result = await self._get("/chats", params=params)
        if result.get("code") == 0:
            total = result.get("total") or len(result.get("data", []))
            return {
                "items": result.get("data", []),
                "total": total
            }
        raise RAGFlowAPIError(result.get("message", "Failed to list chats"))

    async def delete_chats(self, ids: list):
        """Delete chats by IDs."""
        result = await self._delete("/chats", json={"ids": ids})
        _total_cache.invalidate()  # Invalidate all cache after delete
        if result.get("code") != 0:
            raise RAGFlowAPIError(result.get("message", "Failed to delete chats"))
        return result

    # Agent operations - RAGFlow API title param is exact match, so we use local filtering for search
    async def list_agents(self, page: int = 1, page_size: int = 20, **kwargs) -> dict:
        """
        List agents with pagination and filtering.
        
        Note: RAGFlow's title parameter does exact match, not partial match.
        For search functionality, we fetch all and filter locally.
        """
        title_filter = kwargs.get("title", "")
        
        # If searching by title, fetch all and filter locally for partial match
        if title_filter:
            params = {
                "page": 1,
                "page_size": MAX_PAGE_SIZE,
                "orderby": kwargs.get("orderby", "update_time"),
                "desc": kwargs.get("desc", True),
            }
            if kwargs.get("id"):
                params["id"] = kwargs["id"]
            
            result = await self._get("/agents", params=params)
            if result.get("code") == 0:
                all_items = result.get("data", [])
                
                # Local filtering (case-insensitive partial match)
                title_lower = title_filter.lower()
                all_items = [
                    item for item in all_items 
                    if title_lower in (item.get("title", "") or "").lower()
                ]
                
                total = len(all_items)
                start = (page - 1) * page_size
                end = start + page_size
                return {
                    "items": all_items[start:end],
                    "total": total
                }
            raise RAGFlowAPIError(result.get("message", "Failed to list agents"))
        
        # No filter - use RAGFlow's pagination directly
        params = {
            "page": page,
            "page_size": page_size,
            "orderby": kwargs.get("orderby", "update_time"),
            "desc": kwargs.get("desc", True),
        }
        if kwargs.get("id"):
            params["id"] = kwargs["id"]
        
        result = await self._get("/agents", params=params)
        if result.get("code") == 0:
            total = result.get("total") or len(result.get("data", []))
            return {
                "items": result.get("data", []),
                "total": total
            }
        raise RAGFlowAPIError(result.get("message", "Failed to list agents"))

    async def delete_agents(self, ids: list):
        """Delete agents by IDs (one by one as RAGFlow API only supports single delete)."""
        for agent_id in ids:
            result = await self._delete(f"/agents/{agent_id}")
            if result.get("code") != 0:
                raise RAGFlowAPIError(result.get("message", f"Failed to delete agent {agent_id}"))
        _total_cache.invalidate()  # Invalidate all cache after delete
        return {"code": 0}
    
    def invalidate_cache(self, resource: str = None):
        """Invalidate cached total counts."""
        if resource:
            _total_cache.invalidate(resource)
        else:
            _total_cache.invalidate()

    # Document operations within a dataset
    async def list_documents(self, dataset_id: str, page: int = 1, page_size: int = 20, **kwargs) -> dict:
        """
        List documents in a dataset with pagination and filtering.
        
        RAGFlow API: Dataset.list_documents(id, keywords, page, page_size, order_by, desc, run)
        """
        keywords_filter = kwargs.get("keywords", "")
        run_filter = kwargs.get("run", "")
        
        # Build base params
        base_params = {
            "orderby": kwargs.get("orderby", "create_time"),
            "desc": kwargs.get("desc", True),
        }
        if kwargs.get("id"):
            base_params["id"] = kwargs["id"]
        # Add run filter (server-side filtering)
        if run_filter:
            base_params["run"] = run_filter
        
        # If searching by keywords, fetch all and filter locally
        if keywords_filter:
            params = {
                **base_params,
                "page": 1,
                "page_size": MAX_PAGE_SIZE,
            }
            
            result = await self._get(f"/datasets/{dataset_id}/documents", params=params)
            if result.get("code") == 0:
                all_items = result.get("data", {}).get("docs", [])
                
                # Local filtering (case-insensitive partial match on name)
                keywords_lower = keywords_filter.lower()
                all_items = [
                    item for item in all_items 
                    if keywords_lower in (item.get("name", "") or "").lower()
                ]
                
                total = len(all_items)
                start = (page - 1) * page_size
                end = start + page_size
                return {
                    "items": all_items[start:end],
                    "total": total
                }
            raise RAGFlowAPIError(result.get("message", "Failed to list documents"))
        
        # No keywords filter - use RAGFlow's pagination directly
        params = {
            **base_params,
            "page": page,
            "page_size": page_size,
        }
        
        result = await self._get(f"/datasets/{dataset_id}/documents", params=params)
        if result.get("code") == 0:
            data = result.get("data", {})
            total = data.get("total") or len(data.get("docs", []))
            return {
                "items": data.get("docs", []),
                "total": total
            }
        raise RAGFlowAPIError(result.get("message", "Failed to list documents"))

    async def delete_documents(self, dataset_id: str, ids: list):
        """Delete documents by IDs within a dataset."""
        result = await self._delete(f"/datasets/{dataset_id}/documents", json={"ids": ids})
        if result.get("code") != 0:
            raise RAGFlowAPIError(result.get("message", "Failed to delete documents"))
        return result

    async def upload_documents(self, dataset_id: str, files: list) -> dict:
        """
        Upload documents to a dataset.
        
        Args:
            dataset_id: The ID of the dataset
            files: List of tuples (filename, file_content, content_type)
        
        Returns:
            dict with uploaded document info
        """
        client = self._get_http_client()
        try:
            # Build multipart form data
            files_data = []
            for filename, content, content_type in files:
                files_data.append(('file', (filename, content, content_type)))
            
            # Need to create a new client without default Content-Type header for multipart
            headers = {"Authorization": f"Bearer {settings.ragflow_api_key}"}
            
            async with httpx.AsyncClient(
                base_url=self._api_url,
                headers=headers,
                timeout=HTTP_TIMEOUT * 3  # Longer timeout for file uploads
            ) as upload_client:
                start_time = time.time()
                resp = await upload_client.post(
                    f"/datasets/{dataset_id}/documents",
                    files=files_data
                )
                elapsed = time.time() - start_time
                logger.debug(f"Upload documents completed in {elapsed:.3f}s, status={resp.status_code}")
                resp.raise_for_status()
                result = resp.json()
                
            if result.get("code") == 0:
                return result.get("data", [])
            raise RAGFlowAPIError(result.get("message", "Failed to upload documents"))
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error on upload: {e.response.status_code}")
            raise RAGFlowAPIError(f"HTTP {e.response.status_code}", code=e.response.status_code)
        except httpx.RequestError as e:
            logger.error(f"Request error on upload: {str(e)}")
            raise RAGFlowAPIError(f"Request failed: {str(e)}")

    async def parse_documents(self, dataset_id: str, document_ids: list) -> dict:
        """
        Parse (chunk) documents in a dataset.
        
        Args:
            dataset_id: The ID of the dataset
            document_ids: List of document IDs to parse
        
        Returns:
            dict with parse result
        """
        result = await self._post(
            f"/datasets/{dataset_id}/chunks",
            json={"document_ids": document_ids}
        )
        if result.get("code") == 0:
            return result
        raise RAGFlowAPIError(result.get("message", "Failed to parse documents"))

    async def stop_parsing_documents(self, dataset_id: str, document_ids: list) -> dict:
        """
        Stop parsing documents in a dataset.
        
        Args:
            dataset_id: The ID of the dataset
            document_ids: List of document IDs to stop parsing
        
        Returns:
            dict with result
        """
        result = await self._delete(
            f"/datasets/{dataset_id}/chunks",
            json={"document_ids": document_ids}
        )
        if result.get("code") == 0:
            return result
        raise RAGFlowAPIError(result.get("message", "Failed to stop parsing documents"))

    async def check_system_health(self) -> dict:
        """
        Check system health status (DB, Redis, doc_engine, storage).
        This endpoint doesn't require authentication.
        
        Returns:
            dict with health status of each component
        """
        # Use base URL without /api/v1 for health check
        base_url = settings.ragflow_base_url
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.get(f"{base_url}/v1/system/healthz")
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "healthy": True,
                        "status": data.get("status", "unknown"),
                        "db": data.get("db", "unknown"),
                        "redis": data.get("redis", "unknown"),
                        "doc_engine": data.get("doc_engine", "unknown"),
                        "storage": data.get("storage", "unknown"),
                    }
                else:
                    data = resp.json()
                    return {
                        "healthy": False,
                        "status": data.get("status", "nok"),
                        "db": data.get("db", "unknown"),
                        "redis": data.get("redis", "unknown"),
                        "doc_engine": data.get("doc_engine", "unknown"),
                        "storage": data.get("storage", "unknown"),
                        "meta": data.get("_meta", {}),
                    }
            except Exception as e:
                logger.error(f"Health check failed: {e}")
                return {
                    "healthy": False,
                    "status": "error",
                    "error": str(e),
                }

    # Session management for chat assistants
    async def list_chat_sessions(self, chat_id: str, page: int = 1, page_size: int = 30) -> dict:
        """
        List sessions for a chat assistant.
        
        Args:
            chat_id: The ID of the chat assistant
            page: Page number
            page_size: Number of items per page
        
        Returns:
            dict with items list and total count
        """
        params = {
            "page": page,
            "page_size": page_size,
        }
        result = await self._get(f"/chats/{chat_id}/sessions", params=params)
        if result.get("code") == 0:
            data = result.get("data", [])
            return {
                "items": data if isinstance(data, list) else [],
                "total": len(data) if isinstance(data, list) else 0,
            }
        raise RAGFlowAPIError(result.get("message", "Failed to list chat sessions"))

    async def delete_chat_sessions(self, chat_id: str, session_ids: list) -> dict:
        """
        Delete sessions for a chat assistant.
        
        Args:
            chat_id: The ID of the chat assistant
            session_ids: List of session IDs to delete
        
        Returns:
            dict with result
        """
        result = await self._delete(
            f"/chats/{chat_id}/sessions",
            json={"ids": session_ids}
        )
        if result.get("code") == 0:
            return result
        raise RAGFlowAPIError(result.get("message", "Failed to delete chat sessions"))


ragflow_client = RAGFlowClient()
