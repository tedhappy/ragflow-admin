#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

"""Utility functions for RAGFlow Admin API."""

from api.settings import settings


def check_mysql_configured() -> bool:
    """
    Check if MySQL connection is properly configured.
    
    Returns:
        bool: True if all required MySQL settings are present.
    """
    return all([
        settings.mysql_host,
        settings.mysql_port,
        settings.mysql_database,
        settings.mysql_user,
    ])
