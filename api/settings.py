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
    _config_path = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._config is None:
            self._load_config()

    def _load_config(self):
        self._config_path = Path(__file__).parent.parent / "conf" / "config.yaml"
        example_path = Path(__file__).parent.parent / "conf" / "config.example.yaml"

        if self._config_path.exists():
            with open(self._config_path, "r", encoding="utf-8") as f:
                self._config = yaml.safe_load(f)
        elif example_path.exists():
            with open(example_path, "r", encoding="utf-8") as f:
                self._config = yaml.safe_load(f)
            print("Warning: Using config.example.yaml. Please create conf/config.yaml")
        else:
            raise FileNotFoundError("Config file not found")

    def reload_config(self):
        """Reload configuration from file."""
        self._config = None
        self._load_config()

    # RAGFlow API settings (used for document upload/parse operations)
    @property
    def ragflow_base_url(self) -> str:
        """Get RAGFlow base URL for document operations."""
        env_url = os.getenv("RAGFLOW_BASE_URL")
        if env_url:
            return env_url
        ragflow_config = self._config.get("ragflow", {})
        return ragflow_config.get("base_url", "") or ""

    @property
    def ragflow_api_key(self) -> str:
        """Get RAGFlow API key for document operations."""
        env_key = os.getenv("RAGFLOW_API_KEY")
        if env_key:
            return env_key
        ragflow_config = self._config.get("ragflow", {})
        return ragflow_config.get("api_key", "") or ""

    def update_ragflow_config(self, base_url: str, api_key: str) -> bool:
        """Update RAGFlow API configuration and save to config.yaml."""
        try:
            # Ensure ragflow section exists
            if "ragflow" not in self._config:
                self._config["ragflow"] = {}
            
            # Update in memory
            self._config["ragflow"]["base_url"] = base_url
            self._config["ragflow"]["api_key"] = api_key
            
            # Read original file
            original_content = ""
            if self._config_path.exists():
                with open(self._config_path, "r", encoding="utf-8") as f:
                    original_content = f.read()
            
            # Check if ragflow section exists
            if "ragflow:" not in original_content:
                # Find position after comments and add ragflow section
                lines = original_content.split("\n")
                insert_idx = 0
                for i, line in enumerate(lines):
                    if line.strip() and not line.strip().startswith("#"):
                        insert_idx = i
                        break
                ragflow_section = f"""# RAGFlow API settings (for document upload/parse)
ragflow:
  base_url: "{base_url}"
  api_key: "{api_key}"

"""
                lines.insert(insert_idx, ragflow_section)
                with open(self._config_path, "w", encoding="utf-8") as f:
                    f.write("\n".join(lines))
            else:
                # Update existing ragflow section
                lines = original_content.split("\n")
                new_lines = []
                in_ragflow_section = False
                
                for line in lines:
                    if line.strip() == "ragflow:":
                        in_ragflow_section = True
                        new_lines.append(line)
                    elif in_ragflow_section and line.strip() and not line.startswith(" ") and not line.startswith("\t"):
                        in_ragflow_section = False
                        new_lines.append(line)
                    elif in_ragflow_section:
                        if line.strip().startswith("base_url:"):
                            indent = len(line) - len(line.lstrip())
                            new_lines.append(f"{' ' * indent}base_url: \"{base_url}\"")
                        elif line.strip().startswith("api_key:"):
                            indent = len(line) - len(line.lstrip())
                            new_lines.append(f"{' ' * indent}api_key: \"{api_key}\"")
                        else:
                            new_lines.append(line)
                    else:
                        new_lines.append(line)
                
                with open(self._config_path, "w", encoding="utf-8") as f:
                    f.write("\n".join(new_lines))
            
            return True
        except Exception as e:
            print(f"Failed to save RAGFlow config: {e}")
            return False

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

    @property
    def mysql_host(self) -> str:
        """Get MySQL host."""
        mysql_config = self._config.get("mysql", {})
        return mysql_config.get("host", "") or ""

    @property
    def mysql_port(self) -> int:
        """Get MySQL port."""
        mysql_config = self._config.get("mysql", {})
        return mysql_config.get("port", 3306) or 3306

    @property
    def mysql_database(self) -> str:
        """Get MySQL database name."""
        mysql_config = self._config.get("mysql", {})
        return mysql_config.get("database", "") or ""

    @property
    def mysql_user(self) -> str:
        """Get MySQL username."""
        mysql_config = self._config.get("mysql", {})
        return mysql_config.get("user", "") or ""

    @property
    def mysql_password(self) -> str:
        """Get MySQL password."""
        mysql_config = self._config.get("mysql", {})
        return mysql_config.get("password", "") or ""

    @property
    def is_mysql_configured(self) -> bool:
        """Check if MySQL connection is configured."""
        return bool(self.mysql_host and self.mysql_database and self.mysql_user)

    def update_mysql_config(self, host: str, port: int, database: str, user: str, password: str) -> bool:
        """Update MySQL configuration and save to config.yaml."""
        try:
            # Ensure mysql section exists
            if "mysql" not in self._config:
                self._config["mysql"] = {}
            
            # Update in memory
            self._config["mysql"]["host"] = host
            self._config["mysql"]["port"] = port
            self._config["mysql"]["database"] = database
            self._config["mysql"]["user"] = user
            self._config["mysql"]["password"] = password
            
            # Read original file
            original_content = ""
            if self._config_path.exists():
                with open(self._config_path, "r", encoding="utf-8") as f:
                    original_content = f.read()
            
            # Check if mysql section exists
            if "mysql:" not in original_content:
                # Append mysql section
                mysql_section = f"""
# MySQL connection settings for RAGFlow database
mysql:
  host: "{host}"
  port: {port}
  database: "{database}"
  user: "{user}"
  password: "{password}"
"""
                with open(self._config_path, "a", encoding="utf-8") as f:
                    f.write(mysql_section)
            else:
                # Update existing mysql section
                lines = original_content.split("\n")
                new_lines = []
                in_mysql_section = False
                
                for line in lines:
                    if line.strip() == "mysql:":
                        in_mysql_section = True
                        new_lines.append(line)
                    elif in_mysql_section and line.strip() and not line.startswith(" ") and not line.startswith("\t"):
                        in_mysql_section = False
                        new_lines.append(line)
                    elif in_mysql_section:
                        if line.strip().startswith("host:"):
                            indent = len(line) - len(line.lstrip())
                            new_lines.append(f"{' ' * indent}host: \"{host}\"")
                        elif line.strip().startswith("port:"):
                            indent = len(line) - len(line.lstrip())
                            new_lines.append(f"{' ' * indent}port: {port}")
                        elif line.strip().startswith("database:"):
                            indent = len(line) - len(line.lstrip())
                            new_lines.append(f"{' ' * indent}database: \"{database}\"")
                        elif line.strip().startswith("user:"):
                            indent = len(line) - len(line.lstrip())
                            new_lines.append(f"{' ' * indent}user: \"{user}\"")
                        elif line.strip().startswith("password:"):
                            indent = len(line) - len(line.lstrip())
                            new_lines.append(f"{' ' * indent}password: \"{password}\"")
                        else:
                            new_lines.append(line)
                    else:
                        new_lines.append(line)
                
                with open(self._config_path, "w", encoding="utf-8") as f:
                    f.write("\n".join(new_lines))
            
            return True
        except Exception as e:
            print(f"Failed to save MySQL config: {e}")
            return False


settings = Settings()
