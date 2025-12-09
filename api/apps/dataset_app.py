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

manager = Blueprint("dataset", __name__)


@manager.route("", methods=["GET"])
async def list_datasets():
    """
    List all datasets from all users (MySQL)
    ---
    tags:
      - Dataset
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
        description: Filter by dataset name
    responses:
      200:
        description: Dataset list
    """
    if not check_mysql_configured():
        return jsonify({"code": -1, "message": "MySQL not configured"}), 500
    
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    name = request.args.get("name", None)
    
    try:
        result = await mysql_client.list_all_datasets(
            page=page, 
            page_size=page_size, 
            name=name
        )
        return jsonify({"code": 0, "data": result})
    except MySQLClientError as e:
        logger.error(f"Failed to list datasets: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error listing datasets")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/batch-delete", methods=["POST"])
async def batch_delete_datasets():
    """
    Delete datasets in batch (MySQL)
    ---
    tags:
      - Dataset
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
        description: Datasets deleted successfully
    """
    if not check_mysql_configured():
        return jsonify({"code": -1, "message": "MySQL not configured"}), 500
    
    data = await request.get_json()
    ids = data.get("ids", [])
    
    if not ids:
        return jsonify({"code": -1, "message": "ids is required"}), 400
    
    try:
        # Cleans up: documents, tasks, file2document, knowledgebase
        result = await mysql_client.delete_datasets(ids)
        return jsonify({
            "code": 0, 
            "message": "success", 
            "deleted": result["datasets"],
            "details": result,
        })
    except MySQLClientError as e:
        logger.error(f"Failed to delete datasets: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error deleting datasets")
        return jsonify({"code": -1, "message": str(e)}), 500
