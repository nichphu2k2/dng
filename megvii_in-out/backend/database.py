import logging
import os
import queue
import threading
from typing import Optional

import pymysql
from dotenv import load_dotenv
from pymysql.connections import Connection

load_dotenv()

logger = logging.getLogger(__name__)


class MySQLConnectionPool:
    """Thread-safe minimal MySQL connection pool based on pymysql."""

    def __init__(self, min_size: int = 1, max_size: int = 10, timeout: int = 10) -> None:
        self._min_size = min_size
        self._max_size = max_size
        self._timeout = timeout
        self._pool: queue.LifoQueue[Connection] = queue.LifoQueue(maxsize=max_size)
        self._lock = threading.Lock()
        self._size = 0
        self._closed = False

        for _ in range(self._min_size):
            conn = self._create_connection()
            self._pool.put(conn)
            self._size += 1

    @staticmethod
    def _db_config() -> dict:
        return {
            "host": os.getenv("MYSQL_HOST", "mysql"),
            "port": int(os.getenv("MYSQL_PORT", "3306")),
            "user": os.getenv("MYSQL_USER", "root"),
            "password": os.getenv("MYSQL_PASSWORD", ""),
            "database": os.getenv("MYSQL_DATABASE", ""),
            "charset": "utf8mb4",
            "cursorclass": pymysql.cursors.DictCursor,
            "autocommit": False,
            "connect_timeout": 10,
            "read_timeout": 10,
            "write_timeout": 10,
        }

    def _create_connection(self) -> Connection:
        return pymysql.connect(**self._db_config())

    def get_connection(self) -> Connection:
        if self._closed:
            raise RuntimeError("Connection pool is closed")

        conn: Optional[Connection] = None
        try:
            conn = self._pool.get_nowait()
        except queue.Empty:
            with self._lock:
                if self._size < self._max_size:
                    conn = self._create_connection()
                    self._size += 1

        if conn is None:
            conn = self._pool.get(timeout=self._timeout)

        try:
            conn.ping(reconnect=True)
        except Exception:
            logger.warning("MySQL reconnect triggered")
            try:
                conn.close()
            except Exception:
                pass
            conn = self._create_connection()

        return conn

    def release(self, conn: Connection) -> None:
        if self._closed:
            try:
                conn.close()
            except Exception:
                pass
            return

        try:
            conn.ping(reconnect=True)
            self._pool.put_nowait(conn)
        except Exception:
            with self._lock:
                self._size = max(0, self._size - 1)
            try:
                conn.close()
            except Exception:
                pass

    def close(self) -> None:
        self._closed = True
        while True:
            try:
                conn = self._pool.get_nowait()
            except queue.Empty:
                break
            try:
                conn.close()
            except Exception:
                pass


_POOL: Optional[MySQLConnectionPool] = None
_POOL_LOCK = threading.Lock()


def _get_pool() -> MySQLConnectionPool:
    global _POOL
    if _POOL is None:
        with _POOL_LOCK:
            if _POOL is None:
                _POOL = MySQLConnectionPool()
    return _POOL


def get_connection() -> Connection:
    return _get_pool().get_connection()


def release_connection(conn: Connection) -> None:
    _get_pool().release(conn)


def close_connection() -> None:
    global _POOL
    with _POOL_LOCK:
        if _POOL is not None:
            _POOL.close()
            _POOL = None