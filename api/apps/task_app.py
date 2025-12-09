#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

"""
Task Queue Management API.

Provides endpoints for viewing and managing document parsing tasks
across all datasets in the RAGFlow system.
"""

import logging
from quart import Blueprint, jsonify, request
from api.services.mysql_client import mysql_client, MySQLClientError
from api.services.ragflow_client import ragflow_client, RAGFlowAPIError

logger = logging.getLogger(__name__)

manager = Blueprint("task", __name__)


@manager.route("/", methods=["GET"])
async def list_tasks():
    """
    List all document parsing tasks across all datasets
    ---
    tags:
      - Task
    parameters:
      - name: page
        in: query
        type: integer
        default: 1
      - name: page_size
        in: query
        type: integer
        default: 20
      - name: status
        in: query
        type: string
        description: Filter by status (UNSTART, RUNNING, CANCEL, DONE, FAIL)
      - name: dataset_name
        in: query
        type: string
        description: Filter by dataset name
      - name: doc_name
        in: query
        type: string
        description: Filter by document name
    responses:
      200:
        description: Task list
    """
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    status = request.args.get("status", None)
    dataset_name = request.args.get("dataset_name", None)
    doc_name = request.args.get("doc_name", None)
    
    try:
        result = await mysql_client.list_parsing_tasks(
            page=page,
            page_size=page_size,
            status=status,
            dataset_name=dataset_name,
            doc_name=doc_name
        )
        return jsonify({"code": 0, "data": result})
    except MySQLClientError as e:
        logger.error(f"Failed to list tasks: {e.message}")
        return jsonify({"code": -1, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error listing tasks")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/stats", methods=["GET"])
async def get_stats():
    """
    Get parsing task statistics
    ---
    tags:
      - Task
    responses:
      200:
        description: Task statistics
    """
    try:
        result = await mysql_client.get_parsing_stats()
        return jsonify({"code": 0, "data": result})
    except MySQLClientError as e:
        logger.error(f"Failed to get task stats: {e.message}")
        return jsonify({"code": -1, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error getting task stats")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/parse", methods=["POST"])
async def batch_parse():
    """
    Start parsing for multiple documents
    ---
    tags:
      - Task
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            tasks:
              type: array
              items:
                type: object
                properties:
                  dataset_id:
                    type: string
                  document_ids:
                    type: array
                    items:
                      type: string
    responses:
      200:
        description: Documents parsing started
    """
    data = await request.get_json()
    tasks = data.get("tasks", [])
    
    if not tasks:
        return jsonify({"code": -1, "message": "tasks is required"}), 400
    
    results = []
    errors = []
    
    for task in tasks:
        dataset_id = task.get("dataset_id")
        document_ids = task.get("document_ids", [])
        
        if not dataset_id or not document_ids:
            continue
        
        try:
            await ragflow_client.parse_documents(dataset_id=dataset_id, document_ids=document_ids)
            results.append({
                "dataset_id": dataset_id,
                "document_ids": document_ids,
                "success": True
            })
        except RAGFlowAPIError as e:
            errors.append({
                "dataset_id": dataset_id,
                "document_ids": document_ids,
                "error": e.message
            })
        except Exception as e:
            errors.append({
                "dataset_id": dataset_id,
                "document_ids": document_ids,
                "error": str(e)
            })
    
    return jsonify({
        "code": 0,
        "data": {
            "success": results,
            "errors": errors,
            "total_success": len(results),
            "total_errors": len(errors)
        }
    })


@manager.route("/stop", methods=["POST"])
async def batch_stop():
    """
    Stop parsing for multiple documents
    ---
    tags:
      - Task
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            tasks:
              type: array
              items:
                type: object
                properties:
                  dataset_id:
                    type: string
                  document_ids:
                    type: array
                    items:
                      type: string
    responses:
      200:
        description: Documents parsing stopped
    """
    data = await request.get_json()
    tasks = data.get("tasks", [])
    
    if not tasks:
        return jsonify({"code": -1, "message": "tasks is required"}), 400
    
    results = []
    errors = []
    
    for task in tasks:
        dataset_id = task.get("dataset_id")
        document_ids = task.get("document_ids", [])
        
        if not dataset_id or not document_ids:
            continue
        
        try:
            await ragflow_client.stop_parsing_documents(dataset_id=dataset_id, document_ids=document_ids)
            results.append({
                "dataset_id": dataset_id,
                "document_ids": document_ids,
                "success": True
            })
        except RAGFlowAPIError as e:
            errors.append({
                "dataset_id": dataset_id,
                "document_ids": document_ids,
                "error": e.message
            })
        except Exception as e:
            errors.append({
                "dataset_id": dataset_id,
                "document_ids": document_ids,
                "error": str(e)
            })
    
    return jsonify({
        "code": 0,
        "data": {
            "success": results,
            "errors": errors,
            "total_success": len(results),
            "total_errors": len(errors)
        }
    })


@manager.route("/retry-failed", methods=["POST"])
async def retry_failed():
    """
    Retry all failed parsing tasks
    ---
    tags:
      - Task
    responses:
      200:
        description: Failed tasks retried
    """
    try:
        # Get all failed tasks
        result = await mysql_client.list_parsing_tasks(
            page=1,
            page_size=1000,
            status="FAIL"
        )
        
        failed_tasks = result.get("items", [])
        
        if not failed_tasks:
            return jsonify({
                "code": 0,
                "data": {
                    "message": "No failed tasks to retry",
                    "retried": 0
                }
            })
        
        # Group by dataset
        dataset_docs = {}
        for task in failed_tasks:
            dataset_id = task.get("dataset_id")
            doc_id = task.get("id")
            if dataset_id and doc_id:
                if dataset_id not in dataset_docs:
                    dataset_docs[dataset_id] = []
                dataset_docs[dataset_id].append(doc_id)
        
        # Retry parsing
        results = []
        errors = []
        
        for dataset_id, document_ids in dataset_docs.items():
            try:
                await ragflow_client.parse_documents(dataset_id=dataset_id, document_ids=document_ids)
                results.append({
                    "dataset_id": dataset_id,
                    "count": len(document_ids)
                })
            except RAGFlowAPIError as e:
                errors.append({
                    "dataset_id": dataset_id,
                    "count": len(document_ids),
                    "error": e.message
                })
            except Exception as e:
                errors.append({
                    "dataset_id": dataset_id,
                    "count": len(document_ids),
                    "error": str(e)
                })
        
        total_retried = sum(r["count"] for r in results)
        
        return jsonify({
            "code": 0,
            "data": {
                "retried": total_retried,
                "success": results,
                "errors": errors
            }
        })
    except MySQLClientError as e:
        logger.error(f"Failed to retry failed tasks: {e.message}")
        return jsonify({"code": -1, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error retrying failed tasks")
        return jsonify({"code": -1, "message": str(e)}), 500
