#
#  Copyright 2024 RAGFlow Admin Authors.
#
#  Licensed under the Apache License, Version 2.0
#

"""
MySQL client for RAGFlow database operations.

Provides async database access for user management, dataset operations,
chat sessions, and agent management through direct MySQL queries.
"""

import json
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
                connect_timeout=5,  # Connection timeout in seconds
                pool_recycle=60,    # Recycle connections after 60 seconds
            )
        
        return await self._pool.acquire()

    async def _release_connection(self, conn):
        """Release connection back to pool."""
        if self._pool and conn:
            try:
                self._pool.release(conn)
            except (AssertionError, Exception) as e:
                # Connection may have been recycled or already released
                logger.warning(f"Failed to release connection: {e}")

    async def _execute_transaction(self, operations):
        """Execute multiple operations in a transaction with auto-rollback on failure."""
        conn = await self._get_connection()
        try:
            await conn.autocommit(False)
            try:
                async with conn.cursor() as cursor:
                    result = await operations(cursor)
                    await conn.commit()
                    return result
            except Exception as e:
                await conn.rollback()
                raise e
            finally:
                await conn.autocommit(True)
        finally:
            await self._release_connection(conn)

    async def close(self):
        """Close the connection pool."""
        if self._pool:
            self._pool.close()
            await self._pool.wait_closed()
            self._pool = None

    async def test_connection(self) -> Dict[str, Any]:
        """Test the MySQL connection with fresh connection attempt."""
        import aiomysql
        
        # Create a fresh connection for health check (bypass pool)
        try:
            conn = await aiomysql.connect(
                host=settings.mysql_host,
                port=settings.mysql_port,
                db=settings.mysql_database,
                user=settings.mysql_user,
                password=settings.mysql_password,
                connect_timeout=5,
            )
            try:
                async with conn.cursor() as cursor:
                    await cursor.execute("SELECT 1")
                    await cursor.fetchone()
                    
                    await cursor.execute("SELECT VERSION()")
                    version = (await cursor.fetchone())[0]
                    
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
                conn.close()
        except Exception as e:
            logger.error(f"MySQL connection test failed: {e}")
            return {
                "connected": False,
                "error": str(e),
            }

    async def list_users(self, page: int = 1, page_size: int = 20, 
                         keyword: str = None, status: str = None) -> Dict[str, Any]:
        """List all users with pagination and filters."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                conditions = []
                params = []
                
                if keyword:
                    conditions.append("(email LIKE %s OR nickname LIKE %s)")
                    params.extend([f"%{keyword}%", f"%{keyword}%"])
                if status is not None and status != '':
                    conditions.append("status = %s")
                    params.append(status)
                
                where_clause = ""
                if conditions:
                    where_clause = "WHERE " + " AND ".join(conditions)
                
                count_sql = f"SELECT COUNT(*) FROM user {where_clause}"
                await cursor.execute(count_sql, params)
                total = (await cursor.fetchone())[0]
                
                offset = (page - 1) * page_size
                query_sql = f"""
                    SELECT u.id, u.email, u.nickname, u.avatar, u.status, u.is_superuser, 
                           u.login_channel, u.create_time, u.update_time, u.access_token,
                           (SELECT COUNT(*) FROM knowledgebase WHERE tenant_id = u.id) as dataset_count,
                           (SELECT COUNT(*) FROM user_canvas WHERE user_id = u.id) as agent_count,
                           (SELECT COUNT(*) FROM dialog WHERE tenant_id = u.id) as chat_count
                    FROM user u
                    {where_clause}
                    ORDER BY u.create_time DESC
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
                        "dataset_count": row[10] or 0,
                        "agent_count": row[11] or 0,
                        "chat_count": row[12] or 0,
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

    async def get_dataset(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        """Get dataset (knowledgebase) by ID."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                await cursor.execute("""
                    SELECT id, name, tenant_id, create_time, update_time
                    FROM knowledgebase WHERE id = %s
                """, (dataset_id,))
                row = await cursor.fetchone()
                if row:
                    return {
                        "id": row[0],
                        "name": row[1],
                        "tenant_id": row[2],
                        "create_time": row[3],
                        "update_time": row[4],
                    }
                return None
        finally:
            await self._release_connection(conn)

    async def get_user_datasets(self, user_id: str, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """Get datasets (knowledgebases) owned by a user."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                await cursor.execute("""
                    SELECT COUNT(*) FROM knowledgebase WHERE tenant_id = %s
                """, (user_id,))
                total = (await cursor.fetchone())[0]
                
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
                await cursor.execute("""
                    SELECT COUNT(*) FROM user_canvas WHERE user_id = %s
                """, (user_id,))
                total = (await cursor.fetchone())[0]
                
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

    async def get_user_chats(self, user_id: str, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """Get chats (dialogs) owned by a user."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                await cursor.execute("""
                    SELECT COUNT(*) FROM dialog WHERE tenant_id = %s
                """, (user_id,))
                total = (await cursor.fetchone())[0]
                
                offset = (page - 1) * page_size
                await cursor.execute("""
                    SELECT d.id, d.name, d.description, d.status, d.create_time, d.update_time,
                           (SELECT COUNT(*) FROM conversation WHERE dialog_id = d.id) as session_count
                    FROM dialog d
                    WHERE d.tenant_id = %s
                    ORDER BY d.create_time DESC
                    LIMIT %s OFFSET %s
                """, (user_id, page_size, offset))
                rows = await cursor.fetchall()
                
                chats = []
                for row in rows:
                    chats.append({
                        "id": row[0],
                        "name": row[1],
                        "description": row[2],
                        "status": row[3],
                        "create_time": format_datetime(row[4]),
                        "update_time": format_datetime(row[5]),
                        "session_count": row[6] or 0,
                    })
                
                return {
                    "items": chats,
                    "total": total,
                }
        finally:
            await self._release_connection(conn)

    def _hash_password(self, password: str) -> str:
        """Hash password using RAGFlow method: hash(base64(password))."""
        password_b64 = base64.b64encode(password.encode('utf-8')).decode('utf-8')
        return generate_password_hash(password_b64)

    async def create_user(self, email: str, password: str, nickname: str = None) -> Dict[str, Any]:
        """Create a new user with tenant and user_tenant records (RAGFlow compatible)."""
        import uuid
        
        async def operations(cursor):
            await cursor.execute("SELECT id FROM user WHERE email = %s", (email,))
            if await cursor.fetchone():
                raise MySQLClientError("User with this email already exists")
            
            user_id = str(uuid.uuid4()).replace("-", "")
            user_tenant_id = str(uuid.uuid4()).replace("-", "")
            nick = nickname
            hashed_password = self._hash_password(password)
            logger.info(f"Creating user {email}")
            now_timestamp = int(time.time() * 1000)
            now_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            access_token = str(uuid.uuid4()).replace("-", "")
            
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
            
            tenant_name = f"{nick}'s Kingdom"
            await cursor.execute("""
                INSERT INTO tenant (id, name, llm_id, embd_id, asr_id, img2txt_id, rerank_id, tts_id,
                                    parser_ids, credit, create_time, create_date, update_time, update_date, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (user_id, tenant_name, "", "", "", "", "", "", "", 0,
                  now_timestamp, now_date, now_timestamp, now_date, "1"))
            
            await cursor.execute("""
                INSERT INTO user_tenant (id, user_id, tenant_id, role, status,
                                         create_time, create_date, update_time, update_date, invited_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (user_tenant_id, user_id, user_id, "owner", "1",
                  now_timestamp, now_date, now_timestamp, now_date, user_id))
            
            return {"id": user_id, "email": email}
        
        return await self._execute_transaction(operations)

    async def update_user_status(self, user_id: str, status: str) -> bool:
        """Update user status (1=active, 0=inactive). Updates both user and user_tenant."""
        async def operations(cursor):
            now_timestamp = int(time.time() * 1000)
            now_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            await cursor.execute("""
                UPDATE user SET status = %s, is_active = %s, update_time = %s, update_date = %s WHERE id = %s
            """, (status, status, now_timestamp, now_date, user_id))
            
            await cursor.execute("""
                UPDATE user_tenant SET status = %s, update_time = %s, update_date = %s 
                WHERE user_id = %s OR tenant_id = %s
            """, (status, now_timestamp, now_date, user_id, user_id))
            
            return cursor.rowcount > 0
        
        return await self._execute_transaction(operations)

    async def update_user_password(self, user_id: str, new_password: str) -> bool:
        """Update user password (RAGFlow compatible)."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                hashed_password = self._hash_password(new_password)
                now_timestamp = int(time.time() * 1000)
                now_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                await cursor.execute("""
                    UPDATE user SET password = %s, update_time = %s, update_date = %s WHERE id = %s
                """, (hashed_password, now_timestamp, now_date, user_id))
                return cursor.rowcount > 0
        finally:
            await self._release_connection(conn)

    async def delete_user(self, user_id: str) -> Dict[str, int]:
        """Delete a user and all related data."""
        return await self.delete_users([user_id])

    async def delete_users(self, user_ids: List[str]) -> Dict[str, int]:
        """Delete users and all related data (datasets, documents, chats, agents, etc.)."""
        if not user_ids:
            return {"users": 0}
        
        async def operations(cursor):
            placeholders = ",".join(["%s"] * len(user_ids))
            result = {
                "users": 0, "tenants": 0, "user_tenants": 0,
                "datasets": 0, "documents": 0, "tasks": 0, "files": 0, "file_relations": 0,
                "chats": 0, "conversations": 0, "agents": 0, "agent_versions": 0,
            }
            
            await cursor.execute(f"SELECT id FROM knowledgebase WHERE tenant_id IN ({placeholders})", user_ids)
            kb_rows = await cursor.fetchall()
            kb_ids = [row[0] for row in kb_rows]
            
            if kb_ids:
                kb_placeholders = ",".join(["%s"] * len(kb_ids))
                
                await cursor.execute(f"SELECT id FROM document WHERE kb_id IN ({kb_placeholders})", kb_ids)
                doc_rows = await cursor.fetchall()
                doc_ids = [row[0] for row in doc_rows]
                
                if doc_ids:
                    doc_placeholders = ",".join(["%s"] * len(doc_ids))
                    
                    await cursor.execute(f"DELETE FROM task WHERE doc_id IN ({doc_placeholders})", doc_ids)
                    result["tasks"] = cursor.rowcount
                    
                    await cursor.execute(f"SELECT file_id FROM file2document WHERE document_id IN ({doc_placeholders})", doc_ids)
                    file_rows = await cursor.fetchall()
                    file_ids = [row[0] for row in file_rows if row[0]]
                    
                    await cursor.execute(f"DELETE FROM file2document WHERE document_id IN ({doc_placeholders})", doc_ids)
                    result["file_relations"] = cursor.rowcount
                    
                    if file_ids:
                        file_placeholders = ",".join(["%s"] * len(file_ids))
                        await cursor.execute(f"DELETE FROM file WHERE id IN ({file_placeholders}) AND source_type = 'knowledgebase'", file_ids)
                        result["files"] = cursor.rowcount
                
                await cursor.execute(f"DELETE FROM document WHERE kb_id IN ({kb_placeholders})", kb_ids)
                result["documents"] = cursor.rowcount
                
                await cursor.execute(f"DELETE FROM knowledgebase WHERE id IN ({kb_placeholders})", kb_ids)
                result["datasets"] = cursor.rowcount
            
            await cursor.execute(f"DELETE FROM conversation WHERE dialog_id IN (SELECT id FROM dialog WHERE tenant_id IN ({placeholders}))", user_ids)
            result["conversations"] = cursor.rowcount
            
            await cursor.execute(f"DELETE FROM dialog WHERE tenant_id IN ({placeholders})", user_ids)
            result["chats"] = cursor.rowcount
            
            await cursor.execute(f"SELECT id FROM user_canvas WHERE user_id IN ({placeholders})", user_ids)
            agent_rows = await cursor.fetchall()
            agent_ids = [row[0] for row in agent_rows]
            
            if agent_ids:
                agent_placeholders = ",".join(["%s"] * len(agent_ids))
                await cursor.execute(f"DELETE FROM user_canvas_version WHERE user_canvas_id IN ({agent_placeholders})", agent_ids)
                result["agent_versions"] = cursor.rowcount
            
            await cursor.execute(f"DELETE FROM user_canvas WHERE user_id IN ({placeholders})", user_ids)
            result["agents"] = cursor.rowcount
            
            await cursor.execute(f"DELETE FROM user_tenant WHERE user_id IN ({placeholders}) OR tenant_id IN ({placeholders})", user_ids + user_ids)
            result["user_tenants"] = cursor.rowcount
            
            await cursor.execute(f"DELETE FROM tenant WHERE id IN ({placeholders})", user_ids)
            result["tenants"] = cursor.rowcount
            
            await cursor.execute(f"DELETE FROM user WHERE id IN ({placeholders})", user_ids)
            result["users"] = cursor.rowcount
            
            return result
        
        return await self._execute_transaction(operations)

    async def get_all_owners(self) -> List[Dict[str, Any]]:
        """Get all users as potential owners for filtering."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                await cursor.execute("""
                    SELECT id, email, nickname FROM user 
                    ORDER BY email ASC
                """)
                rows = await cursor.fetchall()
                return [{"id": row[0], "email": row[1], "nickname": row[2]} for row in rows]
        finally:
            await self._release_connection(conn)

    async def list_all_datasets(self, page: int = 1, page_size: int = 20, 
                                 name: str = None, status: str = None, owner: str = None) -> Dict[str, Any]:
        """List all datasets from all users with pagination and filtering."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                conditions = []
                params = []
                if name:
                    conditions.append("kb.name LIKE %s")
                    params.append(f"%{name}%")
                if status:
                    conditions.append("kb.status = %s")
                    params.append(status)
                if owner:
                    conditions.append("(u.email LIKE %s OR u.nickname LIKE %s)")
                    params.extend([f"%{owner}%", f"%{owner}%"])
                
                where_clause = " AND ".join(conditions) if conditions else "1=1"
                
                count_params = params.copy()
                await cursor.execute(f"""
                    SELECT COUNT(*) FROM knowledgebase kb
                    LEFT JOIN user u ON kb.tenant_id = u.id
                    WHERE {where_clause}
                """, count_params)
                total = (await cursor.fetchone())[0]
                
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
                               title: str = None, owner: str = None) -> Dict[str, Any]:
        """List all agents from all users with pagination and filtering."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                conditions = []
                params = []
                if title:
                    conditions.append("uc.title LIKE %s")
                    params.append(f"%{title}%")
                if owner:
                    conditions.append("(u.email LIKE %s OR u.nickname LIKE %s)")
                    params.extend([f"%{owner}%", f"%{owner}%"])
                
                where_clause = " AND ".join(conditions) if conditions else "1=1"
                
                count_params = params.copy()
                await cursor.execute(f"""
                    SELECT COUNT(*) FROM user_canvas uc
                    LEFT JOIN user u ON uc.user_id = u.id
                    WHERE {where_clause}
                """, count_params)
                total = (await cursor.fetchone())[0]
                
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
                              name: str = None, owner: str = None) -> Dict[str, Any]:
        """List all chat assistants from all users with pagination and filtering."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                conditions = []
                params = []
                if name:
                    conditions.append("d.name LIKE %s")
                    params.append(f"%{name}%")
                if owner:
                    conditions.append("(u.email LIKE %s OR u.nickname LIKE %s)")
                    params.extend([f"%{owner}%", f"%{owner}%"])
                
                where_clause = " AND ".join(conditions) if conditions else "1=1"
                
                count_params = params.copy()
                await cursor.execute(f"""
                    SELECT COUNT(*) FROM dialog d
                    LEFT JOIN user u ON d.tenant_id = u.id
                    WHERE {where_clause}
                """, count_params)
                total = (await cursor.fetchone())[0]
                
                offset = (page - 1) * page_size
                await cursor.execute(f"""
                    SELECT d.id, d.name, d.description, d.icon, d.language,
                           d.llm_id, d.status, d.create_time, d.update_time, d.tenant_id,
                           u.email as owner_email, u.nickname as owner_nickname,
                           (SELECT COUNT(*) FROM conversation c WHERE c.dialog_id = d.id) as session_count
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
                        "session_count": row[12] or 0,
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
                await cursor.execute("SELECT COUNT(*) FROM conversation WHERE dialog_id = %s", (chat_id,))
                total = (await cursor.fetchone())[0]
                
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
                    messages = []
                    try:
                        if row[2]:
                            messages = json.loads(row[2])
                    except (json.JSONDecodeError, TypeError):
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

    async def delete_dataset(self, dataset_id: str) -> Dict[str, int]:
        """Delete a dataset and all related data."""
        return await self.delete_datasets([dataset_id])

    async def delete_datasets(self, dataset_ids: List[str]) -> Dict[str, int]:
        """Delete datasets and all related data (tasks, files, documents)."""
        if not dataset_ids:
            return {"datasets": 0, "documents": 0, "tasks": 0, "files": 0, "file_relations": 0}
        
        async def operations(cursor):
            placeholders = ",".join(["%s"] * len(dataset_ids))
            result = {"datasets": 0, "documents": 0, "tasks": 0, "files": 0, "file_relations": 0}
            
            await cursor.execute(f"SELECT id FROM document WHERE kb_id IN ({placeholders})", dataset_ids)
            doc_rows = await cursor.fetchall()
            doc_ids = [row[0] for row in doc_rows]
            
            if doc_ids:
                doc_placeholders = ",".join(["%s"] * len(doc_ids))
                
                await cursor.execute(f"DELETE FROM task WHERE doc_id IN ({doc_placeholders})", doc_ids)
                result["tasks"] = cursor.rowcount
                
                await cursor.execute(f"SELECT file_id FROM file2document WHERE document_id IN ({doc_placeholders})", doc_ids)
                file_rows = await cursor.fetchall()
                file_ids = [row[0] for row in file_rows if row[0]]
                
                await cursor.execute(f"DELETE FROM file2document WHERE document_id IN ({doc_placeholders})", doc_ids)
                result["file_relations"] = cursor.rowcount
                
                if file_ids:
                    file_placeholders = ",".join(["%s"] * len(file_ids))
                    await cursor.execute(f"DELETE FROM file WHERE id IN ({file_placeholders}) AND source_type = 'knowledgebase'", file_ids)
                    result["files"] = cursor.rowcount
                
                await cursor.execute(f"DELETE FROM document WHERE id IN ({doc_placeholders})", doc_ids)
                result["documents"] = cursor.rowcount
            
            await cursor.execute(f"DELETE FROM knowledgebase WHERE id IN ({placeholders})", dataset_ids)
            result["datasets"] = cursor.rowcount
            
            return result
        
        return await self._execute_transaction(operations)

    async def delete_agent(self, agent_id: str) -> Dict[str, int]:
        """Delete an agent and related data."""
        return await self.delete_agents([agent_id])

    async def delete_agents(self, agent_ids: List[str]) -> Dict[str, int]:
        """Delete agents and their version history."""
        if not agent_ids:
            return {"agents": 0, "versions": 0}
        
        async def operations(cursor):
            placeholders = ",".join(["%s"] * len(agent_ids))
            result = {"agents": 0, "versions": 0}
            
            await cursor.execute(f"DELETE FROM user_canvas_version WHERE user_canvas_id IN ({placeholders})", agent_ids)
            result["versions"] = cursor.rowcount
            
            await cursor.execute(f"DELETE FROM user_canvas WHERE id IN ({placeholders})", agent_ids)
            result["agents"] = cursor.rowcount
            
            return result
        
        return await self._execute_transaction(operations)

    async def delete_chat(self, chat_id: str) -> Dict[str, int]:
        """Delete a chat assistant and its conversations."""
        return await self.delete_chats([chat_id])

    async def delete_chats(self, chat_ids: List[str]) -> Dict[str, int]:
        """Delete multiple chat assistants and their conversations (with transaction)."""
        if not chat_ids:
            return {"chats": 0, "conversations": 0}
        
        async def operations(cursor):
            placeholders = ",".join(["%s"] * len(chat_ids))
            result = {"chats": 0, "conversations": 0}
            
            await cursor.execute(f"DELETE FROM conversation WHERE dialog_id IN ({placeholders})", chat_ids)
            result["conversations"] = cursor.rowcount
            
            await cursor.execute(f"DELETE FROM dialog WHERE id IN ({placeholders})", chat_ids)
            result["chats"] = cursor.rowcount
            
            return result
        
        return await self._execute_transaction(operations)

    async def delete_sessions(self, chat_id: str, session_ids: List[str]) -> int:
        """Delete chat sessions (conversations) by IDs."""
        if not session_ids:
            return 0
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                placeholders = ",".join(["%s"] * len(session_ids))
                await cursor.execute(
                    f"DELETE FROM conversation WHERE dialog_id = %s AND id IN ({placeholders})",
                    [chat_id] + session_ids
                )
                return cursor.rowcount
        finally:
            await self._release_connection(conn)

    async def delete_documents(self, dataset_id: str, document_ids: List[str]) -> Dict[str, int]:
        """Delete documents and related data. Note: ES chunks and MinIO files require RAGFlow API."""
        if not document_ids:
            return {"documents": 0, "tasks": 0, "files": 0, "file_relations": 0}
        
        async def operations(cursor):
            placeholders = ",".join(["%s"] * len(document_ids))
            result = {"documents": 0, "tasks": 0, "files": 0, "file_relations": 0}
            
            await cursor.execute(
                f"SELECT COALESCE(SUM(chunk_num), 0), COALESCE(SUM(token_num), 0) FROM document WHERE kb_id = %s AND id IN ({placeholders})",
                [dataset_id] + document_ids
            )
            row = await cursor.fetchone()
            total_chunks = int(row[0]) if row else 0
            total_tokens = int(row[1]) if row else 0
            
            await cursor.execute(f"DELETE FROM task WHERE doc_id IN ({placeholders})", document_ids)
            result["tasks"] = cursor.rowcount
            
            await cursor.execute(f"SELECT file_id FROM file2document WHERE document_id IN ({placeholders})", document_ids)
            file_rows = await cursor.fetchall()
            file_ids = [row[0] for row in file_rows if row[0]]
            
            await cursor.execute(f"DELETE FROM file2document WHERE document_id IN ({placeholders})", document_ids)
            result["file_relations"] = cursor.rowcount
            
            if file_ids:
                file_placeholders = ",".join(["%s"] * len(file_ids))
                await cursor.execute(f"DELETE FROM file WHERE id IN ({file_placeholders}) AND source_type = 'knowledgebase'", file_ids)
                result["files"] = cursor.rowcount
            
            await cursor.execute(f"DELETE FROM document WHERE kb_id = %s AND id IN ({placeholders})", [dataset_id] + document_ids)
            result["documents"] = cursor.rowcount
            
            if result["documents"] > 0:
                await cursor.execute(
                    """UPDATE knowledgebase SET 
                       doc_num = GREATEST(0, doc_num - %s),
                       chunk_num = GREATEST(0, chunk_num - %s),
                       token_num = GREATEST(0, token_num - %s)
                       WHERE id = %s""",
                    [result["documents"], total_chunks, total_tokens, dataset_id]
                )
            
            return result
        
        return await self._execute_transaction(operations)

    async def list_documents(self, dataset_id: str, page: int = 1, page_size: int = 20, **kwargs) -> Dict[str, Any]:
        """List documents with pagination. Supports keywords and run status filters."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                conditions = ["kb_id = %s"]
                params: List[Any] = [dataset_id]
                
                keywords = kwargs.get("keywords")
                if keywords:
                    conditions.append("name LIKE %s")
                    params.append(f"%{keywords}%")
                
                # RAGFlow status: 0=UNSTART, 1=RUNNING, 2=CANCEL, 3=DONE, 4=FAIL
                # Use CAST to handle both string and int types
                status_to_num = {'UNSTART': 0, 'RUNNING': 1, 'CANCEL': 2, 'DONE': 3, 'FAIL': 4}
                run_status = kwargs.get("run")
                if run_status:
                    run_num = status_to_num.get(run_status, int(run_status) if str(run_status).isdigit() else 0)
                    conditions.append("CAST(run AS SIGNED) = %s")
                    params.append(run_num)
                
                where_clause = " AND ".join(conditions)
                
                await cursor.execute(f"SELECT COUNT(*) FROM document WHERE {where_clause}", params)
                total = (await cursor.fetchone())[0]
                
                offset = (page - 1) * page_size
                query_params = params + [page_size, offset]
                await cursor.execute(f"""
                    SELECT id, name, thumbnail, location, size, type, 
                           token_num, chunk_num, progress, progress_msg,
                           process_begin_at, process_duration, run,
                           create_time, update_time
                    FROM document 
                    WHERE {where_clause}
                    ORDER BY create_time DESC
                    LIMIT %s OFFSET %s
                """, query_params)
                rows = await cursor.fetchall()
                
                run_status_map = {
                    '0': 'UNSTART', 0: 'UNSTART', '1': 'RUNNING', 1: 'RUNNING',
                    '2': 'CANCEL', 2: 'CANCEL', '3': 'DONE', 3: 'DONE', '4': 'FAIL', 4: 'FAIL',
                }
                
                documents = []
                for row in rows:
                    run_value = row[12]
                    run_status = run_status_map.get(run_value, str(run_value) if run_value else 'UNSTART')
                    
                    documents.append({
                        "id": row[0],
                        "name": row[1],
                        "thumbnail": row[2],
                        "location": row[3],
                        "size": row[4],
                        "type": row[5],
                        "token_count": row[6],
                        "chunk_count": row[7],
                        "progress": float(row[8]) if row[8] else 0,
                        "progress_msg": row[9],
                        "process_begin_at": format_datetime(row[10]) if row[10] else None,
                        "process_duration": row[11],
                        "run": run_status,
                        "create_time": format_datetime(row[13]),
                        "update_time": format_datetime(row[14]),
                    })
                
                return {
                    "items": documents,
                    "total": total,
                }
        finally:
            await self._release_connection(conn)


    async def list_parsing_tasks(self, page: int = 1, page_size: int = 20, 
                                  status: str = None, dataset_name: str = None,
                                  doc_name: str = None, owner: str = None) -> Dict[str, Any]:
        """List all document parsing tasks across all datasets with pagination and filters."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                conditions = []
                params = []
                
                # Status filter (RAGFlow status: 0=UNSTART, 1=RUNNING, 2=CANCEL, 3=DONE, 4=FAIL)
                # Use CAST to handle both string and int types
                status_to_num = {'UNSTART': 0, 'RUNNING': 1, 'CANCEL': 2, 'DONE': 3, 'FAIL': 4}
                if status:
                    run_num = status_to_num.get(status, int(status) if status.isdigit() else 0)
                    conditions.append("CAST(d.run AS SIGNED) = %s")
                    params.append(run_num)
                
                if dataset_name:
                    conditions.append("kb.name LIKE %s")
                    params.append(f"%{dataset_name}%")
                
                if doc_name:
                    conditions.append("d.name LIKE %s")
                    params.append(f"%{doc_name}%")
                
                if owner:
                    conditions.append("(u.email LIKE %s OR u.nickname LIKE %s)")
                    params.append(f"%{owner}%")
                    params.append(f"%{owner}%")
                
                where_clause = " AND ".join(conditions) if conditions else "1=1"
                
                count_params = params.copy()
                await cursor.execute(f"""
                    SELECT COUNT(*) FROM document d
                    LEFT JOIN knowledgebase kb ON d.kb_id = kb.id
                    LEFT JOIN user u ON kb.tenant_id = u.id
                    WHERE {where_clause}
                """, count_params)
                total = (await cursor.fetchone())[0]
                
                offset = (page - 1) * page_size
                await cursor.execute(f"""
                    SELECT d.id, d.name, d.size, d.type, d.token_num, d.chunk_num,
                           d.progress, d.progress_msg, d.process_begin_at, d.process_duration,
                           d.run, d.create_time, d.update_time, d.kb_id,
                           kb.name as dataset_name, u.email as owner_email, u.nickname as owner_nickname
                    FROM document d
                    LEFT JOIN knowledgebase kb ON d.kb_id = kb.id
                    LEFT JOIN user u ON kb.tenant_id = u.id
                    WHERE {where_clause}
                    ORDER BY 
                        CASE CAST(d.run AS SIGNED)
                            WHEN 1 THEN 1  -- RUNNING first
                            WHEN 0 THEN 2  -- UNSTART (pending) second
                            WHEN 4 THEN 3  -- FAIL third
                            ELSE 4         -- DONE, CANCEL last
                        END,
                        CASE WHEN CAST(d.run AS SIGNED) IN (0, 1) 
                             THEN d.create_time  -- Pending/Running: FIFO order
                             ELSE -d.update_time -- Others: newest first
                        END
                    LIMIT %s OFFSET %s
                """, params + [page_size, offset])
                rows = await cursor.fetchall()
                
                # Get global queue positions for RUNNING tasks only (not UNSTART)
                await cursor.execute("""
                    SELECT d.id, 
                           ROW_NUMBER() OVER (ORDER BY d.create_time) as queue_position
                    FROM document d
                    WHERE CAST(d.run AS SIGNED) = 1
                """)
                queue_rows = await cursor.fetchall()
                queue_position_map = {row[0]: row[1] for row in queue_rows}
                running_total = len(queue_position_map)
                
                run_status_map = {
                    '0': 'UNSTART', 0: 'UNSTART', '1': 'RUNNING', 1: 'RUNNING',
                    '2': 'CANCEL', 2: 'CANCEL', '3': 'DONE', 3: 'DONE', '4': 'FAIL', 4: 'FAIL',
                }
                
                tasks = []
                for row in rows:
                    run_value = row[10]
                    run_status = run_status_map.get(run_value, str(run_value) if run_value else 'UNSTART')
                    
                    task_id = row[0]
                    tasks.append({
                        "id": task_id,
                        "name": row[1],
                        "size": row[2],
                        "type": row[3],
                        "token_count": row[4],
                        "chunk_count": row[5],
                        "progress": float(row[6]) if row[6] else 0,
                        "progress_msg": row[7],
                        "process_begin_at": format_datetime(row[8]) if row[8] else None,
                        "process_duration": row[9],
                        "run": run_status,
                        "create_time": format_datetime(row[11]),
                        "update_time": format_datetime(row[12]),
                        "dataset_id": row[13],
                        "dataset_name": row[14],
                        "owner_email": row[15],
                        "owner_nickname": row[16],
                        "queue_position": queue_position_map.get(task_id),
                        "pending_total": running_total if task_id in queue_position_map else None,
                    })
                
                return {
                    "items": tasks,
                    "total": total,
                }
        finally:
            await self._release_connection(conn)

    async def get_parsing_stats(self) -> Dict[str, Any]:
        """Get parsing task statistics."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                # Count by status (use CAST to handle both string and int types)
                await cursor.execute("""
                    SELECT 
                        SUM(CASE WHEN CAST(run AS SIGNED) = 0 THEN 1 ELSE 0 END) as unstart,
                        SUM(CASE WHEN CAST(run AS SIGNED) = 1 THEN 1 ELSE 0 END) as running,
                        SUM(CASE WHEN CAST(run AS SIGNED) = 2 THEN 1 ELSE 0 END) as cancel,
                        SUM(CASE WHEN CAST(run AS SIGNED) = 3 THEN 1 ELSE 0 END) as done,
                        SUM(CASE WHEN CAST(run AS SIGNED) = 4 THEN 1 ELSE 0 END) as fail,
                        COUNT(*) as total
                    FROM document
                """)
                row = await cursor.fetchone()
                
                return {
                    "unstart": int(row[0] or 0),
                    "running": int(row[1] or 0),
                    "cancel": int(row[2] or 0),
                    "done": int(row[3] or 0),
                    "fail": int(row[4] or 0),
                    "total": int(row[5] or 0),
                }
        finally:
            await self._release_connection(conn)

    async def get_system_statistics(self) -> Dict[str, Any]:
        """Get comprehensive system statistics for monitoring."""
        conn = await self._get_connection()
        try:
            async with conn.cursor() as cursor:
                stats = {}
                
                # User statistics (use CAST to handle both string and int types)
                await cursor.execute("""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN CAST(status AS SIGNED) = 1 THEN 1 ELSE 0 END) as active,
                        SUM(CASE WHEN CAST(status AS SIGNED) = 0 THEN 1 ELSE 0 END) as inactive
                    FROM user
                """)
                row = await cursor.fetchone()
                stats["users"] = {
                    "total": int(row[0] or 0),
                    "active": int(row[1] or 0),
                    "inactive": int(row[2] or 0),
                }
                
                # Dataset statistics
                await cursor.execute("""
                    SELECT 
                        COUNT(*) as total,
                        COALESCE(SUM(doc_num), 0) as total_docs,
                        COALESCE(SUM(chunk_num), 0) as total_chunks,
                        COALESCE(SUM(token_num), 0) as total_tokens
                    FROM knowledgebase
                """)
                row = await cursor.fetchone()
                stats["datasets"] = {
                    "total": int(row[0] or 0),
                    "total_docs": int(row[1] or 0),
                    "total_chunks": int(row[2] or 0),
                    "total_tokens": int(row[3] or 0),
                }
                
                # Document parsing statistics (use CAST for type safety)
                # Note: canceled documents are excluded from effective_total for rate calculation
                await cursor.execute("""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN CAST(run AS SIGNED) = 0 THEN 1 ELSE 0 END) as pending,
                        SUM(CASE WHEN CAST(run AS SIGNED) = 1 THEN 1 ELSE 0 END) as running,
                        SUM(CASE WHEN CAST(run AS SIGNED) = 2 THEN 1 ELSE 0 END) as canceled,
                        SUM(CASE WHEN CAST(run AS SIGNED) = 3 THEN 1 ELSE 0 END) as completed,
                        SUM(CASE WHEN CAST(run AS SIGNED) = 4 THEN 1 ELSE 0 END) as failed,
                        COALESCE(SUM(size), 0) as total_size
                    FROM document
                """)
                row = await cursor.fetchone()
                total = int(row[0] or 0)
                pending = int(row[1] or 0)
                running = int(row[2] or 0)
                canceled = int(row[3] or 0)
                completed = int(row[4] or 0)
                failed = int(row[5] or 0)
                # effective_total excludes canceled documents for accurate rate calculation
                effective_total = total - canceled
                stats["documents"] = {
                    "total": total,
                    "effective_total": effective_total,
                    "pending": pending,
                    "running": running,
                    "canceled": canceled,
                    "completed": completed,
                    "failed": failed,
                    "total_size": int(row[6] or 0),
                }
                
                # Chat statistics
                await cursor.execute("""
                    SELECT 
                        (SELECT COUNT(*) FROM dialog) as total_chats,
                        (SELECT COUNT(*) FROM conversation) as total_sessions
                """)
                row = await cursor.fetchone()
                stats["chats"] = {
                    "total": int(row[0] or 0),
                    "total_sessions": int(row[1] or 0),
                }
                
                # Agent statistics
                await cursor.execute("SELECT COUNT(*) FROM user_canvas")
                stats["agents"] = {
                    "total": (await cursor.fetchone())[0],
                }
                
                # Recent activity (last 24 hours)
                # Handle both millisecond timestamps (>10^12) and second timestamps
                # If create_time > 10^12, treat as milliseconds; otherwise treat as seconds
                await cursor.execute("""
                    SELECT 
                        (SELECT COUNT(*) FROM user WHERE 
                            (create_time > 1000000000000 AND create_time > UNIX_TIMESTAMP(NOW() - INTERVAL 1 DAY) * 1000) OR
                            (create_time <= 1000000000000 AND create_time > UNIX_TIMESTAMP(NOW() - INTERVAL 1 DAY))
                        ) as new_users,
                        (SELECT COUNT(*) FROM document WHERE 
                            (create_time > 1000000000000 AND create_time > UNIX_TIMESTAMP(NOW() - INTERVAL 1 DAY) * 1000) OR
                            (create_time <= 1000000000000 AND create_time > UNIX_TIMESTAMP(NOW() - INTERVAL 1 DAY))
                        ) as new_docs,
                        (SELECT COUNT(*) FROM conversation WHERE 
                            (create_time > 1000000000000 AND create_time > UNIX_TIMESTAMP(NOW() - INTERVAL 1 DAY) * 1000) OR
                            (create_time <= 1000000000000 AND create_time > UNIX_TIMESTAMP(NOW() - INTERVAL 1 DAY))
                        ) as new_sessions
                """)
                row = await cursor.fetchone()
                stats["recent_activity"] = {
                    "new_users_24h": int(row[0] or 0),
                    "new_docs_24h": int(row[1] or 0),
                    "new_sessions_24h": int(row[2] or 0),
                }
                
                return stats
        finally:
            await self._release_connection(conn)


# Global instance
mysql_client = MySQLClient()
