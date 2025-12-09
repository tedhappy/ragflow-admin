#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import logging
import mimetypes
from quart import Blueprint, jsonify, request
from api.services.ragflow_client import ragflow_client, RAGFlowAPIError
from api.services.mysql_client import mysql_client, MySQLClientError

logger = logging.getLogger(__name__)

manager = Blueprint("document", __name__)

# Allowed file extensions for upload (consistent with RAGFlow)
# Reference: ragflow/api/utils/file_utils.py - filename_type()
ALLOWED_EXTENSIONS = {
    # PDF
    'pdf',
    # Documents
    'msg', 'eml', 'doc', 'docx', 'ppt', 'pptx', 'yml', 'xml', 'htm', 
    'json', 'jsonl', 'ldjson', 'csv', 'txt', 'ini', 'xls', 'xlsx', 
    'wps', 'rtf', 'hlp', 'pages', 'numbers', 'key', 'md',
    # Code files
    'py', 'js', 'java', 'c', 'cpp', 'h', 'php', 'go', 'ts', 'sh', 'cs', 'kt', 'html', 'sql',
    # Audio
    'wav', 'flac', 'ape', 'alac', 'wavpack', 'wv', 'mp3', 'aac', 'ogg', 'vorbis', 'opus',
    # Visual (Images)
    'jpg', 'jpeg', 'png', 'tif', 'gif', 'pcx', 'tga', 'exif', 'fpx', 'svg', 
    'psd', 'cdr', 'pcd', 'dxf', 'ufo', 'eps', 'ai', 'raw', 'wmf', 'webp', 
    'avif', 'apng', 'icon', 'ico',
    # Visual (Videos)
    'mpg', 'mpeg', 'avi', 'rm', 'rmvb', 'mov', 'wmv', 'asf', 'dat', 
    'asx', 'wvx', 'mpe', 'mpa', 'mp4', 'mkv',
}

def allowed_file(filename: str) -> bool:
    """Check if the file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


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
      - name: run
        in: query
        type: string
        description: Filter by status (UNSTART, RUNNING, CANCEL, DONE, FAIL)
    responses:
      200:
        description: Document list
    """
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    keywords = request.args.get("keywords", None)
    run_status = request.args.get("run", None)
    
    try:
        # Use MySQL for document listing (no RAGFlow API required)
        kwargs = {}
        if keywords:
            kwargs["keywords"] = keywords
        if run_status:
            kwargs["run"] = run_status
        result = await mysql_client.list_documents(
            dataset_id=dataset_id, 
            page=page, 
            page_size=page_size, 
            **kwargs
        )
        return jsonify({"code": 0, "data": result})
    except MySQLClientError as e:
        logger.error(f"Failed to list documents: {e.message}")
        return jsonify({"code": -1, "message": e.message}), 500
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
        # Use MySQL for document deletion (no RAGFlow API required)
        # Cleans up: document, task, file2document tables
        # Note: ES chunks and MinIO files are NOT deleted without RAGFlow API
        result = await mysql_client.delete_documents(dataset_id=dataset_id, document_ids=ids)
        return jsonify({
            "code": 0, 
            "message": "success", 
            "deleted": result["documents"],
            "details": result,
        })
    except MySQLClientError as e:
        logger.error(f"Failed to delete documents: {e.message}")
        return jsonify({"code": -1, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error deleting documents")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<dataset_id>/documents/upload", methods=["POST"])
async def upload_documents(dataset_id: str):
    """
    Upload documents to a dataset
    ---
    tags:
      - Document
    parameters:
      - name: dataset_id
        in: path
        type: string
        required: true
        description: Dataset ID
      - name: file
        in: formData
        type: file
        required: true
        description: Files to upload (multiple files allowed)
    responses:
      200:
        description: Documents uploaded successfully
    """
    try:
        files = await request.files
        file_list = files.getlist("file")
        
        logger.info(f"Upload request received, file count: {len(file_list) if file_list else 0}")
        
        if not file_list:
            return jsonify({"code": -1, "message": "No files provided"}), 400
        
        # Validate and prepare files
        files_to_upload = []
        invalid_files = []
        
        for file in file_list:
            if file.filename == '':
                continue
            
            if not allowed_file(file.filename):
                invalid_files.append(file.filename)
                continue
            
            # Read file content
            content = file.read()
            content_type = mimetypes.guess_type(file.filename)[0] or 'application/octet-stream'
            files_to_upload.append((file.filename, content, content_type))
            logger.info(f"File prepared: {file.filename}, size: {len(content)} bytes")
        
        if not files_to_upload:
            if invalid_files:
                return jsonify({
                    "code": -1, 
                    "message": f"Invalid file types: {', '.join(invalid_files)}"
                }), 400
            return jsonify({"code": -1, "message": "No valid files provided"}), 400
        
        # Upload files
        result = await ragflow_client.upload_documents(dataset_id=dataset_id, files=files_to_upload)
        
        response_data = {
            "uploaded": result,
            "count": len(result) if isinstance(result, list) else 1
        }
        
        if invalid_files:
            response_data["skipped"] = invalid_files
        
        return jsonify({"code": 0, "data": response_data})
    except RAGFlowAPIError as e:
        logger.error(f"Failed to upload documents: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error uploading documents")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<dataset_id>/documents/parse", methods=["POST"])
async def parse_documents(dataset_id: str):
    """
    Parse (chunk) documents in a dataset
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
            document_ids:
              type: array
              items:
                type: string
              description: Document IDs to parse
    responses:
      200:
        description: Documents parsing started successfully
    """
    data = await request.get_json()
    document_ids = data.get("document_ids", [])
    
    if not document_ids:
        return jsonify({"code": -1, "message": "document_ids is required"}), 400
    
    try:
        await ragflow_client.parse_documents(dataset_id=dataset_id, document_ids=document_ids)
        return jsonify({"code": 0, "message": "success"})
    except RAGFlowAPIError as e:
        logger.error(f"Failed to parse documents: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error parsing documents")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<dataset_id>/documents/stop-parse", methods=["POST"])
async def stop_parsing_documents(dataset_id: str):
    """
    Stop parsing documents in a dataset
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
            document_ids:
              type: array
              items:
                type: string
              description: Document IDs to stop parsing
    responses:
      200:
        description: Document parsing stopped successfully
    """
    data = await request.get_json()
    document_ids = data.get("document_ids", [])
    
    if not document_ids:
        return jsonify({"code": -1, "message": "document_ids is required"}), 400
    
    try:
        await ragflow_client.stop_parsing_documents(dataset_id=dataset_id, document_ids=document_ids)
        return jsonify({"code": 0, "message": "success"})
    except RAGFlowAPIError as e:
        logger.error(f"Failed to stop parsing documents: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error stopping document parsing")
        return jsonify({"code": -1, "message": str(e)}), 500
