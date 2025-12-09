#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

import logging
import time
import base64
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

    async def list_users(self, page: int = 1, page_size: int = 20, 
                         email: str = None, nickname: str = None, status: str = None) -> Dict[str, Any]:
        """List all users with pagination and filters."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Build query with multiple filters
                conditions = []
                params = []
                
                if email:
                    conditions.append("email LIKE %s")
                    params.append(f"%{email}%")
                if nickname:
                    conditions.append("nickname LIKE %s")
                    params.append(f"%{nickname}%")
                if status is not None and status != '':
                    conditions.append("status = %s")
                    params.append(status)
                
                where_clause = ""
                if conditions:
                    where_clause = "WHERE " + " AND ".join(conditions)
                
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
        """Get user by ID with detailed information."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                await cursor.execute("""
                    SELECT id, email, nickname, avatar, status, is_superuser,
                           login_channel, create_time, update_time, last_login_time,
                           language, color_schema, timezone, is_anonymous
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
                    "last_login_time": format_datetime(row[9]) if row[9] else None,
                    "language": row[10],
                    "color_schema": row[11],
                    "timezone": row[12],
                    "is_anonymous": row[13],
                }
        finally:
            await self._release_connection(conn)

    async def get_user_datasets(self, user_id: str, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """Get datasets (knowledgebases) owned by a user."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Get total count
                await cursor.execute("""
                    SELECT COUNT(*) FROM knowledgebase WHERE tenant_id = %s
                """, (user_id,))
                total = (await cursor.fetchone())[0]
                
                # Get datasets with pagination
                offset = (page - 1) * page_size
                await cursor.execute("""
                    SELECT id, name, description, chunk_num, doc_num, token_num,
                           parser_id, permission, status, create_time, update_time
                    FROM knowledgebase 
                    WHERE tenant_id = %s
                    ORDER BY create_time DESC
                    LIMIT %s OFFSET %s
                """, (user_id, page_size, offset))
                rows = await cursor.fetchall()
                
                datasets = []
                for row in rows:
                    datasets.append({
                        "id": row[0],
                        "name": row[1],
                        "description": row[2],
                        "chunk_num": row[3] or 0,
                        "doc_num": row[4] or 0,
                        "token_num": row[5] or 0,
                        "parser_id": row[6],
                        "permission": row[7],
                        "status": row[8],
                        "create_time": format_datetime(row[9]),
                        "update_time": format_datetime(row[10]),
                    })
                
                return {
                    "items": datasets,
                    "total": total,
                }
        finally:
            await self._release_connection(conn)

    async def get_user_agents(self, user_id: str, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """Get agents (user_canvas) owned by a user."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Get total count from user_canvas table
                await cursor.execute("""
                    SELECT COUNT(*) FROM user_canvas WHERE user_id = %s
                """, (user_id,))
                total = (await cursor.fetchone())[0]
                
                # Get agents with pagination
                # Note: canvas_category contains the actual type (agent_canvas, dataflow_canvas)
                offset = (page - 1) * page_size
                await cursor.execute("""
                    SELECT id, title, description, canvas_category, create_time, update_time
                    FROM user_canvas 
                    WHERE user_id = %s
                    ORDER BY create_time DESC
                    LIMIT %s OFFSET %s
                """, (user_id, page_size, offset))
                rows = await cursor.fetchall()
                
                agents = []
                for row in rows:
                    agents.append({
                        "id": row[0],
                        "title": row[1],
                        "description": row[2],
                        "canvas_type": row[3],  # canvas_category value
                        "create_time": format_datetime(row[4]),
                        "update_time": format_datetime(row[5]),
                    })
                
                return {
                    "items": agents,
                    "total": total,
                }
        finally:
            await self._release_connection(conn)

    def _hash_password(self, password: str) -> str:
        """Hash password using the same method as RAGFlow.
        
        RAGFlow stores passwords as hash of base64-encoded password:
        1. Frontend encrypts password with RSA
        2. Backend decrypts and gets base64-encoded password
        3. Database stores hash of the base64-encoded password
        
        So we need: generate_password_hash(base64_encode(password))
        """
        # Base64 encode the password first (as RAGFlow does)
        password_b64 = base64.b64encode(password.encode('utf-8')).decode('utf-8')
        return generate_password_hash(password_b64)

    async def create_user(self, email: str, password: str, nickname: str = None) -> Dict[str, Any]:
        """Create a new user using the same method as RAGFlow.
        
        RAGFlow requires creating records in multiple tables:
        1. user - User account
        2. tenant - Tenant/workspace for the user
        3. user_tenant - Links user to tenant with OWNER role
        """
        import uuid
        
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Check if user already exists
                await cursor.execute("SELECT id FROM user WHERE email = %s", (email,))
                if await cursor.fetchone():
                    raise MySQLClientError("User with this email already exists")
                
                user_id = str(uuid.uuid4()).replace("-", "")
                user_tenant_id = str(uuid.uuid4()).replace("-", "")
                nick = nickname  # nickname is required
                
                # Hash password using RAGFlow's method (base64 encode + hash)
                hashed_password = self._hash_password(password)
                logger.info(f"Creating user {email} with password hash: {hashed_password[:50]}...")
                now_timestamp = int(time.time() * 1000)  # Timestamp in milliseconds
                now_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # Formatted date string
                access_token = str(uuid.uuid4()).replace("-", "")
                
                # 1. Create user record with default values (matching RAGFlow registration)
                await cursor.execute("""
                    INSERT INTO user (id, email, password, nickname, status, 
                                      create_time, create_date, update_time, update_date,
                                      access_token, is_authenticated, is_active, is_anonymous,
                                      login_channel, is_superuser, last_login_time,
                                      language, color_schema, timezone)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (user_id, email, hashed_password, nick, "1", 
                      now_timestamp, now_date, now_timestamp, now_date,
                      access_token, "1", "1", "0", "password", 0, now_date,
                      "English", "Bright", "UTC+8\tAsia/Shanghai"))
                
                # 2. Create tenant record (user's workspace)
                tenant_name = f"{nick}'s Kingdom"
                await cursor.execute("""
                    INSERT INTO tenant (id, name, llm_id, embd_id, asr_id, img2txt_id, rerank_id, tts_id,
                                        parser_ids, credit, create_time, create_date, update_time, update_date, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (user_id, tenant_name, "", "", "", "", "", "", "", 0,
                      now_timestamp, now_date, now_timestamp, now_date, "1"))
                
                # 3. Create user_tenant record (link user to tenant as OWNER)
                await cursor.execute("""
                    INSERT INTO user_tenant (id, user_id, tenant_id, role, status,
                                             create_time, create_date, update_time, update_date, invited_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (user_tenant_id, user_id, user_id, "owner", "1",
                      now_timestamp, now_date, now_timestamp, now_date, user_id))
                
                return {"id": user_id, "email": email}
        finally:
            await self._release_connection(conn)

    async def update_user_status(self, user_id: str, status: str) -> bool:
        """Update user status (1=active, 0=inactive).
        
        Updates both user.status and user_tenant.status for complete access control.
        """
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                now_timestamp = int(time.time() * 1000)  # Timestamp in milliseconds
                now_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # Formatted date string
                
                # 1. Update user status and is_active
                await cursor.execute("""
                    UPDATE user SET status = %s, is_active = %s, update_time = %s, update_date = %s WHERE id = %s
                """, (status, status, now_timestamp, now_date, user_id))
                
                # 2. Update user_tenant status (sync with user status)
                await cursor.execute("""
                    UPDATE user_tenant SET status = %s, update_time = %s, update_date = %s 
                    WHERE user_id = %s OR tenant_id = %s
                """, (status, now_timestamp, now_date, user_id, user_id))
                
                return cursor.rowcount > 0
        finally:
            await self._release_connection(conn)

    async def update_user_password(self, user_id: str, new_password: str) -> bool:
        """Update user password using the same method as RAGFlow."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Hash password using RAGFlow's method (base64 encode + hash)
                hashed_password = self._hash_password(new_password)
                now_timestamp = int(time.time() * 1000)  # Timestamp in milliseconds
                now_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # Formatted date string
                await cursor.execute("""
                    UPDATE user SET password = %s, update_time = %s, update_date = %s WHERE id = %s
                """, (hashed_password, now_timestamp, now_date, user_id))
                return cursor.rowcount > 0
        finally:
            await self._release_connection(conn)

    async def delete_user(self, user_id: str) -> bool:
        """Delete a user and related records (tenant, user_tenant)."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Delete related records first (foreign key order)
                # 1. Delete user_tenant records
                await cursor.execute("DELETE FROM user_tenant WHERE user_id = %s OR tenant_id = %s", 
                                     (user_id, user_id))
                # 2. Delete tenant record (user_id = tenant_id for owner)
                await cursor.execute("DELETE FROM tenant WHERE id = %s", (user_id,))
                # 3. Delete user record
                await cursor.execute("DELETE FROM user WHERE id = %s", (user_id,))
                return cursor.rowcount > 0
        finally:
            await self._release_connection(conn)

    async def delete_users(self, user_ids: List[str]) -> int:
        """Delete multiple users and their related records."""
        if not user_ids:
            return 0
        
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                placeholders = ",".join(["%s"] * len(user_ids))
                # Delete related records first
                # 1. Delete user_tenant records
                await cursor.execute(
                    f"DELETE FROM user_tenant WHERE user_id IN ({placeholders}) OR tenant_id IN ({placeholders})", 
                    user_ids + user_ids
                )
                # 2. Delete tenant records
                await cursor.execute(f"DELETE FROM tenant WHERE id IN ({placeholders})", user_ids)
                # 3. Delete user records
                await cursor.execute(f"DELETE FROM user WHERE id IN ({placeholders})", user_ids)
                return cursor.rowcount
        finally:
            await self._release_connection(conn)


    # ==================== Global List Methods ====================
    
    async def list_all_datasets(self, page: int = 1, page_size: int = 20, 
                                 name: str = None, status: str = None) -> Dict[str, Any]:
        """List all datasets from all users with pagination and filtering."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Build WHERE clause
                conditions = []
                params = []
                if name:
                    conditions.append("kb.name LIKE %s")
                    params.append(f"%{name}%")
                if status:
                    conditions.append("kb.status = %s")
                    params.append(status)
                
                where_clause = " AND ".join(conditions) if conditions else "1=1"
                
                # Get total count
                await cursor.execute(f"""
                    SELECT COUNT(*) FROM knowledgebase kb WHERE {where_clause}
                """, params)
                total = (await cursor.fetchone())[0]
                
                # Get datasets with user info
                offset = (page - 1) * page_size
                await cursor.execute(f"""
                    SELECT kb.id, kb.name, kb.description, kb.chunk_num, kb.doc_num, 
                           kb.token_num, kb.parser_id, kb.permission, kb.status,
                           kb.create_time, kb.update_time, kb.tenant_id,
                           u.email as owner_email, u.nickname as owner_nickname
                    FROM knowledgebase kb
                    LEFT JOIN user u ON kb.tenant_id = u.id
                    WHERE {where_clause}
                    ORDER BY kb.create_time DESC
                    LIMIT %s OFFSET %s
                """, params + [page_size, offset])
                rows = await cursor.fetchall()
                
                datasets = []
                for row in rows:
                    datasets.append({
                        "id": row[0],
                        "name": row[1],
                        "description": row[2],
                        "chunk_num": row[3] or 0,
                        "doc_num": row[4] or 0,
                        "token_num": row[5] or 0,
                        "parser_id": row[6],
                        "permission": row[7],
                        "status": row[8],
                        "create_time": format_datetime(row[9]),
                        "update_time": format_datetime(row[10]),
                        "tenant_id": row[11],
                        "owner_email": row[12],
                        "owner_nickname": row[13],
                    })
                
                return {
                    "items": datasets,
                    "total": total,
                }
        finally:
            await self._release_connection(conn)

    async def list_all_agents(self, page: int = 1, page_size: int = 20,
                               title: str = None) -> Dict[str, Any]:
        """List all agents from all users with pagination and filtering."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Build WHERE clause
                conditions = []
                params = []
                if title:
                    conditions.append("uc.title LIKE %s")
                    params.append(f"%{title}%")
                
                where_clause = " AND ".join(conditions) if conditions else "1=1"
                
                # Get total count
                await cursor.execute(f"""
                    SELECT COUNT(*) FROM user_canvas uc WHERE {where_clause}
                """, params)
                total = (await cursor.fetchone())[0]
                
                # Get agents with user info
                offset = (page - 1) * page_size
                await cursor.execute(f"""
                    SELECT uc.id, uc.title, uc.description, uc.canvas_category,
                           uc.permission, uc.create_time, uc.update_time, uc.user_id,
                           u.email as owner_email, u.nickname as owner_nickname
                    FROM user_canvas uc
                    LEFT JOIN user u ON uc.user_id = u.id
                    WHERE {where_clause}
                    ORDER BY uc.create_time DESC
                    LIMIT %s OFFSET %s
                """, params + [page_size, offset])
                rows = await cursor.fetchall()
                
                agents = []
                for row in rows:
                    agents.append({
                        "id": row[0],
                        "title": row[1],
                        "description": row[2],
                        "canvas_type": row[3],
                        "permission": row[4],
                        "create_time": format_datetime(row[5]),
                        "update_time": format_datetime(row[6]),
                        "user_id": row[7],
                        "owner_email": row[8],
                        "owner_nickname": row[9],
                    })
                
                return {
                    "items": agents,
                    "total": total,
                }
        finally:
            await self._release_connection(conn)

    async def list_all_chats(self, page: int = 1, page_size: int = 20,
                              name: str = None) -> Dict[str, Any]:
        """List all chat assistants from all users with pagination and filtering."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Build WHERE clause
                conditions = []
                params = []
                if name:
                    conditions.append("d.name LIKE %s")
                    params.append(f"%{name}%")
                
                where_clause = " AND ".join(conditions) if conditions else "1=1"
                
                # Get total count
                await cursor.execute(f"""
                    SELECT COUNT(*) FROM dialog d WHERE {where_clause}
                """, params)
                total = (await cursor.fetchone())[0]
                
                # Get chats with user info
                offset = (page - 1) * page_size
                await cursor.execute(f"""
                    SELECT d.id, d.name, d.description, d.icon, d.language,
                           d.llm_id, d.status, d.create_time, d.update_time, d.tenant_id,
                           u.email as owner_email, u.nickname as owner_nickname
                    FROM dialog d
                    LEFT JOIN user u ON d.tenant_id = u.id
                    WHERE {where_clause}
                    ORDER BY d.create_time DESC
                    LIMIT %s OFFSET %s
                """, params + [page_size, offset])
                rows = await cursor.fetchall()
                
                chats = []
                for row in rows:
                    chats.append({
                        "id": row[0],
                        "name": row[1],
                        "description": row[2],
                        "icon": row[3],
                        "language": row[4],
                        "llm_id": row[5],
                        "status": row[6],
                        "create_time": format_datetime(row[7]),
                        "update_time": format_datetime(row[8]),
                        "tenant_id": row[9],
                        "owner_email": row[10],
                        "owner_nickname": row[11],
                    })
                
                return {
                    "items": chats,
                    "total": total,
                }
        finally:
            await self._release_connection(conn)

    async def get_chat_sessions(self, chat_id: str, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """Get sessions for a specific chat assistant."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Get total count
                await cursor.execute("""
                    SELECT COUNT(*) FROM conversation WHERE dialog_id = %s
                """, (chat_id,))
                total = (await cursor.fetchone())[0]
                
                # Get sessions
                offset = (page - 1) * page_size
                await cursor.execute("""
                    SELECT id, name, message, create_time, update_time
                    FROM conversation
                    WHERE dialog_id = %s
                    ORDER BY create_time DESC
                    LIMIT %s OFFSET %s
                """, (chat_id, page_size, offset))
                rows = await cursor.fetchall()
                
                sessions = []
                for row in rows:
                    # Parse message to get count
                    import json
                    messages = []
                    try:
                        if row[2]:
                            messages = json.loads(row[2])
                    except:
                        pass
                    
                    sessions.append({
                        "id": row[0],
                        "name": row[1],
                        "message_count": len(messages),
                        "messages": messages,
                        "create_time": format_datetime(row[3]),
                        "update_time": format_datetime(row[4]),
                    })
                
                return {
                    "items": sessions,
                    "total": total,
                }
        finally:
            await self._release_connection(conn)

    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get dashboard statistics from database."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Get counts
                await cursor.execute("SELECT COUNT(*) FROM knowledgebase")
                dataset_count = (await cursor.fetchone())[0]
                
                await cursor.execute("SELECT COUNT(*) FROM document")
                document_count = (await cursor.fetchone())[0]
                
                await cursor.execute("SELECT COUNT(*) FROM dialog")
                chat_count = (await cursor.fetchone())[0]
                
                await cursor.execute("SELECT COUNT(*) FROM user_canvas")
                agent_count = (await cursor.fetchone())[0]
                
                await cursor.execute("SELECT COUNT(*) FROM user")
                user_count = (await cursor.fetchone())[0]
                
                return {
                    "dataset_count": dataset_count,
                    "document_count": document_count,
                    "chat_count": chat_count,
                    "agent_count": agent_count,
                    "user_count": user_count,
                }
        finally:
            await self._release_connection(conn)

    async def delete_dataset(self, dataset_id: str) -> bool:
        """Delete a dataset."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                await cursor.execute("DELETE FROM knowledgebase WHERE id = %s", (dataset_id,))
                return cursor.rowcount > 0
        finally:
            await self._release_connection(conn)

    async def delete_datasets(self, dataset_ids: List[str]) -> int:
        """Delete multiple datasets."""
        if not dataset_ids:
            return 0
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                placeholders = ",".join(["%s"] * len(dataset_ids))
                await cursor.execute(f"DELETE FROM knowledgebase WHERE id IN ({placeholders})", dataset_ids)
                return cursor.rowcount
        finally:
            await self._release_connection(conn)

    async def delete_agent(self, agent_id: str) -> bool:
        """Delete an agent."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                await cursor.execute("DELETE FROM user_canvas WHERE id = %s", (agent_id,))
                return cursor.rowcount > 0
        finally:
            await self._release_connection(conn)

    async def delete_agents(self, agent_ids: List[str]) -> int:
        """Delete multiple agents."""
        if not agent_ids:
            return 0
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                placeholders = ",".join(["%s"] * len(agent_ids))
                await cursor.execute(f"DELETE FROM user_canvas WHERE id IN ({placeholders})", agent_ids)
                return cursor.rowcount
        finally:
            await self._release_connection(conn)

    async def delete_chat(self, chat_id: str) -> bool:
        """Delete a chat assistant and its conversations."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Delete conversations first
                await cursor.execute("DELETE FROM conversation WHERE dialog_id = %s", (chat_id,))
                # Delete dialog
                await cursor.execute("DELETE FROM dialog WHERE id = %s", (chat_id,))
                return cursor.rowcount > 0
        finally:
            await self._release_connection(conn)

    async def delete_chats(self, chat_ids: List[str]) -> int:
        """Delete multiple chat assistants and their conversations."""
        if not chat_ids:
            return 0
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                placeholders = ",".join(["%s"] * len(chat_ids))
                # Delete conversations first
                await cursor.execute(f"DELETE FROM conversation WHERE dialog_id IN ({placeholders})", chat_ids)
                # Delete dialogs
                await cursor.execute(f"DELETE FROM dialog WHERE id IN ({placeholders})", chat_ids)
                return cursor.rowcount
        finally:
            await self._release_connection(conn)


# Global instance
mysql_client = MySQLClient()
