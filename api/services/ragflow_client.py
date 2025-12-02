#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

from ragflow_sdk import RAGFlow
from api.settings import settings


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

    @property
    def client(self) -> RAGFlow:
        return self._client

    # Dataset operations
    def list_datasets(self, page: int = 1, page_size: int = 20, **kwargs):
        return self._client.list_datasets(page=page, page_size=page_size, **kwargs)

    def create_dataset(self, name: str, **kwargs):
        return self._client.create_dataset(name=name, **kwargs)

    def delete_datasets(self, ids: list):
        return self._client.delete_datasets(ids=ids)

    # Chat operations
    def list_chats(self, page: int = 1, page_size: int = 20, **kwargs):
        return self._client.list_chats(page=page, page_size=page_size, **kwargs)

    # Agent operations
    def list_agents(self, page: int = 1, page_size: int = 20, **kwargs):
        return self._client.list_agents(page=page, page_size=page_size, **kwargs)


ragflow_client = RAGFlowClient()
