import os
import sqlite3
import datetime
from pathlib import Path

DATA_DIR = os.getenv("DATA_DIR", "./data")
DATA_PATH = Path(DATA_DIR).resolve()
DB_FILE = DATA_PATH / "webnote.db"
IMAGES_DIR = DATA_PATH / "images"

def init_db():
    DATA_PATH.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS document (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                line1 TEXT NOT NULL DEFAULT '',
                line2 TEXT NOT NULL DEFAULT '',
                line3 TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                version INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS images (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size INTEGER NOT NULL,
                width INTEGER DEFAULT 0,
                height INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        cursor.execute("SELECT id FROM document WHERE id = 1")
        row = cursor.fetchone()
        if not row:
            now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            cursor.execute("""
                INSERT INTO document (id, line1, line2, line3, content, version, updated_at)
                VALUES (1, '', '', '', '', 1, ?)
            """, (now,))
        conn.commit()

def get_connection():
    conn = sqlite3.connect(DB_FILE, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn

def get_document():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, line1, line2, line3, content, version, updated_at FROM document WHERE id = 1")
        row = cursor.fetchone()
        if row:
            return dict(row)
        return {
            "id": 1,
            "line1": "",
            "line2": "",
            "line3": "",
            "content": "",
            "version": 1,
            "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

def update_document(
    line1: str | None = None,
    line2: str | None = None,
    line3: str | None = None,
    content: str | None = None,
    client_version: int | None = None
):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT line1, line2, line3, content, version FROM document WHERE id = 1")
        row = cursor.fetchone()
        current_version = row["version"] if row else 1
        
        cur_line1 = row["line1"] if row else ""
        cur_line2 = row["line2"] if row else ""
        cur_line3 = row["line3"] if row else ""
        cur_content = row["content"] if row else ""

        final_line1 = line1 if line1 is not None else cur_line1
        final_line2 = line2 if line2 is not None else cur_line2
        final_line3 = line3 if line3 is not None else cur_line3
        final_content = content if content is not None else cur_content

        new_version = current_version + 1
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        cursor.execute("""
            UPDATE document
            SET line1 = ?, line2 = ?, line3 = ?, content = ?, version = ?, updated_at = ?
            WHERE id = 1
        """, (final_line1, final_line2, final_line3, final_content, new_version, now))
        conn.commit()

        return {
            "id": 1,
            "line1": final_line1,
            "line2": final_line2,
            "line3": final_line3,
            "content": final_content,
            "version": new_version,
            "updated_at": now
        }

def save_image_metadata(image_id: str, filename: str, mime_type: str, size: int, width: int = 0, height: int = 0):
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO images (id, filename, mime_type, size, width, height, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (image_id, filename, mime_type, size, width, height, now))
        conn.commit()

def get_image_metadata(image_id: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, filename, mime_type, size, width, height, created_at FROM images WHERE id = ?", (image_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
