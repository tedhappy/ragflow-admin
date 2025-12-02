#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import httpx
from quart import Blueprint, jsonify
from api.settings import settings

manager = Blueprint("system", __name__)


@manager.route("/health", methods=["GET"])
async def check_health():
    """
    检查RAGFlow服务健康状态
    ---
    tags:
      - System
    responses:
      200:
        description: 健康状态
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.ragflow_base_url}/api/v1/system/health",
                headers={"Authorization": f"Bearer {settings.ragflow_api_key}"},
                timeout=10
            )
            if response.status_code == 200:
                return jsonify({
                    "code": 0,
                    "data": {
                        "ragflow_status": "healthy",
                        "ragflow_url": settings.ragflow_base_url
                    }
                })
            else:
                return jsonify({
                    "code": -1,
                    "data": {
                        "ragflow_status": "unhealthy",
                        "status_code": response.status_code
                    }
                })
    except Exception as e:
        return jsonify({
            "code": -1,
            "message": str(e),
            "data": {"ragflow_status": "unreachable"}
        }), 500


@manager.route("/config", methods=["GET"])
async def get_config():
    """
    获取当前配置信息（脱敏）
    ---
    tags:
      - System
    responses:
      200:
        description: 配置信息
    """
    return jsonify({
        "code": 0,
        "data": {
            "ragflow_base_url": settings.ragflow_base_url,
            "server_port": settings.server_port,
            "debug": settings.debug
        }
    })
