#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import logging
from quart import Blueprint, jsonify, request
from api.services.mysql_client import mysql_client, MySQLClientError

logger = logging.getLogger(__name__)

manager = Blueprint("chat", __name__)


def _check_mysql_config():
    """Check if MySQL is configured."""
    from api.settings import settings
    return all([
        settings.mysql_host,
        settings.mysql_port,
        settings.mysql_database,
        settings.mysql_user,
    ])


@manager.route("", methods=["GET"])
async def list_chats():
    """
    List all chat assistants from all users (MySQL)
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
    if not _check_mysql_config():
        return jsonify({"code": -1, "message": "MySQL not configured"}), 500
    
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    name = request.args.get("name", None)
    
    try:
        result = await mysql_client.list_all_chats(
            page=page, 
            page_size=page_size, 
            name=name
        )
        return jsonify({"code": 0, "data": result})
    except MySQLClientError as e:
        logger.error(f"Failed to list chats: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error listing chats")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/batch-delete", methods=["POST"])
async def batch_delete_chats():
    """
    Delete chat assistants in batch (MySQL)
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
    if not _check_mysql_config():
        return jsonify({"code": -1, "message": "MySQL not configured"}), 500
    
    data = await request.get_json()
    ids = data.get("ids", [])
    
    if not ids:
        return jsonify({"code": -1, "message": "ids is required"}), 400
    
    try:
        # Cleans up: conversation, dialog (with transaction)
        result = await mysql_client.delete_chats(ids)
        return jsonify({
            "code": 0, 
            "message": "success", 
            "deleted": result["chats"],
            "details": result,
        })
    except MySQLClientError as e:
        logger.error(f"Failed to delete chats: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error deleting chats")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<chat_id>/sessions", methods=["GET"])
async def list_chat_sessions(chat_id: str):
    """
    List sessions for a chat assistant (MySQL)
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
    if not _check_mysql_config():
        return jsonify({"code": -1, "message": "MySQL not configured"}), 500
    
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 30, type=int)
    
    try:
        result = await mysql_client.get_chat_sessions(chat_id, page=page, page_size=page_size)
        return jsonify({"code": 0, "data": result})
    except MySQLClientError as e:
        logger.error(f"Failed to list chat sessions: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error listing chat sessions")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<chat_id>/sessions", methods=["DELETE"])
async def delete_chat_sessions(chat_id: str):
    """
    Delete sessions for a chat assistant (MySQL)
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
        description: Sessions deleted
    """
    if not _check_mysql_config():
        return jsonify({"code": -1, "message": "MySQL not configured"}), 500
    
    data = await request.get_json()
    ids = data.get("ids", [])
    
    if not ids:
        return jsonify({"code": -1, "message": "ids is required"}), 400
    
    try:
        deleted = await mysql_client.delete_sessions(chat_id, ids)
        return jsonify({"code": 0, "message": "success", "deleted": deleted})
    except MySQLClientError as e:
        logger.error(f"Failed to delete sessions: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error deleting sessions")
        return jsonify({"code": -1, "message": str(e)}), 500
