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
        # Fetch all items to get accurate counts
        datasets = ragflow_client.list_datasets(page=1, page_size=1000)
        chats = ragflow_client.list_chats(page=1, page_size=1000)
        agents = ragflow_client.list_agents(page=1, page_size=1000)
        
        # Calculate document count from all datasets
        document_count = 0
        for ds in datasets.get("items", []):
            document_count += ds.get("document_count", 0) or 0
        
        return jsonify({
            "code": 0,
            "data": {
                "dataset_count": len(datasets.get("items", [])),
                "document_count": document_count,
                "chat_count": len(chats.get("items", [])),
                "agent_count": len(agents.get("items", [])),
            }
        })
    except Exception as e:
        return jsonify({
            "code": -1,
            "message": str(e)
        }), 500
