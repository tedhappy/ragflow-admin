#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import httpx
from quart import Blueprint, jsonify, request
from api.settings import settings
from api.services.ragflow_client import ragflow_client

manager = Blueprint("system", __name__)


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
    error_message = None
    
    # Check if RAGFlow is configured
    if not settings.is_ragflow_configured:
        return jsonify({
            "code": 0,
            "data": {
                "ragflow_url": settings.ragflow_base_url or "",
                "ragflow_status": "not_configured",
                "api_key_masked": "",
                "error_message": "RAGFlow connection not configured"
            }
        })
    
    try:
        async with httpx.AsyncClient() as client:
            # Verify connection using datasets API
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
            "ragflow_url": settings.ragflow_base_url,
            "ragflow_status": ragflow_status,
            "api_key_masked": mask_api_key(settings.ragflow_api_key),
            "error_message": error_message
        }
    })


@manager.route("/test-connection", methods=["POST"])
async def test_connection():
    """
    Test connection with user-provided URL and API key
    ---
    tags:
      - System
    responses:
      200:
        description: Connection test result
    """
    try:
        data = await request.get_json()
        ragflow_url = data.get("ragflow_url", "").rstrip("/")
        api_key = data.get("api_key", "")
        
        if not ragflow_url:
            return jsonify({
                "code": -1,
                "message": "RAGFlow URL is required"
            }), 400
        
        if not api_key:
            return jsonify({
                "code": -1,
                "message": "API Key is required"
            }), 400
        
        ragflow_status = "unknown"
        error_message = None
        
        async with httpx.AsyncClient() as client:
            # Test connection using datasets API
            response = await client.get(
                f"{ragflow_url}/api/v1/datasets",
                params={"page": 1, "page_size": 1},
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10
            )
            if response.status_code == 200:
                resp_data = response.json()
                if resp_data.get("code") == 0:
                    ragflow_status = "connected"
                else:
                    ragflow_status = "error"
                    error_message = resp_data.get("message", "API returned error")
            elif response.status_code == 401:
                ragflow_status = "error"
                error_message = "Invalid API Key (401 Unauthorized)"
            else:
                ragflow_status = "error"
                error_message = f"HTTP {response.status_code}"
                
        return jsonify({
            "code": 0 if ragflow_status == "connected" else -1,
            "data": {
                "ragflow_status": ragflow_status,
                "error_message": error_message
            }
        })
    except httpx.ConnectError:
        return jsonify({
            "code": -1,
            "data": {
                "ragflow_status": "disconnected",
                "error_message": "Cannot connect to RAGFlow server"
            }
        })
    except httpx.TimeoutException:
        return jsonify({
            "code": -1,
            "data": {
                "ragflow_status": "timeout",
                "error_message": "Connection timeout"
            }
        })
    except Exception as e:
        return jsonify({
            "code": -1,
            "data": {
                "ragflow_status": "error",
                "error_message": str(e)
            }
        })


@manager.route("/health", methods=["GET"])
async def check_health():
    """
    Check RAGFlow service health (DB, Redis, doc_engine, storage)
    ---
    tags:
      - System
    responses:
      200:
        description: Health status of all components
    """
    try:
        health = await ragflow_client.check_system_health()
        return jsonify({
            "code": 0 if health.get("healthy") else -1,
            "data": health
        })
    except Exception as e:
        return jsonify({
            "code": -1,
            "message": str(e),
            "data": {"status": "error", "healthy": False, "error": str(e)}
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


@manager.route("/config", methods=["POST"])
async def save_config():
    """
    Save RAGFlow configuration
    ---
    tags:
      - System
    responses:
      200:
        description: Configuration saved
    """
    try:
        data = await request.get_json()
        ragflow_url = data.get("ragflow_url", "").rstrip("/")
        api_key = data.get("api_key", "")
        
        if not ragflow_url:
            return jsonify({
                "code": -1,
                "message": "RAGFlow URL is required"
            }), 400
        
        if not api_key:
            return jsonify({
                "code": -1,
                "message": "API Key is required"
            }), 400
        
        # Update settings and save to config.yaml
        success = settings.update_ragflow_config(ragflow_url, api_key)
        
        if success:
            # Reload ragflow client with new configuration
            ragflow_client.reload()
            
            return jsonify({
                "code": 0,
                "message": "Configuration saved successfully"
            })
        else:
            return jsonify({
                "code": -1,
                "message": "Failed to save configuration"
            }), 500
    except Exception as e:
        return jsonify({
            "code": -1,
            "message": str(e)
        }), 500
