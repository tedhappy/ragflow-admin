#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import logging
from quart import Blueprint, jsonify, request
from api.services.ragflow_client import ragflow_client, RAGFlowAPIError

logger = logging.getLogger(__name__)

manager = Blueprint("document", __name__)


@manager.route("/<dataset_id>/documents", methods=["GET"])
async def list_documents(dataset_id: str):
    """
    List documents in a dataset
    ---
    tags:
      - Document
    parameters:
      - name: dataset_id
        in: path
        type: string
        required: true
        description: Dataset ID
      - name: page
        in: query
        type: integer
        default: 1
      - name: page_size
        in: query
        type: integer
        default: 20
      - name: keywords
        in: query
        type: string
        description: Filter by document name
    responses:
      200:
        description: Document list
    """
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    keywords = request.args.get("keywords", None)
    
    try:
        kwargs = {}
        if keywords:
            kwargs["keywords"] = keywords
        result = await ragflow_client.list_documents(
            dataset_id=dataset_id, 
            page=page, 
            page_size=page_size, 
            **kwargs
        )
        return jsonify({"code": 0, "data": result})
    except RAGFlowAPIError as e:
        logger.error(f"Failed to list documents: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error listing documents")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<dataset_id>/documents/batch-delete", methods=["POST"])
async def batch_delete_documents(dataset_id: str):
    """
    Delete documents in batch
    ---
    tags:
      - Document
    parameters:
      - name: dataset_id
        in: path
        type: string
        required: true
        description: Dataset ID
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
        description: Documents deleted successfully
    """
    data = await request.get_json()
    ids = data.get("ids", [])
    
    if not ids:
        return jsonify({"code": -1, "message": "ids is required"}), 400
    
    try:
        await ragflow_client.delete_documents(dataset_id=dataset_id, ids=ids)
        return jsonify({"code": 0, "message": "success"})
    except RAGFlowAPIError as e:
        logger.error(f"Failed to delete documents: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error deleting documents")
        return jsonify({"code": -1, "message": str(e)}), 500
