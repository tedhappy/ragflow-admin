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
from api.services.ragflow_client import ragflow_client

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
    """Get system status."""
    mysql_status = "unknown"
    error_message = None
    
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
    """Get current MySQL configuration."""
    return jsonify({
        "code": 0,
        "data": {
            "mysql_host": settings.mysql_host or "",
            "mysql_port": settings.mysql_port or 5455,
            "mysql_database": settings.mysql_database or "",
            "mysql_user": settings.mysql_user or "",
            "is_configured": settings.is_mysql_configured,
            "server_port": settings.server_port,
            "debug": settings.debug
        }
    })


@manager.route("/config", methods=["POST"])
async def save_config():
    """Save MySQL configuration."""
    try:
        data = await request.get_json()
        host = data.get("host", "").strip()
        port = data.get("port", 5455)
        database = data.get("database", "").strip()
        user = data.get("user", "").strip()
        password = data.get("password", "")
        
        if not host:
            return jsonify({"code": -1, "message": "Host is required"}), 400
        if not database:
            return jsonify({"code": -1, "message": "Database is required"}), 400
        if not user:
            return jsonify({"code": -1, "message": "User is required"}), 400
        
        success = settings.update_mysql_config(host, port, database, user, password)
        
        if success:
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
    """Test MySQL connection."""
    try:
        data = await request.get_json()
        host = data.get("host", "").strip()
        port = data.get("port", 5455)
        database = data.get("database", "").strip()
        user = data.get("user", "").strip()
        password = data.get("password", "")
        
        if not host:
            return jsonify({"code": -1, "message": "Host is required"}), 400
        if not database:
            return jsonify({"code": -1, "message": "Database is required"}), 400
        if not user:
            return jsonify({"code": -1, "message": "User is required"}), 400
        
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


@manager.route("/ragflow/config", methods=["GET"])
async def get_ragflow_config():
    """Get RAGFlow API configuration."""
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
    """Save RAGFlow API configuration."""
    try:
        data = await request.get_json()
        base_url = data.get("base_url", "").strip().rstrip("/")
        api_key = data.get("api_key", "").strip()
        
        if not base_url:
            return jsonify({"code": -1, "message": "RAGFlow URL is required"}), 400
        if not api_key:
            return jsonify({"code": -1, "message": "API Key is required"}), 400
        
        success = settings.update_ragflow_config(base_url, api_key)
        
        if success:
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
        logger.exception("Failed to save RAGFlow config")
        return jsonify({
            "code": -1,
            "message": str(e)
        }), 500


@manager.route("/ragflow/config/test", methods=["POST"])
async def test_ragflow_connection():
    """Test RAGFlow API connection."""
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


@manager.route("/ragflow/current-user", methods=["GET"])
async def get_ragflow_current_user():
    """Get current RAGFlow API user info."""
    from api.services.ragflow_client import ragflow_client, RAGFlowAPIError
    
    if not settings.ragflow_base_url or not settings.ragflow_api_key:
        return jsonify({
            "code": -1,
            "message": "RAGFlow API not configured"
        }), 400
    
    try:
        user_info = await ragflow_client.get_current_user()
        user_id = user_info.get("user_id")
        
        user_details = None
        if user_id and settings.is_mysql_configured:
            try:
                user_details = await mysql_client.get_user(user_id)
            except Exception:
                pass
        
        return jsonify({
            "code": 0,
            "data": {
                "user_id": user_id,
                "email": user_details.get("email") if user_details else None,
                "nickname": user_details.get("nickname") if user_details else None,
                "has_datasets": user_info.get("has_datasets", False)
            }
        })
    except RAGFlowAPIError as e:
        return jsonify({
            "code": -1,
            "message": e.message
        }), 500
    except Exception as e:
        logger.exception("Failed to get RAGFlow current user")
        return jsonify({
            "code": -1,
            "message": str(e)
        }), 500


@manager.route("/monitoring/health", methods=["GET"])
async def get_health_status():
    """Get comprehensive health status of all services."""
    health = {
        "mysql": {"status": "unknown", "message": None},
        "ragflow_api": {"status": "unknown", "message": None},
        "overall": "unknown"
    }
    
    try:
        if settings.is_mysql_configured:
            result = await mysql_client.test_connection()
            if result.get("connected"):
                health["mysql"] = {
                    "status": "healthy",
                    "message": f"MySQL {result.get('version', 'unknown')} - {settings.mysql_database}",
                    "version": result.get("version"),
                    "database": result.get("database")
                }
            else:
                health["mysql"] = {
                    "status": "unhealthy",
                    "message": result.get("error", "Connection failed")
                }
        else:
            health["mysql"] = {
                "status": "not_configured",
                "message": "MySQL connection not configured"
            }
    except Exception as e:
        health["mysql"] = {
            "status": "unhealthy",
            "message": str(e)
        }
    
    try:
        if settings.ragflow_base_url and settings.ragflow_api_key:
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.get(
                        f"{settings.ragflow_base_url}/v1/system/healthz",
                        timeout=10
                    )
                    if response.status_code == 200:
                        resp_data = response.json()
                        health["ragflow_api"] = {
                            "status": "healthy",
                            "message": "RAGFlow API is healthy",
                            "details": resp_data
                        }
                    else:
                        response = await client.get(
                            f"{settings.ragflow_base_url}/api/v1/datasets",
                            params={"page": 1, "page_size": 1},
                            headers={"Authorization": f"Bearer {settings.ragflow_api_key}"},
                            timeout=10
                        )
                        if response.status_code == 200:
                            health["ragflow_api"] = {
                                "status": "healthy",
                                "message": "RAGFlow API is reachable"
                            }
                        else:
                            health["ragflow_api"] = {
                                "status": "unhealthy",
                                "message": f"HTTP {response.status_code}"
                            }
                except httpx.ConnectError:
                    health["ragflow_api"] = {
                        "status": "unhealthy",
                        "message": "Cannot connect to RAGFlow server"
                    }
                except httpx.TimeoutException:
                    health["ragflow_api"] = {
                        "status": "unhealthy",
                        "message": "Connection timeout"
                    }
        else:
            health["ragflow_api"] = {
                "status": "not_configured",
                "message": "RAGFlow API not configured"
            }
    except Exception as e:
        health["ragflow_api"] = {
            "status": "unhealthy",
            "message": str(e)
        }
    
    statuses = [health["mysql"]["status"], health["ragflow_api"]["status"]]
    if all(s == "healthy" for s in statuses):
        health["overall"] = "healthy"
    elif any(s == "unhealthy" for s in statuses):
        health["overall"] = "unhealthy"
    elif all(s in ["healthy", "not_configured"] for s in statuses):
        health["overall"] = "partial"
    else:
        health["overall"] = "unknown"
    
    return jsonify({"code": 0, "data": health})


@manager.route("/monitoring/stats", methods=["GET"])
async def get_system_stats():
    """Get comprehensive system statistics."""
    try:
        stats = await mysql_client.get_system_statistics()
        return jsonify({"code": 0, "data": stats})
    except MySQLClientError as e:
        logger.error(f"Failed to get system stats: {e.message}")
        return jsonify({"code": -1, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error getting system stats")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/monitoring/ragflow-health", methods=["GET"])
async def get_ragflow_health():
    """Get RAGFlow service health details."""
    if not settings.ragflow_base_url:
        return jsonify({
            "code": -1,
            "message": "RAGFlow URL not configured"
        }), 400
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.ragflow_base_url}/v1/system/healthz",
                timeout=10
            )
            
            if response.status_code == 200:
                resp_data = response.json()
                return jsonify({
                    "code": 0,
                    "data": {
                        "status": "healthy",
                        "services": resp_data
                    }
                })
            elif response.status_code == 500:
                resp_data = response.json()
                return jsonify({
                    "code": 0,
                    "data": {
                        "status": "unhealthy",
                        "services": resp_data
                    }
                })
            else:
                return jsonify({
                    "code": -1,
                    "data": {
                        "status": "unknown",
                        "message": f"HTTP {response.status_code}"
                    }
                })
    except httpx.ConnectError:
        return jsonify({
            "code": -1,
            "data": {
                "status": "unreachable",
                "message": "Cannot connect to RAGFlow server"
            }
        })
    except httpx.TimeoutException:
        return jsonify({
            "code": -1,
            "data": {
                "status": "timeout",
                "message": "Connection timeout"
            }
        })
    except Exception as e:
        logger.exception("Failed to get RAGFlow health")
        return jsonify({
            "code": -1,
            "message": str(e)
        }), 500
