#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

from quart import Blueprint, jsonify
from api.services.ragflow_client import ragflow_client

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
        # Fetch counts from RAGFlow
        datasets = ragflow_client.list_datasets(page=1, page_size=1)
        chats = ragflow_client.list_chats(page=1, page_size=1)
        agents = ragflow_client.list_agents(page=1, page_size=1)
        
        return jsonify({
            "code": 0,
            "data": {
                "dataset_count": datasets.get("total", 0),
                "document_count": 0,  # TODO: implement document count
                "chat_count": chats.get("total", 0),
                "agent_count": agents.get("total", 0),
            }
        })
    except Exception as e:
        return jsonify({
            "code": -1,
            "message": str(e)
        }), 500
