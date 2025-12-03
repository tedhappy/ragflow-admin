#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import logging
from quart import Blueprint, jsonify, request
from api.services.ragflow_client import ragflow_client, RAGFlowAPIError

logger = logging.getLogger(__name__)

manager = Blueprint("agent", __name__)


@manager.route("", methods=["GET"])
async def list_agents():
    """
    List all agents
    ---
    tags:
      - Agent
    parameters:
      - name: page
        in: query
        type: integer
        default: 1
      - name: page_size
        in: query
        type: integer
        default: 20
      - name: title
        in: query
        type: string
        description: Filter by agent title
    responses:
      200:
        description: Agent list
    """
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    title = request.args.get("title", None)
    
    try:
        kwargs = {}
        if title:
            kwargs["title"] = title
        result = await ragflow_client.list_agents(page=page, page_size=page_size, **kwargs)
        return jsonify({"code": 0, "data": result})
    except RAGFlowAPIError as e:
        logger.error(f"Failed to list agents: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error listing agents")
        return jsonify({"code": -1, "message": str(e)}), 500
