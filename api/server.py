#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

"""
RAGFlow Admin Server Entry Point.

This module starts the Quart application server with configured
host, port, and debug settings from the configuration file.
"""

import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

if __name__ == "__main__":
    from api.apps import app
    from api.settings import settings
    
    logging.info(r'''
    ____   ___    ______ ______ __                      ___       __          _     
   / __ \ /   |  / ____// ____// /____  _      __      /   | ____/ /___ ___  (_)___ 
  / /_/ // /| | / / __ / /_   / // __ \| | /| / /_____/ /| |/ __  / __ __ \/ / __ \
 / _, _// ___ |/ /_/ // __/  / // /_/ /| |/ |/ /_____/ ___ / /_/ / / / / / / / / / /
/_/ |_|/_/  |_|\____//_/    /_/ \____/ |__/|__/     /_/  |_\__,_/_/ /_/ /_/_/_/ /_/ 
    ''')
    
    logging.info(f"RAGFlow Admin starting...")
    logging.info(f"RAGFlow URL: {settings.ragflow_base_url}")
    logging.info(f"Server: http://{settings.server_host}:{settings.server_port}")
    logging.info(f"API Docs: http://{settings.server_host}:{settings.server_port}/apidocs/")
    
    app.run(
        host=settings.server_host,
        port=settings.server_port,
        debug=settings.debug
    )
