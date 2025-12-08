#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import asyncio
import logging
from quart import Blueprint, jsonify
from api.services.ragflow_client import ragflow_client, RAGFlowAPIError
from api.services.mysql_client import mysql_client
from api.settings import settings

logger = logging.getLogger(__name__)

manager = Blueprint("dashboard", __name__)


@manager.route("/stats", methods=["GET"])
async def get_stats():
    """
    Get dashboard statistics
    ---
    tags:
      - Dashboard
    responses:
      200:
        description: Dashboard statistics
    """
    try:
        # Fetch all items concurrently for better performance
        datasets_task = ragflow_client.list_datasets(page=1, page_size=1000)
        chats_task = ragflow_client.list_chats(page=1, page_size=1000)
        agents_task = ragflow_client.list_agents(page=1, page_size=1000)
        
        datasets, chats, agents = await asyncio.gather(
            datasets_task, chats_task, agents_task
        )
        
        # Calculate document count from all datasets
        document_count = sum(
            ds.get("document_count", 0) or 0 
            for ds in datasets.get("items", [])
        )
        
        # Get user count from MySQL if configured
        user_count = 0
        if settings.is_mysql_configured:
            try:
                users = await mysql_client.list_users(page=1, page_size=1)
                user_count = users.get("total", 0)
            except Exception as e:
                logger.warning(f"Failed to get user count: {e}")
        
        return jsonify({
            "code": 0,
            "data": {
                "dataset_count": datasets.get("total", 0),
                "document_count": document_count,
                "chat_count": chats.get("total", 0),
                "agent_count": agents.get("total", 0),
                "user_count": user_count,
            }
        })
    except RAGFlowAPIError as e:
        logger.error(f"Failed to get dashboard stats: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error getting dashboard stats")
        return jsonify({"code": -1, "message": str(e)}), 500
