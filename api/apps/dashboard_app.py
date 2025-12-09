#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import logging
from quart import Blueprint, jsonify
from api.services.mysql_client import mysql_client, MySQLClientError
from api.utils import check_mysql_configured

logger = logging.getLogger(__name__)

manager = Blueprint("dashboard", __name__)


@manager.route("/stats", methods=["GET"])
async def get_stats():
    """
    Get dashboard statistics from MySQL
    ---
    tags:
      - Dashboard
    responses:
      200:
        description: Dashboard statistics
    """
    if not check_mysql_configured():
        return jsonify({"code": -1, "message": "MySQL not configured"}), 500
    
    try:
        stats = await mysql_client.get_dashboard_stats()
        return jsonify({
            "code": 0,
            "data": stats
        })
    except MySQLClientError as e:
        logger.error(f"Failed to get dashboard stats: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error getting dashboard stats")
        return jsonify({"code": -1, "message": str(e)}), 500
