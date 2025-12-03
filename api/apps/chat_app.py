#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import logging
from quart import Blueprint, jsonify, request
from api.services.ragflow_client import ragflow_client, RAGFlowAPIError

logger = logging.getLogger(__name__)

manager = Blueprint("chat", __name__)


@manager.route("", methods=["GET"])
async def list_chats():
    """
    List all chat assistants
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
      - name: name
        in: query
        type: string
        description: Filter by chat name
    responses:
      200:
        description: Chat assistant list
    """
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    name = request.args.get("name", None)
    
    try:
        kwargs = {}
        if name:
            kwargs["name"] = name
        result = await ragflow_client.list_chats(page=page, page_size=page_size, **kwargs)
        return jsonify({"code": 0, "data": result})
    except RAGFlowAPIError as e:
        logger.error(f"Failed to list chats: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error listing chats")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/batch-delete", methods=["POST"])
async def batch_delete_chats():
    """
    Delete chat assistants in batch
    ---
    tags:
      - Chat
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            ids:
              type: array
              items:
                type: string
    responses:
      200:
        description: Chats deleted successfully
    """
    data = await request.get_json()
    ids = data.get("ids", [])
    
    if not ids:
        return jsonify({"code": -1, "message": "ids is required"}), 400
    
    try:
        await ragflow_client.delete_chats(ids=ids)
        return jsonify({"code": 0, "message": "success"})
    except RAGFlowAPIError as e:
        logger.error(f"Failed to delete chats: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error deleting chats")
        return jsonify({"code": -1, "message": str(e)}), 500
