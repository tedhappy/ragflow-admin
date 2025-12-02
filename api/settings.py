#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import os
import yaml
from pathlib import Path


class Settings:
    _instance = None
    _config = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._config is None:
            self._load_config()

    def _load_config(self):
        config_path = Path(__file__).parent.parent / "conf" / "config.yaml"
        example_path = Path(__file__).parent.parent / "conf" / "config.example.yaml"

        if config_path.exists():
            with open(config_path, "r", encoding="utf-8") as f:
                self._config = yaml.safe_load(f)
        elif example_path.exists():
            with open(example_path, "r", encoding="utf-8") as f:
                self._config = yaml.safe_load(f)
            print("Warning: Using config.example.yaml. Please create conf/config.yaml")
        else:
            raise FileNotFoundError("Config file not found")

    @property
    def ragflow_base_url(self) -> str:
        return os.getenv("RAGFLOW_BASE_URL", self._config["ragflow"]["base_url"])

    @property
    def ragflow_api_key(self) -> str:
        return os.getenv("RAGFLOW_API_KEY", self._config["ragflow"]["api_key"])

    @property
    def server_host(self) -> str:
        return self._config["server"]["host"]

    @property
    def server_port(self) -> int:
        return self._config["server"]["port"]

    @property
    def debug(self) -> bool:
        return self._config["server"]["debug"]

    @property
    def secret_key(self) -> str:
        return os.getenv("SECRET_KEY", self._config["server"]["secret_key"])

    @property
    def admin_username(self) -> str:
        return self._config["admin"]["username"]

    @property
    def admin_password(self) -> str:
        return self._config["admin"]["password"]


settings = Settings()
