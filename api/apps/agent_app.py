#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import logging
from quart import Blueprint, jsonify, request
from api.services.mysql_client import mysql_client, MySQLClientError
from api.utils import check_mysql_configured

logger = logging.getLogger(__name__)

manager = Blueprint("agent", __name__)


@manager.route("", methods=["GET"])
async def list_agents():
    """List all agents."""
    if not check_mysql_configured():
        return jsonify({"code": -1, "message": "MySQL not configured"}), 500
    
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    title = request.args.get("title", None)
    owner = request.args.get("owner", None)
    
    try:
        result = await mysql_client.list_all_agents(
            page=page, 
            page_size=page_size, 
            title=title,
            owner=owner
        )
        return jsonify({"code": 0, "data": result})
    except MySQLClientError as e:
        logger.error(f"Failed to list agents: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error listing agents")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/batch-delete", methods=["POST"])
async def batch_delete_agents():
    """Delete agents in batch."""
    if not check_mysql_configured():
        return jsonify({"code": -1, "message": "MySQL not configured"}), 500
    
    data = await request.get_json()
    ids = data.get("ids", [])
    
    if not ids:
        return jsonify({"code": -1, "message": "ids is required"}), 400
    
    try:
        result = await mysql_client.delete_agents(ids)
        return jsonify({
            "code": 0, 
            "message": "success", 
            "deleted": result["agents"],
            "details": result,
        })
    except MySQLClientError as e:
        logger.error(f"Failed to delete agents: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error deleting agents")
        return jsonify({"code": -1, "message": str(e)}), 500
