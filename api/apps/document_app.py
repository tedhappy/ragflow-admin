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
from api.settings import settings

logger = logging.getLogger(__name__)


async def check_dataset_ownership(dataset_id: str) -> tuple:
    """Check if the dataset belongs to the current API key user."""
    try:
        current_user_info = await ragflow_client.get_current_user()
        current_user_id = current_user_info.get("user_id")
        
        if not current_user_id:
            return True, None, None, None
        
        if not settings.is_mysql_configured:
            return True, None, None, None
        
        dataset_info = await mysql_client.get_dataset(dataset_id)
        if not dataset_info:
            return True, None, None, None
        
        owner_id = dataset_info.get("tenant_id")
        
        if current_user_id == owner_id:
            return True, None, None, None
        
        current_user = await mysql_client.get_user(current_user_id) if current_user_id else None
        owner_user = await mysql_client.get_user(owner_id) if owner_id else None
        
        current_email = current_user.get("email") if current_user else current_user_id
        owner_email = owner_user.get("email") if owner_user else owner_id
        
        return False, current_email, owner_email, f"Permission denied: API Key user ({current_email}) cannot operate on dataset owned by {owner_email}"
    except Exception as e:
        logger.warning(f"Failed to check dataset ownership: {e}")
        return True, None, None, None

manager = Blueprint("document", __name__)

ALLOWED_EXTENSIONS = {
    'pdf',
    'msg', 'eml', 'doc', 'docx', 'ppt', 'pptx', 'yml', 'xml', 'htm', 
    'json', 'jsonl', 'ldjson', 'csv', 'txt', 'ini', 'xls', 'xlsx', 
    'wps', 'rtf', 'hlp', 'pages', 'numbers', 'key', 'md',
    'py', 'js', 'java', 'c', 'cpp', 'h', 'php', 'go', 'ts', 'sh', 'cs', 'kt', 'html', 'sql',
    'wav', 'flac', 'ape', 'alac', 'wavpack', 'wv', 'mp3', 'aac', 'ogg', 'vorbis', 'opus',
    'jpg', 'jpeg', 'png', 'tif', 'gif', 'pcx', 'tga', 'exif', 'fpx', 'svg', 
    'psd', 'cdr', 'pcd', 'dxf', 'ufo', 'eps', 'ai', 'raw', 'wmf', 'webp', 
    'avif', 'apng', 'icon', 'ico',
    'mpg', 'mpeg', 'avi', 'rm', 'rmvb', 'mov', 'wmv', 'asf', 'dat', 
    'asx', 'wvx', 'mpe', 'mpa', 'mp4', 'mkv',
}

def allowed_file(filename: str) -> bool:
    """Check if the file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@manager.route("/<dataset_id>/documents", methods=["GET"])
async def list_documents(dataset_id: str):
    """List documents in a dataset."""
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    keywords = request.args.get("keywords", None)
    run_status = request.args.get("run", None)
    
    try:
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
    """Delete documents in batch."""
    data = await request.get_json()
    ids = data.get("ids", [])
    
    if not ids:
        return jsonify({"code": -1, "message": "ids is required"}), 400
    
    is_owner, current_user, owner, error_msg = await check_dataset_ownership(dataset_id)
    if not is_owner:
        return jsonify({
            "code": -1, 
            "message": error_msg,
            "error_type": "owner_mismatch",
            "current_user": current_user,
            "owner": owner
        }), 403
    
    try:
        await ragflow_client.delete_documents(dataset_id=dataset_id, ids=ids)
        return jsonify({
            "code": 0, 
            "message": "success", 
            "deleted": len(ids),
        })
    except RAGFlowAPIError as e:
        logger.error(f"Failed to delete documents: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error deleting documents")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<dataset_id>/documents/check-ownership", methods=["POST"])
async def check_ownership_endpoint(dataset_id: str):
    """Check dataset ownership before upload."""
    is_owner, current_user, owner, error_msg = await check_dataset_ownership(dataset_id)
    if not is_owner:
        return jsonify({
            "code": -1, 
            "message": error_msg,
            "error_type": "owner_mismatch",
            "current_user": current_user,
            "owner": owner
        }), 403
    
    return jsonify({"code": 0, "message": "Ownership check passed"})


@manager.route("/<dataset_id>/documents/upload", methods=["POST"])
async def upload_documents(dataset_id: str):
    """Upload documents to a dataset."""
    is_owner, current_user, owner, error_msg = await check_dataset_ownership(dataset_id)
    if not is_owner:
        return jsonify({
            "code": -1, 
            "message": error_msg,
            "error_type": "owner_mismatch",
            "current_user": current_user,
            "owner": owner
        }), 403
    
    try:
        files = await request.files
        file_list = files.getlist("file")
        
        logger.info(f"Upload request received, file count: {len(file_list) if file_list else 0}")
        
        if not file_list:
            return jsonify({"code": -1, "message": "No files provided"}), 400
        
        files_to_upload = []
        invalid_files = []
        
        for file in file_list:
            if file.filename == '':
                continue
            
            if not allowed_file(file.filename):
                invalid_files.append(file.filename)
                continue
            
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
    """Parse documents in a dataset."""
    data = await request.get_json()
    document_ids = data.get("document_ids", [])
    
    if not document_ids:
        return jsonify({"code": -1, "message": "document_ids is required"}), 400
    
    is_owner, current_user, owner, error_msg = await check_dataset_ownership(dataset_id)
    if not is_owner:
        return jsonify({
            "code": -1, 
            "message": error_msg,
            "error_type": "owner_mismatch",
            "current_user": current_user,
            "owner": owner
        }), 403
    
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
    """Stop parsing documents in a dataset."""
    data = await request.get_json()
    document_ids = data.get("document_ids", [])
    
    if not document_ids:
        return jsonify({"code": -1, "message": "document_ids is required"}), 400
    
    is_owner, current_user, owner, error_msg = await check_dataset_ownership(dataset_id)
    if not is_owner:
        return jsonify({
            "code": -1, 
            "message": error_msg,
            "error_type": "owner_mismatch",
            "current_user": current_user,
            "owner": owner
        }), 403
    
    try:
        await ragflow_client.stop_parsing_documents(dataset_id=dataset_id, document_ids=document_ids)
        return jsonify({"code": 0, "message": "success"})
    except RAGFlowAPIError as e:
        logger.error(f"Failed to stop parsing documents: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error stopping document parsing")
        return jsonify({"code": -1, "message": str(e)}), 500
