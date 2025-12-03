#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import httpx
from ragflow_sdk import RAGFlow
from api.settings import settings


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

    # Dataset operations
    def list_datasets(self, page: int = 1, page_size: int = 20, **kwargs) -> dict:
        """List all datasets with pagination."""
        datasets = self._client.list_datasets(page=page, page_size=page_size, **kwargs)
        return {
            "items": [serialize_sdk_object(ds) for ds in datasets],
            "total": len(datasets)
        }

    def create_dataset(self, name: str, **kwargs) -> dict:
        """Create a new dataset."""
        dataset = self._client.create_dataset(name=name, **kwargs)
        return serialize_sdk_object(dataset)

    def delete_datasets(self, ids: list):
        """Delete datasets by IDs."""
        return self._client.delete_datasets(ids=ids)

    # Chat operations
    def list_chats(self, page: int = 1, page_size: int = 20, **kwargs) -> dict:
        """List all chats with pagination."""
        chats = self._client.list_chats(page=page, page_size=page_size, **kwargs)
        return {
            "items": [serialize_sdk_object(chat) for chat in chats],
            "total": len(chats)
        }

    def delete_chats(self, ids: list):
        """Delete chats by IDs."""
        return self._client.delete_chats(ids=ids)

    # Agent operations (using HTTP since SDK v0.13.0 doesn't support list_agents)
    def list_agents(self, page: int = 1, page_size: int = 20, **kwargs) -> dict:
        """List all agents with pagination."""
        params = {
            "page": page,
            "page_size": page_size,
            "orderby": kwargs.get("orderby", "update_time"),
            "desc": kwargs.get("desc", True),
        }
        if kwargs.get("title"):
            params["title"] = kwargs["title"]
        if kwargs.get("id"):
            params["id"] = kwargs["id"]
        
        result = self._get("/agents", params=params)
        if result.get("code") == 0:
            return {
                "items": result.get("data", []),
                "total": len(result.get("data", []))
            }
        raise Exception(result.get("message", "Failed to list agents"))


ragflow_client = RAGFlowClient()
