#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

from quart import Quart, jsonify
from quart_cors import cors
from flasgger import Swagger

from api.settings import settings
from api.apps.auth_app import manager as auth_bp
from api.apps.dashboard_app import manager as dashboard_bp
from api.apps.dataset_app import manager as dataset_bp
from api.apps.document_app import manager as document_bp
from api.apps.chat_app import manager as chat_bp
from api.apps.agent_app import manager as agent_bp
from api.apps.system_app import manager as system_bp
from api.apps.user_app import manager as user_bp
from api.apps.task_app import manager as task_bp

__all__ = ["app"]

app = Quart(__name__)
app.url_map.strict_slashes = False  # Allow both /path and /path/ to match
app = cors(app, allow_origin="*")

app.config["SECRET_KEY"] = settings.secret_key
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024

swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs/",
}

swagger = Swagger(
    app,
    config=swagger_config,
    template={
        "swagger": "2.0",
        "info": {
            "title": "RAGFlow Admin API",
            "description": "Administration API for RAGFlow management console",
            "version": "1.0.0",
        },
    },
)

app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
app.register_blueprint(dashboard_bp, url_prefix="/api/v1/dashboard")
app.register_blueprint(dataset_bp, url_prefix="/api/v1/datasets")
app.register_blueprint(document_bp, url_prefix="/api/v1/datasets")
app.register_blueprint(chat_bp, url_prefix="/api/v1/chats")
app.register_blueprint(agent_bp, url_prefix="/api/v1/agents")
app.register_blueprint(system_bp, url_prefix="/api/v1/system")
app.register_blueprint(user_bp, url_prefix="/api/v1/users")
app.register_blueprint(task_bp, url_prefix="/api/v1/tasks")


@app.route("/health")
async def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})
