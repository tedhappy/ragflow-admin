#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

from quart import Blueprint, jsonify, request
from api.services.ragflow_client import ragflow_client

manager = Blueprint("agent", __name__)


@manager.route("", methods=["GET"])
async def list_agents():
    """
    获取智能体列表
    ---
    tags:
      - Agent
    parameters:
      - name: page
        in: query
        type: integer
        default: 1
      - name: page_size
        in: query
        type: integer
        default: 20
    responses:
      200:
        description: 智能体列表
    """
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    
    try:
        agents = ragflow_client.list_agents(page=page, page_size=page_size)
        return jsonify({"code": 0, "data": agents})
    except Exception as e:
        return jsonify({"code": -1, "message": str(e)}), 500
