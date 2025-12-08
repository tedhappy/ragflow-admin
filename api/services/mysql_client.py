#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import logging
import time
from datetime import datetime
from typing import Optional, List, Dict, Any
from werkzeug.security import generate_password_hash
from api.settings import settings


def format_datetime(val) -> Optional[str]:
    """Format datetime value to ISO string, handling both datetime objects and timestamps."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, (int, float)):
        # Convert timestamp (milliseconds or seconds) to ISO string
        if val > 1e12:  # Likely milliseconds
            val = val / 1000
        return datetime.fromtimestamp(val).strftime("%Y-%m-%d %H:%M:%S")
    return str(val)

logger = logging.getLogger(__name__)


class MySQLClientError(Exception):
    """Custom exception for MySQL client errors."""
    
    def __init__(self, message: str, code: int = -1):
        self.message = message
        self.code = code
        super().__init__(self.message)


class MySQLClient:
    """MySQL client for RAGFlow user management."""
    
    _instance = None
    _pool = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def _get_connection(self):
        """Get a connection from the pool."""
        import aiomysql
        
        if not settings.is_mysql_configured:
            raise MySQLClientError("MySQL connection not configured")
        
        if self._pool is None:
            self._pool = await aiomysql.create_pool(
                host=settings.mysql_host,
                port=settings.mysql_port,
                db=settings.mysql_database,
                user=settings.mysql_user,
                password=settings.mysql_password,
                minsize=1,
                maxsize=5,
                autocommit=True,
            )
        
        return await self._pool.acquire()

    async def _release_connection(self, conn):
        """Release connection back to pool."""
        if self._pool:
            self._pool.release(conn)

    async def close(self):
        """Close the connection pool."""
        if self._pool:
            self._pool.close()
            await self._pool.wait_closed()
            self._pool = None

    async def test_connection(self) -> Dict[str, Any]:
        """Test the MySQL connection."""
        try:
            conn = await self._get_connection()
            try:
                async with conn.cursor() as cursor:
                    await cursor.execute("SELECT 1")
                    await cursor.fetchone()
                    
                    # Get database info
                    await cursor.execute("SELECT VERSION()")
                    version = (await cursor.fetchone())[0]
                    
                    # Check if user table exists
                    await cursor.execute("""
                        SELECT COUNT(*) FROM information_schema.tables 
                        WHERE table_schema = %s AND table_name = 'user'
                    """, (settings.mysql_database,))
                    table_exists = (await cursor.fetchone())[0] > 0
                    
                return {
                    "connected": True,
                    "version": version,
                    "database": settings.mysql_database,
                    "user_table_exists": table_exists,
                }
            finally:
                await self._release_connection(conn)
        except Exception as e:
            logger.error(f"MySQL connection test failed: {e}")
            return {
                "connected": False,
                "error": str(e),
            }

    async def list_users(self, page: int = 1, page_size: int = 20, email: str = None) -> Dict[str, Any]:
        """List all users with pagination."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Build query
                where_clause = ""
                params = []
                if email:
                    where_clause = "WHERE email LIKE %s"
                    params.append(f"%{email}%")
                
                # Get total count
                count_sql = f"SELECT COUNT(*) FROM user {where_clause}"
                await cursor.execute(count_sql, params)
                total = (await cursor.fetchone())[0]
                
                # Get users with pagination
                offset = (page - 1) * page_size
                query_sql = f"""
                    SELECT id, email, nickname, avatar, status, is_superuser, 
                           login_channel, create_time, update_time, access_token
                    FROM user 
                    {where_clause}
                    ORDER BY create_time DESC
                    LIMIT %s OFFSET %s
                """
                params.extend([page_size, offset])
                await cursor.execute(query_sql, params)
                rows = await cursor.fetchall()
                
                users = []
                for row in rows:
                    users.append({
                        "id": row[0],
                        "email": row[1],
                        "nickname": row[2],
                        "avatar": row[3],
                        "status": row[4],
                        "is_superuser": row[5],
                        "login_channel": row[6],
                        "create_time": format_datetime(row[7]),
                        "update_time": format_datetime(row[8]),
                        "has_token": bool(row[9]),
                    })
                
                return {
                    "items": users,
                    "total": total,
                }
        finally:
            await self._release_connection(conn)

    async def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                await cursor.execute("""
                    SELECT id, email, nickname, avatar, status, is_superuser,
                           login_channel, create_time, update_time
                    FROM user WHERE id = %s
                """, (user_id,))
                row = await cursor.fetchone()
                
                if not row:
                    return None
                
                return {
                    "id": row[0],
                    "email": row[1],
                    "nickname": row[2],
                    "avatar": row[3],
                    "status": row[4],
                    "is_superuser": row[5],
                    "login_channel": row[6],
                    "create_time": format_datetime(row[7]),
                    "update_time": format_datetime(row[8]),
                }
        finally:
            await self._release_connection(conn)

    def _hash_password(self, password: str) -> str:
        """Hash password using the same method as RAGFlow (werkzeug.security)."""
        return generate_password_hash(password)

    async def create_user(self, email: str, password: str, nickname: str = None) -> Dict[str, Any]:
        """Create a new user using the same method as RAGFlow."""
        import uuid
        
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Check if user already exists
                await cursor.execute("SELECT id FROM user WHERE email = %s", (email,))
                if await cursor.fetchone():
                    raise MySQLClientError("User with this email already exists")
                
                user_id = str(uuid.uuid4()).replace("-", "")
                # Use generate_password_hash like RAGFlow does
                hashed_password = generate_password_hash(str(password))
                now_timestamp = int(time.time() * 1000)  # Timestamp in milliseconds
                now_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # Formatted date string
                
                await cursor.execute("""
                    INSERT INTO user (id, email, password, nickname, status, 
                                      create_time, create_date, update_time, update_date)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (user_id, email, hashed_password, nickname or email.split("@")[0], "1", 
                      now_timestamp, now_date, now_timestamp, now_date))
                
                return {"id": user_id, "email": email}
        finally:
            await self._release_connection(conn)

    async def update_user_status(self, user_id: str, status: str) -> bool:
        """Update user status (1=active, 0=inactive)."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                now_timestamp = int(time.time() * 1000)  # Timestamp in milliseconds
                now_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # Formatted date string
                await cursor.execute("""
                    UPDATE user SET status = %s, update_time = %s, update_date = %s WHERE id = %s
                """, (status, now_timestamp, now_date, user_id))
                return cursor.rowcount > 0
        finally:
            await self._release_connection(conn)

    async def update_user_password(self, user_id: str, new_password: str) -> bool:
        """Update user password using the same method as RAGFlow."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Use generate_password_hash like RAGFlow does
                hashed_password = generate_password_hash(str(new_password))
                now_timestamp = int(time.time() * 1000)  # Timestamp in milliseconds
                now_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # Formatted date string
                await cursor.execute("""
                    UPDATE user SET password = %s, update_time = %s, update_date = %s WHERE id = %s
                """, (hashed_password, now_timestamp, now_date, user_id))
                return cursor.rowcount > 0
        finally:
            await self._release_connection(conn)

    async def delete_user(self, user_id: str) -> bool:
        """Delete a user."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                await cursor.execute("DELETE FROM user WHERE id = %s", (user_id,))
                return cursor.rowcount > 0
        finally:
            await self._release_connection(conn)

    async def delete_users(self, user_ids: List[str]) -> int:
        """Delete multiple users."""
        if not user_ids:
            return 0
        
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                placeholders = ",".join(["%s"] * len(user_ids))
                await cursor.execute(f"DELETE FROM user WHERE id IN ({placeholders})", user_ids)
                return cursor.rowcount
        finally:
            await self._release_connection(conn)


# Global instance
mysql_client = MySQLClient()
