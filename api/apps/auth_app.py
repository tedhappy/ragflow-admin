#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import secrets
import time
from functools import wraps
from quart import Blueprint, jsonify, request, g
from api.settings import settings

manager = Blueprint("auth", __name__)

# Simple token storage (in production, use Redis or database)
# Format: {token: {"username": str, "created_at": float, "expires_at": float}}
_tokens = {}

# Token expiration time in seconds (24 hours)
TOKEN_EXPIRATION = 24 * 60 * 60


def generate_token() -> str:
    """Generate a secure random token."""
    return secrets.token_urlsafe(32)


def create_session(username: str) -> str:
    """Create a new session and return the token."""
    token = generate_token()
    now = time.time()
    _tokens[token] = {
        "username": username,
        "created_at": now,
        "expires_at": now + TOKEN_EXPIRATION,
    }
    return token


def validate_token(token: str) -> dict | None:
    """Validate token and return session data if valid."""
    if not token:
        return None
    
    session = _tokens.get(token)
    if not session:
        return None
    
    # Check expiration
    if time.time() > session["expires_at"]:
        del _tokens[token]
        return None
    
    return session


def invalidate_token(token: str) -> bool:
    """Invalidate a token (logout)."""
    if token in _tokens:
        del _tokens[token]
        return True
    return False


def login_required(f):
    """Decorator to require authentication for a route."""
    @wraps(f)
    async def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = None
        
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        
        session = validate_token(token)
        if not session:
            return jsonify({
                "code": 401,
                "message": "Authentication required"
            }), 401
        
        g.current_user = session["username"]
        return await f(*args, **kwargs)
    
    return decorated_function


@manager.route("/login", methods=["POST"])
async def login():
    """
    User login
    ---
    tags:
      - Auth
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required:
            - username
            - password
          properties:
            username:
              type: string
            password:
              type: string
    responses:
      200:
        description: Login successful
      401:
        description: Invalid credentials
    """
    try:
        data = await request.get_json()
        username = data.get("username", "").strip()
        password = data.get("password", "")
        
        if not username:
            return jsonify({
                "code": -1,
                "message": "Username is required"
            }), 400
        
        if not password:
            return jsonify({
                "code": -1,
                "message": "Password is required"
            }), 400
        
        # Verify credentials against config
        if username == settings.admin_username and password == settings.admin_password:
            token = create_session(username)
            return jsonify({
                "code": 0,
                "data": {
                    "token": token,
                    "username": username,
                    "expires_in": TOKEN_EXPIRATION,
                },
                "message": "Login successful"
            })
        else:
            return jsonify({
                "code": -1,
                "message": "Invalid username or password"
            }), 401
            
    except Exception as e:
        return jsonify({
            "code": -1,
            "message": str(e)
        }), 500


@manager.route("/logout", methods=["POST"])
async def logout():
    """
    User logout
    ---
    tags:
      - Auth
    responses:
      200:
        description: Logout successful
    """
    auth_header = request.headers.get("Authorization", "")
    token = None
    
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    
    if token:
        invalidate_token(token)
    
    return jsonify({
        "code": 0,
        "message": "Logout successful"
    })


@manager.route("/me", methods=["GET"])
@login_required
async def get_current_user():
    """
    Get current user info
    ---
    tags:
      - Auth
    responses:
      200:
        description: Current user info
      401:
        description: Not authenticated
    """
    return jsonify({
        "code": 0,
        "data": {
            "username": g.current_user,
            "role": "admin",
        }
    })


@manager.route("/refresh", methods=["POST"])
@login_required
async def refresh_token():
    """
    Refresh authentication token
    ---
    tags:
      - Auth
    responses:
      200:
        description: New token
      401:
        description: Not authenticated
    """
    # Invalidate old token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        old_token = auth_header[7:]
        invalidate_token(old_token)
    
    # Create new token
    token = create_session(g.current_user)
    
    return jsonify({
        "code": 0,
        "data": {
            "token": token,
            "username": g.current_user,
            "expires_in": TOKEN_EXPIRATION,
        }
    })
