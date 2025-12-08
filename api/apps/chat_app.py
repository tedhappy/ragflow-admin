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


@manager.route("/<chat_id>/sessions", methods=["GET"])
async def list_chat_sessions(chat_id: str):
    """
    List sessions for a chat assistant
    ---
    tags:
      - Chat
    parameters:
      - name: chat_id
        in: path
        type: string
        required: true
      - name: page
        in: query
        type: integer
        default: 1
      - name: page_size
        in: query
        type: integer
        default: 30
    responses:
      200:
        description: Session list
    """
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 30, type=int)
    
    try:
        result = await ragflow_client.list_chat_sessions(chat_id, page=page, page_size=page_size)
        return jsonify({"code": 0, "data": result})
    except RAGFlowAPIError as e:
        logger.error(f"Failed to list chat sessions: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error listing chat sessions")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<chat_id>/sessions", methods=["DELETE"])
async def delete_chat_sessions(chat_id: str):
    """
    Delete sessions for a chat assistant
    ---
    tags:
      - Chat
    parameters:
      - name: chat_id
        in: path
        type: string
        required: true
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
        description: Sessions deleted successfully
    """
    data = await request.get_json()
    session_ids = data.get("ids", [])
    
    if not session_ids:
        return jsonify({"code": -1, "message": "ids is required"}), 400
    
    try:
        await ragflow_client.delete_chat_sessions(chat_id, session_ids=session_ids)
        return jsonify({"code": 0, "message": "success"})
    except RAGFlowAPIError as e:
        logger.error(f"Failed to delete chat sessions: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error deleting chat sessions")
        return jsonify({"code": -1, "message": str(e)}), 500
