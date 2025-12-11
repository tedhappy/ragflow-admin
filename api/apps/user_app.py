#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import logging
from quart import Blueprint, jsonify, request
from api.services.mysql_client import mysql_client, MySQLClientError
from api.settings import settings

logger = logging.getLogger(__name__)

manager = Blueprint("user", __name__)


@manager.route("/owners", methods=["GET"])
async def get_owners():
    """Get all users as owners for filtering."""
    if not settings.is_mysql_configured:
        return jsonify({"code": -1, "message": "MySQL not configured"}), 400
    
    try:
        result = await mysql_client.get_all_owners()
        return jsonify({"code": 0, "data": result})
    except MySQLClientError as e:
        logger.error(f"Failed to get owners: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error getting owners")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("", methods=["GET"])
async def list_users():
    """List all users."""
    if not settings.is_mysql_configured:
        return jsonify({"code": -1, "message": "MySQL not configured"}), 400
    
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    keyword = request.args.get("keyword", None)
    status = request.args.get("status", None)
    
    try:
        result = await mysql_client.list_users(
            page=page, page_size=page_size, 
            keyword=keyword, status=status
        )
        return jsonify({"code": 0, "data": result})
    except MySQLClientError as e:
        logger.error(f"Failed to list users: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error listing users")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("", methods=["POST"])
async def create_user():
    """Create a new user."""
    if not settings.is_mysql_configured:
        return jsonify({"code": -1, "message": "MySQL not configured"}), 400
    
    data = await request.get_json()
    email = data.get("email", "").strip()
    password = data.get("password", "")
    nickname = data.get("nickname", "").strip()
    
    if not email or not password or not nickname:
        return jsonify({"code": -1, "message": "email, password and nickname are required"}), 400
    
    try:
        result = await mysql_client.create_user(email=email, password=password, nickname=nickname)
        return jsonify({"code": 0, "data": result})
    except MySQLClientError as e:
        logger.error(f"Failed to create user: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error creating user")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<user_id>/status", methods=["PUT"])
async def update_user_status(user_id: str):
    """Update user status."""
    if not settings.is_mysql_configured:
        return jsonify({"code": -1, "message": "MySQL not configured"}), 400
    
    data = await request.get_json()
    status = data.get("status", "")
    
    if status not in ["0", "1"]:
        return jsonify({"code": -1, "message": "status must be '0' or '1'"}), 400
    
    try:
        success = await mysql_client.update_user_status(user_id, status)
        if success:
            return jsonify({"code": 0, "message": "Status updated"})
        else:
            return jsonify({"code": -1, "message": "User not found"}), 404
    except Exception as e:
        logger.exception("Failed to update user status")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<user_id>/password", methods=["PUT"])
async def update_user_password(user_id: str):
    """Update user password."""
    if not settings.is_mysql_configured:
        return jsonify({"code": -1, "message": "MySQL not configured"}), 400
    
    data = await request.get_json()
    password = data.get("password", "")
    
    if not password:
        return jsonify({"code": -1, "message": "password is required"}), 400
    
    try:
        success = await mysql_client.update_user_password(user_id, password)
        if success:
            return jsonify({"code": 0, "message": "Password updated"})
        else:
            return jsonify({"code": -1, "message": "User not found"}), 404
    except Exception as e:
        logger.exception("Failed to update user password")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/batch-delete", methods=["POST"])
async def batch_delete_users():
    """Delete users in batch."""
    if not settings.is_mysql_configured:
        return jsonify({"code": -1, "message": "MySQL not configured"}), 400
    
    data = await request.get_json()
    ids = data.get("ids", [])
    
    if not ids:
        return jsonify({"code": -1, "message": "ids is required"}), 400
    
    try:
        result = await mysql_client.delete_users(ids)
        return jsonify({
            "code": 0, 
            "message": "success",
            "deleted": result["users"],
            "details": result,
        })
    except Exception as e:
        logger.exception("Failed to delete users")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<user_id>", methods=["GET"])
async def get_user(user_id: str):
    """Get user detail by ID."""
    if not settings.is_mysql_configured:
        return jsonify({"code": -1, "message": "MySQL not configured"}), 400
    
    try:
        user = await mysql_client.get_user(user_id)
        if not user:
            return jsonify({"code": -1, "message": "User not found"}), 404
        return jsonify({"code": 0, "data": user})
    except MySQLClientError as e:
        logger.error(f"Failed to get user: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error getting user")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<user_id>/datasets", methods=["GET"])
async def get_user_datasets(user_id: str):
    """Get datasets owned by a user."""
    if not settings.is_mysql_configured:
        return jsonify({"code": -1, "message": "MySQL not configured"}), 400
    
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    
    try:
        result = await mysql_client.get_user_datasets(user_id, page=page, page_size=page_size)
        return jsonify({"code": 0, "data": result})
    except MySQLClientError as e:
        logger.error(f"Failed to get user datasets: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error getting user datasets")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<user_id>/agents", methods=["GET"])
async def get_user_agents(user_id: str):
    """Get agents owned by a user."""
    if not settings.is_mysql_configured:
        return jsonify({"code": -1, "message": "MySQL not configured"}), 400
    
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    
    try:
        result = await mysql_client.get_user_agents(user_id, page=page, page_size=page_size)
        return jsonify({"code": 0, "data": result})
    except MySQLClientError as e:
        logger.error(f"Failed to get user agents: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error getting user agents")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<user_id>/chats", methods=["GET"])
async def get_user_chats(user_id: str):
    """Get chats owned by a user."""
    if not settings.is_mysql_configured:
        return jsonify({"code": -1, "message": "MySQL not configured"}), 400
    
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    
    try:
        result = await mysql_client.get_user_chats(user_id, page=page, page_size=page_size)
        return jsonify({"code": 0, "data": result})
    except MySQLClientError as e:
        logger.error(f"Failed to get user chats: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error getting user chats")
        return jsonify({"code": -1, "message": str(e)}), 500
