#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import httpx
from quart import Blueprint, jsonify
from api.settings import settings

manager = Blueprint("system", __name__)

ADMIN_VERSION = "0.1.0"


def mask_api_key(api_key: str) -> str:
    """Mask API key for display, showing only first 8 and last 4 characters."""
    if len(api_key) <= 12:
        return "*" * len(api_key)
    return api_key[:8] + "*" * (len(api_key) - 12) + api_key[-4:]


@manager.route("/status", methods=["GET"])
async def get_status():
    """
    Get system status including RAGFlow connection
    ---
    tags:
      - System
    responses:
      200:
        description: System status
    """
    ragflow_status = "unknown"
    ragflow_version = None
    error_message = None
    
    try:
        async with httpx.AsyncClient() as client:
            # Try to verify connection using datasets API
            response = await client.get(
                f"{settings.ragflow_base_url}/api/v1/datasets",
                params={"page": 1, "page_size": 1},
                headers={"Authorization": f"Bearer {settings.ragflow_api_key}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("code") == 0:
                    ragflow_status = "connected"
                else:
                    ragflow_status = "error"
                    error_message = data.get("message", "API returned error")
            else:
                ragflow_status = "error"
                error_message = f"HTTP {response.status_code}"
            
            # Try to get version info (optional)
            try:
                ver_response = await client.get(
                    f"{settings.ragflow_base_url}/api/v1/system/version",
                    headers={"Authorization": f"Bearer {settings.ragflow_api_key}"},
                    timeout=5
                )
                if ver_response.status_code == 200:
                    ver_data = ver_response.json()
                    if ver_data.get("code") == 0:
                        ragflow_version = ver_data.get("data", {}).get("version")
            except:
                pass  # Version info is optional
    except httpx.ConnectError:
        ragflow_status = "disconnected"
        error_message = "Cannot connect to RAGFlow server"
    except httpx.TimeoutException:
        ragflow_status = "timeout"
        error_message = "Connection timeout"
    except Exception as e:
        ragflow_status = "error"
        error_message = str(e)
    
    return jsonify({
        "code": 0,
        "data": {
            "admin_version": ADMIN_VERSION,
            "ragflow_url": settings.ragflow_base_url,
            "ragflow_status": ragflow_status,
            "ragflow_version": ragflow_version,
            "api_key_masked": mask_api_key(settings.ragflow_api_key),
            "server_port": settings.server_port,
            "debug": settings.debug,
            "error_message": error_message
        }
    })


@manager.route("/health", methods=["GET"])
async def check_health():
    """
    Check RAGFlow service health
    ---
    tags:
      - System
    responses:
      200:
        description: Health status
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.ragflow_base_url}/api/v1/datasets",
                params={"page": 1, "page_size": 1},
                headers={"Authorization": f"Bearer {settings.ragflow_api_key}"},
                timeout=10
            )
            if response.status_code == 200:
                return jsonify({
                    "code": 0,
                    "data": {
                        "status": "healthy",
                        "ragflow_url": settings.ragflow_base_url
                    }
                })
            else:
                return jsonify({
                    "code": -1,
                    "data": {
                        "status": "unhealthy",
                        "status_code": response.status_code
                    }
                })
    except Exception as e:
        return jsonify({
            "code": -1,
            "message": str(e),
            "data": {"status": "unreachable"}
        }), 500


@manager.route("/config", methods=["GET"])
async def get_config():
    """
    Get current configuration (masked)
    ---
    tags:
      - System
    responses:
      200:
        description: Configuration info
    """
    return jsonify({
        "code": 0,
        "data": {
            "ragflow_base_url": settings.ragflow_base_url,
            "api_key_masked": mask_api_key(settings.ragflow_api_key),
            "server_port": settings.server_port,
            "debug": settings.debug
        }
    })
