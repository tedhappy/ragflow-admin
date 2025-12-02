#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

from quart import Blueprint, jsonify, request
from api.services.ragflow_client import ragflow_client

manager = Blueprint("chat", __name__)


@manager.route("", methods=["GET"])
async def list_chats():
    """
    获取聊天助手列表
    ---
    tags:
      - Chat
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
        description: 聊天助手列表
    """
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    
    try:
        chats = ragflow_client.list_chats(page=page, page_size=page_size)
        return jsonify({"code": 0, "data": chats})
    except Exception as e:
        return jsonify({"code": -1, "message": str(e)}), 500
