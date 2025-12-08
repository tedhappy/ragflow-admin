#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import logging
from quart import Blueprint, jsonify, request
from api.services.mysql_client import mysql_client, MySQLClientError
from api.settings import settings

logger = logging.getLogger(__name__)

manager = Blueprint("user", __name__)


@manager.route("/config", methods=["GET"])
async def get_mysql_config():
    """
    Get MySQL configuration status
    ---
    tags:
      - User
    responses:
      200:
        description: MySQL configuration status
    """
    return jsonify({
        "code": 0,
        "data": {
            "configured": settings.is_mysql_configured,
            "host": settings.mysql_host,
            "port": settings.mysql_port,
            "database": settings.mysql_database,
            "user": settings.mysql_user,
            # Don't expose password
        }
    })


@manager.route("/config", methods=["POST"])
async def save_mysql_config():
    """
    Save MySQL configuration
    ---
    tags:
      - User
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            host:
              type: string
            port:
              type: integer
            database:
              type: string
            user:
              type: string
            password:
              type: string
    responses:
      200:
        description: Configuration saved
    """
    data = await request.get_json()
    host = data.get("host", "")
    port = data.get("port", 3306)
    database = data.get("database", "")
    user = data.get("user", "")
    password = data.get("password", "")
    
    if not all([host, database, user]):
        return jsonify({"code": -1, "message": "host, database and user are required"}), 400
    
    try:
        # Update config
        success = settings.update_mysql_config(host, port, database, user, password)
        if not success:
            return jsonify({"code": -1, "message": "Failed to save configuration"}), 500
        
        # Close existing pool to use new config
        await mysql_client.close()
        
        return jsonify({"code": 0, "message": "Configuration saved"})
    except Exception as e:
        logger.exception("Failed to save MySQL config")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/config/test", methods=["POST"])
async def test_mysql_connection():
    """
    Test MySQL connection with provided config
    ---
    tags:
      - User
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            host:
              type: string
            port:
              type: integer
            database:
              type: string
            user:
              type: string
            password:
              type: string
    responses:
      200:
        description: Connection test result
    """
    data = await request.get_json()
    host = data.get("host", "")
    port = data.get("port", 3306)
    database = data.get("database", "")
    user = data.get("user", "")
    password = data.get("password", "")
    
    if not all([host, database, user]):
        return jsonify({"code": -1, "message": "host, database and user are required"}), 400
    
    try:
        import aiomysql
        
        # Create a temporary connection to test
        conn = await aiomysql.connect(
            host=host,
            port=port,
            db=database,
            user=user,
            password=password,
        )
        
        try:
            async with conn.cursor() as cursor:
                await cursor.execute("SELECT VERSION()")
                version = (await cursor.fetchone())[0]
                
                # Check if user table exists
                await cursor.execute("""
                    SELECT COUNT(*) FROM information_schema.tables 
                    WHERE table_schema = %s AND table_name = 'user'
                """, (database,))
                table_exists = (await cursor.fetchone())[0] > 0
                
            return jsonify({
                "code": 0,
                "data": {
                    "connected": True,
                    "version": version,
                    "database": database,
                    "user_table_exists": table_exists,
                }
            })
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"MySQL connection test failed: {e}")
        return jsonify({
            "code": 0,
            "data": {
                "connected": False,
                "error": str(e),
            }
        })


@manager.route("", methods=["GET"])
async def list_users():
    """
    List all users
    ---
    tags:
      - User
    parameters:
      - name: page
        in: query
        type: integer
        default: 1
      - name: page_size
        in: query
        type: integer
        default: 20
      - name: email
        in: query
        type: string
    responses:
      200:
        description: User list
    """
    if not settings.is_mysql_configured:
        return jsonify({"code": -1, "message": "MySQL not configured"}), 400
    
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    email = request.args.get("email", None)
    
    try:
        result = await mysql_client.list_users(page=page, page_size=page_size, email=email)
        return jsonify({"code": 0, "data": result})
    except MySQLClientError as e:
        logger.error(f"Failed to list users: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error listing users")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("", methods=["POST"])
async def create_user():
    """
    Create a new user
    ---
    tags:
      - User
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            email:
              type: string
            password:
              type: string
            nickname:
              type: string
    responses:
      200:
        description: User created
    """
    if not settings.is_mysql_configured:
        return jsonify({"code": -1, "message": "MySQL not configured"}), 400
    
    data = await request.get_json()
    email = data.get("email", "")
    password = data.get("password", "")
    nickname = data.get("nickname", "")
    
    if not email or not password:
        return jsonify({"code": -1, "message": "email and password are required"}), 400
    
    try:
        result = await mysql_client.create_user(email=email, password=password, nickname=nickname)
        return jsonify({"code": 0, "data": result})
    except MySQLClientError as e:
        logger.error(f"Failed to create user: {e.message}")
        return jsonify({"code": e.code, "message": e.message}), 500
    except Exception as e:
        logger.exception("Unexpected error creating user")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<user_id>/status", methods=["PUT"])
async def update_user_status(user_id: str):
    """
    Update user status
    ---
    tags:
      - User
    parameters:
      - name: user_id
        in: path
        type: string
        required: true
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            status:
              type: string
              description: "1 for active, 0 for inactive"
    responses:
      200:
        description: Status updated
    """
    if not settings.is_mysql_configured:
        return jsonify({"code": -1, "message": "MySQL not configured"}), 400
    
    data = await request.get_json()
    status = data.get("status", "")
    
    if status not in ["0", "1"]:
        return jsonify({"code": -1, "message": "status must be '0' or '1'"}), 400
    
    try:
        success = await mysql_client.update_user_status(user_id, status)
        if success:
            return jsonify({"code": 0, "message": "Status updated"})
        else:
            return jsonify({"code": -1, "message": "User not found"}), 404
    except Exception as e:
        logger.exception("Failed to update user status")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/<user_id>/password", methods=["PUT"])
async def update_user_password(user_id: str):
    """
    Update user password
    ---
    tags:
      - User
    parameters:
      - name: user_id
        in: path
        type: string
        required: true
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            password:
              type: string
    responses:
      200:
        description: Password updated
    """
    if not settings.is_mysql_configured:
        return jsonify({"code": -1, "message": "MySQL not configured"}), 400
    
    data = await request.get_json()
    password = data.get("password", "")
    
    if not password:
        return jsonify({"code": -1, "message": "password is required"}), 400
    
    try:
        success = await mysql_client.update_user_password(user_id, password)
        if success:
            return jsonify({"code": 0, "message": "Password updated"})
        else:
            return jsonify({"code": -1, "message": "User not found"}), 404
    except Exception as e:
        logger.exception("Failed to update user password")
        return jsonify({"code": -1, "message": str(e)}), 500


@manager.route("/batch-delete", methods=["POST"])
async def batch_delete_users():
    """
    Delete users in batch
    ---
    tags:
      - User
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
        description: Users deleted
    """
    if not settings.is_mysql_configured:
        return jsonify({"code": -1, "message": "MySQL not configured"}), 400
    
    data = await request.get_json()
    ids = data.get("ids", [])
    
    if not ids:
        return jsonify({"code": -1, "message": "ids is required"}), 400
    
    try:
        count = await mysql_client.delete_users(ids)
        return jsonify({"code": 0, "message": f"Deleted {count} users"})
    except Exception as e:
        logger.exception("Failed to delete users")
        return jsonify({"code": -1, "message": str(e)}), 500
