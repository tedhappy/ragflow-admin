#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

from quart import Blueprint, jsonify

manager = Blueprint("dashboard", __name__)


@manager.route("/stats", methods=["GET"])
async def get_stats():
    """
    获取仪表盘统计数据
    ---
    tags:
      - Dashboard
    responses:
      200:
        description: 统计数据
    """
    # TODO: 实现统计逻辑
    return jsonify({
        "code": 0,
        "data": {
            "datasets_count": 0,
            "documents_count": 0,
            "chats_count": 0,
            "agents_count": 0,
        }
    })
