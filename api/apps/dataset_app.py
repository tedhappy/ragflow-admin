#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

from quart import Blueprint, jsonify, request
from api.services.ragflow_client import ragflow_client

manager = Blueprint("dataset", __name__)


@manager.route("", methods=["GET"])
async def list_datasets():
    """
    获取数据集列表
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
    responses:
      200:
        description: 数据集列表
    """
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    
    try:
        datasets = ragflow_client.list_datasets(page=page, page_size=page_size)
        return jsonify({"code": 0, "data": datasets})
    except Exception as e:
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("", methods=["POST"])
async def create_dataset():
    """
    创建数据集
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
            name:
              type: string
    responses:
      200:
        description: 创建成功
    """
    data = await request.get_json()
    name = data.get("name")
    
    if not name:
        return jsonify({"code": -1, "message": "name is required"}), 400
    
    try:
        dataset = ragflow_client.create_dataset(name=name)
        return jsonify({"code": 0, "data": dataset})
    except Exception as e:
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/batch-delete", methods=["POST"])
async def batch_delete_datasets():
    """
    批量删除数据集
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
        description: 删除成功
    """
    data = await request.get_json()
    ids = data.get("ids", [])
    
    if not ids:
        return jsonify({"code": -1, "message": "ids is required"}), 400
    
    try:
        ragflow_client.delete_datasets(ids=ids)
        return jsonify({"code": 0, "message": "success"})
    except Exception as e:
        return jsonify({"code": -1, "message": str(e)}), 500
