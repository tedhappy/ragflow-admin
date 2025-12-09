#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import logging
import httpx
from quart import Blueprint, jsonify, request
from api.settings import settings
from api.services.mysql_client import mysql_client, MySQLClientError

logger = logging.getLogger(__name__)

manager = Blueprint("system", __name__)


def mask_api_key(api_key: str) -> str:
    """Mask API key for display, showing only first 8 and last 4 characters."""
    if not api_key:
        return ""
    if len(api_key) <= 12:
        return "*" * len(api_key)
    return api_key[:8] + "*" * (len(api_key) - 12) + api_key[-4:]


@manager.route("/status", methods=["GET"])
async def get_status():
    """
    Get system status (MySQL connection)
    ---
    tags:
      - System
    responses:
      200:
        description: System status
    """
    mysql_status = "unknown"
    error_message = None
    
    # Check if MySQL is configured
    if not settings.is_mysql_configured:
        return jsonify({
            "code": 0,
            "data": {
                "mysql_status": "not_configured",
                "mysql_host": "",
                "mysql_database": "",
                "error_message": "MySQL connection not configured"
            }
        })
    
    try:
        result = await mysql_client.test_connection()
        if result.get("connected"):
            mysql_status = "connected"
        else:
            mysql_status = "error"
            error_message = result.get("error", "Connection failed")
    except Exception as e:
        mysql_status = "error"
        error_message = str(e)
    
    return jsonify({
        "code": 0,
        "data": {
            "mysql_status": mysql_status,
            "mysql_host": settings.mysql_host,
            "mysql_database": settings.mysql_database,
            "error_message": error_message
        }
    })


@manager.route("/config", methods=["GET"])
async def get_config():
    """
    Get current MySQL configuration
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
            "mysql_host": settings.mysql_host or "",
            "mysql_port": settings.mysql_port or 3306,
            "mysql_database": settings.mysql_database or "",
            "mysql_user": settings.mysql_user or "",
            "is_configured": settings.is_mysql_configured,
            "server_port": settings.server_port,
            "debug": settings.debug
        }
    })


@manager.route("/config", methods=["POST"])
async def save_config():
    """
    Save MySQL configuration
    ---
    tags:
      - System
    responses:
      200:
        description: Configuration saved
    """
    try:
        data = await request.get_json()
        host = data.get("host", "").strip()
        port = data.get("port", 3306)
        database = data.get("database", "").strip()
        user = data.get("user", "").strip()
        password = data.get("password", "")
        
        if not host:
            return jsonify({"code": -1, "message": "Host is required"}), 400
        if not database:
            return jsonify({"code": -1, "message": "Database is required"}), 400
        if not user:
            return jsonify({"code": -1, "message": "User is required"}), 400
        
        # Update settings and save to config.yaml
        success = settings.update_mysql_config(host, port, database, user, password)
        
        if success:
            # Close existing pool to force reconnection
            await mysql_client.close()
            
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
        logger.exception("Failed to save config")
        return jsonify({
            "code": -1,
            "message": str(e)
        }), 500


@manager.route("/config/test", methods=["POST"])
async def test_mysql_connection():
    """
    Test MySQL connection with provided credentials
    ---
    tags:
      - System
    responses:
      200:
        description: Connection test result
    """
    try:
        data = await request.get_json()
        host = data.get("host", "").strip()
        port = data.get("port", 3306)
        database = data.get("database", "").strip()
        user = data.get("user", "").strip()
        password = data.get("password", "")
        
        if not host:
            return jsonify({"code": -1, "message": "Host is required"}), 400
        if not database:
            return jsonify({"code": -1, "message": "Database is required"}), 400
        if not user:
            return jsonify({"code": -1, "message": "User is required"}), 400
        
        # Test connection with provided credentials
        import aiomysql
        try:
            conn = await aiomysql.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                db=database,
                connect_timeout=10
            )
            
            async with conn.cursor() as cursor:
                await cursor.execute("SELECT VERSION()")
                version = (await cursor.fetchone())[0]
                
                # Check if user table exists
                await cursor.execute("""
                    SELECT COUNT(*) FROM information_schema.tables 
                    WHERE table_schema = %s AND table_name = 'user'
                """, (database,))
                user_table_exists = (await cursor.fetchone())[0] > 0
            
            conn.close()
            
            return jsonify({
                "code": 0,
                "data": {
                    "connected": True,
                    "version": version,
                    "database": database,
                    "user_table_exists": user_table_exists
                }
            })
        except Exception as e:
            return jsonify({
                "code": -1,
                "data": {
                    "connected": False,
                    "error": str(e)
                }
            })
    except Exception as e:
        logger.exception("Failed to test MySQL connection")
        return jsonify({
            "code": -1,
            "message": str(e)
        }), 500


# ==================== RAGFlow API Configuration ====================

@manager.route("/ragflow/config", methods=["GET"])
async def get_ragflow_config():
    """
    Get RAGFlow API configuration (for document operations)
    ---
    tags:
      - System
    responses:
      200:
        description: RAGFlow API configuration
    """
    is_configured = bool(settings.ragflow_base_url and settings.ragflow_api_key)
    return jsonify({
        "code": 0,
        "data": {
            "base_url": settings.ragflow_base_url or "",
            "api_key_masked": mask_api_key(settings.ragflow_api_key),
            "is_configured": is_configured
        }
    })


@manager.route("/ragflow/config", methods=["POST"])
async def save_ragflow_config():
    """
    Save RAGFlow API configuration
    ---
    tags:
      - System
    responses:
      200:
        description: Configuration saved
    """
    try:
        data = await request.get_json()
        base_url = data.get("base_url", "").strip().rstrip("/")
        api_key = data.get("api_key", "").strip()
        
        if not base_url:
            return jsonify({"code": -1, "message": "RAGFlow URL is required"}), 400
        if not api_key:
            return jsonify({"code": -1, "message": "API Key is required"}), 400
        
        # Update settings and save to config.yaml
        success = settings.update_ragflow_config(base_url, api_key)
        
        if success:
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
        logger.exception("Failed to save RAGFlow config")
        return jsonify({
            "code": -1,
            "message": str(e)
        }), 500


@manager.route("/ragflow/config/test", methods=["POST"])
async def test_ragflow_connection():
    """
    Test RAGFlow API connection
    ---
    tags:
      - System
    responses:
      200:
        description: Connection test result
    """
    try:
        data = await request.get_json()
        base_url = data.get("base_url", "").strip().rstrip("/")
        api_key = data.get("api_key", "").strip()
        
        if not base_url:
            return jsonify({"code": -1, "message": "RAGFlow URL is required"}), 400
        if not api_key:
            return jsonify({"code": -1, "message": "API Key is required"}), 400
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{base_url}/api/v1/datasets",
                params={"page": 1, "page_size": 1},
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10
            )
            
            if response.status_code == 200:
                resp_data = response.json()
                if resp_data.get("code") == 0:
                    return jsonify({
                        "code": 0,
                        "data": {
                            "connected": True,
                            "message": "Connection successful"
                        }
                    })
                else:
                    return jsonify({
                        "code": -1,
                        "data": {
                            "connected": False,
                            "error": resp_data.get("message", "API returned error")
                        }
                    })
            elif response.status_code == 401:
                return jsonify({
                    "code": -1,
                    "data": {
                        "connected": False,
                        "error": "Invalid API Key (401 Unauthorized)"
                    }
                })
            else:
                return jsonify({
                    "code": -1,
                    "data": {
                        "connected": False,
                        "error": f"HTTP {response.status_code}"
                    }
                })
    except httpx.ConnectError:
        return jsonify({
            "code": -1,
            "data": {
                "connected": False,
                "error": "Cannot connect to RAGFlow server"
            }
        })
    except httpx.TimeoutException:
        return jsonify({
            "code": -1,
            "data": {
                "connected": False,
                "error": "Connection timeout"
            }
        })
    except Exception as e:
        logger.exception("Failed to test RAGFlow connection")
        return jsonify({
            "code": -1,
            "message": str(e)
        }), 500
