import os
import time
import socket
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

logger = logging.getLogger("senturian_config")

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LOGS_DIR = BASE_DIR / "logs"

DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Database configuration from environment variables
DB_TYPE = os.getenv("DB_TYPE", "mysql").lower()
DB_HOST = os.getenv("DB_HOST", "mysql")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "senturian")
DB_PASSWORD = os.getenv("DB_PASSWORD", "senturian")
DB_NAME = os.getenv("DB_NAME", "senturian")
SQLITE_PATH = DATA_DIR / "senturian.db"

_IS_MYSQL = (DB_TYPE == "mysql")

# 36 default mapping records for Channel Type + Alarm Type to text_key
DEFAULT_MAPPINGS = [
    (1,  'Face-human & Recon.',          None,                              'example_1',  'Face & Human Recognition (No Alarm Type)'),
    (2,  'Structure Analysis',           None,                              'example_2',  'Structure Analysis (No Alarm Type)'),
    (3,  'Goods',                        'Sundry Detect',                   'example_3',  'Sundry item detection'),
    (4,  'Goods',                        'Goods Forget',                    'example_4',  'Forgotten items / luggage'),
    (5,  'Goods',                        'Goods Guard',                     'example_5',  'Goods guard / protection'),
    (6,  'Safety',                       'No Safety Cap Alarm',             'example_6',  'No safety cap alarm'),
    (7,  'Safety',                       'No Uniform Alarm',                'example_7',  'No uniform alarm'),
    (8,  'Safety',                       'No Safety Belt Alarm',            'example_8',  'No safety belt alarm'),
    (9,  'Safety',                       'No Reflective Clothing Alarm',    'example_9',  'No reflective clothing alarm'),
    (10, 'Safety',                       'Flame Alarm',                     'example_10', 'Flame detection alarm'),
    (11, 'Safety',                       'Smog Alarm',                      'example_11', 'Smoke / smog alarm'),
    (12, 'Safety',                       'Loose Fire Equipment Detection',  'example_12', 'Loose / misplaced fire equipment'),
    (13, 'Safety',                       'Mask Detection',                  'example_13', 'Mask detection alarm'),
    (14, 'Safety',                       'Liquid Leak Detection',           'example_14', 'Liquid leak detection'),
    (15, 'Head Count',                   'Regional People Count',           'example_15', 'Regional people counting'),
    (16, 'Head Count',                   'Enter-exit People Count',         'example_16', 'Entry / exit people counting'),
    (17, 'Behavior Alert',               'Fall Detection',                  'example_17', 'Fall detection'),
    (18, 'Behavior Alert',               'Smoke Detection',                 'example_18', 'Smoking detection'),
    (19, 'Behavior Alert',               'Call',                            'call', 'Phone call detection'),
    (20, 'Behavior Alert',               'Watch Phone',                     'watch_phone', 'Phone browsing detection'),
    (21, 'Behavior Alert',               'Run',                             'example_21', 'Running / rapid movement detection'),
    (22, 'Behavior Alert',               'Sleep Detection',                 'sleep', 'Sleep detection'),
    (23, 'Behavior Alert',               'Person Off Duty Querying',        'example_23', 'Person off duty / absent'),
    (24, 'Behavior Alert',               'Gathering',                       'example_24', 'Crowd gathering'),
    (25, 'Behavior Alert',               'Fight',                           'example_25', 'Fight / brawl detection'),
    (26, 'Behavior Alert',               'Overstaffed',                     'example_26', 'Overstaffed alarm'),
    (27, 'Behavior Alert',               'Understaffed',                    'example_27', 'Understaffed alarm'),
    (28, 'Behavior Alert',               'Weapons detection',               'example_28', 'Weapons detection'),
    (29, 'Perimeter Alert',              'Park',                            'example_29', 'Illegal parking detection'),
    (30, 'Perimeter Alert',              'Exit',                            'example_30', 'Restricted exit detection'),
    (31, 'Perimeter Alert',              'Wander',                          'example_31', 'Loitering / wandering detection'),
    (32, 'Perimeter Alert',              'Over Wall Detection',             'example_32', 'Climbing over wall detection'),
    (33, 'Perimeter Alert',              'Intrusion',                       'example_33', 'Intrusion detection'),
    (34, 'Perimeter Alert',              'Tripwire',                        'example_34', 'Tripwire crossing detection'),
    (35, 'Perimeter Alert',              'Climbing Detection',              'example_35', 'Climbing detection'),
    (36, 'Video Inspection',             'Video Occlusion',                 'example_36', 'Camera lens occlusion'),
]

# Standard catalogue of valid Channel Type + Alarm Type combinations
VALID_CHANNEL_ALARM_MAPPINGS: Dict[str, List[Optional[str]]] = {
    "Face-human & Recon.": [None, ""],
    "Structure Analysis": [None, ""],
    "Goods": [
        "Sundry Detect",
        "Goods Forget",
        "Goods Guard"
    ],
    "Safety": [
        "No Safety Cap Alarm",
        "No Uniform Alarm",
        "No Safety Belt Alarm",
        "No Reflective Clothing Alarm",
        "Flame Alarm",
        "Smog Alarm",
        "Loose Fire Equipment Detection",
        "Mask Detection",
        "Liquid Leak Detection"
    ],
    "Head Count": [
        "Regional People Count",
        "Enter-exit People Count"
    ],
    "Behavior Alert": [
        "Fall Detection",
        "Smoke Detection",
        "Call",
        "Watch Phone",
        "Run",
        "Sleep Detection",
        "Person Off Duty Querying",
        "Gathering",
        "Fight",
        "Overstaffed",
        "Understaffed",
        "Weapons detection"
    ],
    "Perimeter Alert": [
        "Park",
        "Exit",
        "Wander",
        "Over Wall Detection",
        "Intrusion",
        "Tripwire",
        "Climbing Detection"
    ],
    "Video Inspection": [
        "Video Occlusion"
    ]
}


def is_valid_channel_alarm(channel_type: Optional[str], alarm_type: Optional[str]) -> bool:
    """
    Check if the (channel_type, alarm_type) pair belongs to the standard valid catalogue.
    Normalizes case and whitespace.
    """
    if not channel_type:
        return False

    ch_norm = str(channel_type).strip()
    al_norm = str(alarm_type).strip() if alarm_type and str(alarm_type).strip() else None

    for valid_ch, valid_alarms in VALID_CHANNEL_ALARM_MAPPINGS.items():
        if valid_ch.lower() == ch_norm.lower():
            if al_norm is None:
                return (None in valid_alarms or "" in valid_alarms)
            for va in valid_alarms:
                if va and va.lower() == al_norm.lower():
                    return True
            return False

    return False


def get_host_lan_ip() -> str:
    """Detect LAN IP address of the host machine."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"


class DBConnection:
    """Context manager for MySQL connection (PyMySQL) with SQLite fallback."""
    def __init__(self):
        self.conn = None
        self.is_mysql = (DB_TYPE == "mysql")

    def __enter__(self):
        if self.is_mysql:
            try:
                import pymysql
                import pymysql.cursors
                self.conn = pymysql.connect(
                    host=DB_HOST,
                    port=DB_PORT,
                    user=DB_USER,
                    password=DB_PASSWORD,
                    database=DB_NAME,
                    charset="utf8mb4",
                    cursorclass=pymysql.cursors.DictCursor,
                    autocommit=False,
                    connect_timeout=5
                )
                return self.conn
            except Exception as e:
                logger.warning(f"Could not connect to MySQL ({DB_HOST}:{DB_PORT}): {e}. Using SQLite fallback for this connection.")
                self.is_mysql = False

        import sqlite3
        self.conn = sqlite3.connect(str(SQLITE_PATH))
        self.conn.row_factory = sqlite3.Row
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            try:
                if exc_type is None:
                    self.conn.commit()
                else:
                    self.conn.rollback()
            except Exception:
                pass
            finally:
                self.conn.close()


def get_db():
    return DBConnection()


def init_database():
    """Initialize database tables with retry loop while waiting for MySQL container."""
    max_retries = 20
    for attempt in range(1, max_retries + 1):
        try:
            db_obj = get_db()
            with db_obj as conn:
                # If configured for MySQL but connection fell back to SQLite, raise to trigger retry
                if DB_TYPE == "mysql" and not db_obj.is_mysql:
                    raise ConnectionError("MySQL not ready yet, retrying...")

                cursor = conn.cursor()

                if db_obj.is_mysql:
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS settings (
                            key_name VARCHAR(100) PRIMARY KEY,
                            key_value TEXT NULL,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """)

                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS rules (
                            id VARCHAR(64) PRIMARY KEY,
                            name VARCHAR(255) NOT NULL,
                            camera_id VARCHAR(255) NOT NULL,
                            channel_type VARCHAR(100) NOT NULL,
                            alarm_type VARCHAR(100) NULL,
                            text_key VARCHAR(100) NULL,
                            face_groups VARCHAR(255) NULL,
                            device_id VARCHAR(100) NULL,
                            stream_id INT DEFAULT 1,
                            enable_source TINYINT(1) DEFAULT 1,
                            source VARCHAR(100) DEFAULT 'Senturian_AI',
                            enable_caption TINYINT(1) DEFAULT 1,
                            caption VARCHAR(255) NULL,
                            enable_description TINYINT(1) DEFAULT 0,
                            description TEXT NULL,
                            enabled TINYINT(1) DEFAULT 1,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                            INDEX idx_text_key (text_key)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """)

                    # Automatically add text_key column if upgrading from an older schema
                    try:
                        cursor.execute("SHOW COLUMNS FROM rules LIKE 'text_key'")
                        if not cursor.fetchone():
                            cursor.execute("ALTER TABLE rules ADD COLUMN text_key VARCHAR(100) NULL AFTER alarm_type, ADD INDEX idx_text_key (text_key)")
                    except Exception as e:
                        logger.warning(f"Check text_key column: {e}")

                    # Automatically add face_groups column if upgrading from an older schema
                    try:
                        cursor.execute("SHOW COLUMNS FROM rules LIKE 'face_groups'")
                        if not cursor.fetchone():
                            cursor.execute("ALTER TABLE rules ADD COLUMN face_groups VARCHAR(255) NULL AFTER text_key")
                    except Exception as e:
                        logger.warning(f"Check face_groups column: {e}")

                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS channel_alarm_mappings (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            channel_type VARCHAR(100) NOT NULL,
                            alarm_type VARCHAR(100) NULL,
                            text_key VARCHAR(100) NOT NULL,
                            note VARCHAR(255) NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                            INDEX idx_channel_alarm (channel_type, alarm_type)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """)

                    # Default settings
                    cursor.execute("SELECT COUNT(*) AS cnt FROM settings")
                    row = cursor.fetchone()
                    count = row["cnt"] if isinstance(row, dict) else row[0]
                    if count == 0:
                        default_settings = [
                            ("vms_ip", "192.168.1.100"),
                            ("vms_port", "7001"),
                            ("vms_user", "admin"),
                            ("vms_password", "admin@password2026"),
                            ("sync_enabled", "1"),
                            ("webhook_path", "/api/webhook/senturian")
                        ]
                        cursor.executemany("INSERT INTO settings (key_name, key_value) VALUES (%s, %s)", default_settings)



                    # 36 default mapping entries
                    cursor.execute("SELECT COUNT(*) AS cnt FROM channel_alarm_mappings")
                    row = cursor.fetchone()
                    count = row["cnt"] if isinstance(row, dict) else row[0]
                    if count == 0:
                        cursor.executemany("""
                            INSERT INTO channel_alarm_mappings (id, channel_type, alarm_type, text_key, note)
                            VALUES (%s, %s, %s, %s, %s)
                        """, DEFAULT_MAPPINGS)

                    # Auto-migrate any existing rules and settings from SQLite to MySQL
                    if SQLITE_PATH.exists():
                        try:
                            import sqlite3
                            sq_conn = sqlite3.connect(str(SQLITE_PATH))
                            sq_conn.row_factory = sqlite3.Row
                            sq_cur = sq_conn.cursor()

                            # Migrate settings
                            try:
                                sq_cur.execute("SELECT key_name, key_value FROM settings")
                                sq_settings = sq_cur.fetchall()
                                for s in sq_settings:
                                    cursor.execute("""
                                        INSERT INTO settings (key_name, key_value) VALUES (%s, %s)
                                        ON DUPLICATE KEY UPDATE key_value = VALUES(key_value)
                                    """, (s["key_name"], s["key_value"]))
                            except Exception as ex_set:
                                logger.warning(f"Settings migration note: {ex_set}")

                            # Migrate rules
                            try:
                                sq_cur.execute("SELECT * FROM rules")
                                sq_rules = sq_cur.fetchall()
                                for r in sq_rules:
                                    r_dict = dict(r)
                                    cursor.execute("""
                                        INSERT INTO rules (
                                            id, name, camera_id, channel_type, alarm_type, text_key, face_groups, device_id,
                                            stream_id, enable_source, source, enable_caption, caption,
                                            enable_description, description, enabled
                                        ) VALUES (
                                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                                        ) ON DUPLICATE KEY UPDATE
                                            name = VALUES(name),
                                            camera_id = VALUES(camera_id),
                                            channel_type = VALUES(channel_type),
                                            alarm_type = VALUES(alarm_type),
                                            text_key = VALUES(text_key),
                                            face_groups = VALUES(face_groups),
                                            device_id = VALUES(device_id),
                                            stream_id = VALUES(stream_id),
                                            enable_source = VALUES(enable_source),
                                            source = VALUES(source),
                                            enable_caption = VALUES(enable_caption),
                                            caption = VALUES(caption),
                                            enable_description = VALUES(enable_description),
                                            description = VALUES(description),
                                            enabled = VALUES(enabled)
                                    """, (
                                        r_dict.get("id"),
                                        r_dict.get("name"),
                                        r_dict.get("camera_id"),
                                        r_dict.get("channel_type"),
                                        r_dict.get("alarm_type"),
                                        r_dict.get("text_key"),
                                        r_dict.get("face_groups"),
                                        r_dict.get("device_id"),
                                        int(r_dict.get("stream_id", 1)),
                                        int(r_dict.get("enable_source", 1)),
                                        r_dict.get("source", ""),
                                        int(r_dict.get("enable_caption", 1)),
                                        r_dict.get("caption", ""),
                                        int(r_dict.get("enable_description", 0)),
                                        r_dict.get("description", ""),
                                        int(r_dict.get("enabled", 1))
                                    ))
                                if len(sq_rules) > 0:
                                    logger.info(f"Successfully migrated {len(sq_rules)} rule(s) from SQLite to MySQL!")
                            except Exception as ex_rule:
                                logger.warning(f"Rules migration note: {ex_rule}")

                            sq_conn.close()
                        except Exception as ex_mig:
                            logger.warning(f"SQLite migration check: {ex_mig}")

                else:
                    # SQLite fallback
                    cursor.execute("CREATE TABLE IF NOT EXISTS settings (key_name TEXT PRIMARY KEY, key_value TEXT)")
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS rules (
                            id TEXT PRIMARY KEY, name TEXT NOT NULL, camera_id TEXT NOT NULL,
                            channel_type TEXT NOT NULL, alarm_type TEXT, text_key TEXT, face_groups TEXT, device_id TEXT,
                            stream_id INTEGER DEFAULT 1, enable_source INTEGER DEFAULT 1, source TEXT DEFAULT 'Senturian_AI',
                            enable_caption INTEGER DEFAULT 1, caption TEXT, enable_description INTEGER DEFAULT 1,
                            description TEXT, enabled INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """)
                    try:
                        cursor.execute("ALTER TABLE rules ADD COLUMN text_key TEXT")
                    except Exception:
                        pass
                    try:
                        cursor.execute("ALTER TABLE rules ADD COLUMN face_groups TEXT")
                    except Exception:
                        pass
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS channel_alarm_mappings (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            channel_type TEXT NOT NULL,
                            alarm_type TEXT,
                            text_key TEXT NOT NULL,
                            note TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """)
                    cursor.execute("SELECT COUNT(*) FROM channel_alarm_mappings")
                    if cursor.fetchone()[0] == 0:
                        cursor.executemany("""
                            INSERT INTO channel_alarm_mappings (id, channel_type, alarm_type, text_key, note)
                            VALUES (?, ?, ?, ?, ?)
                        """, DEFAULT_MAPPINGS)

                logger.info(f"Database initialized successfully (Engine: {'MySQL' if db_obj.is_mysql else 'SQLite'})")
                return
        except Exception as e:
            logger.warning(f"[DB Init Attempt {attempt}/{max_retries}] Waiting for MySQL to be ready: {e}")
            time.sleep(2)

    logger.error("Failed to initialize database after multiple attempts.")


def get_all_settings() -> Dict[str, str]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT key_name, key_value FROM settings")
        rows = cursor.fetchall()
        result = {}
        for row in rows:
            k = row["key_name"] if isinstance(row, dict) else row[0]
            v = row["key_value"] if isinstance(row, dict) else row[1]
            result[k] = v
        return result


def update_settings(updates: Dict[str, Any]):
    with get_db() as conn:
        cursor = conn.cursor()
        for k, v in updates.items():
            if v is not None:
                if _IS_MYSQL:
                    cursor.execute("""
                        INSERT INTO settings (key_name, key_value) VALUES (%s, %s)
                        ON DUPLICATE KEY UPDATE key_value = VALUES(key_value)
                    """, (k, str(v)))
                else:
                    cursor.execute("""
                        INSERT INTO settings (key_name, key_value) VALUES (?, ?)
                        ON CONFLICT(key_name) DO UPDATE SET key_value=excluded.key_value
                    """, (k, str(v)))


def get_success_records_count() -> int:
    """Retrieve total count of generic events successfully posted to NX VMS."""
    with get_db() as conn:
        cursor = conn.cursor()
        ph = "%s" if _IS_MYSQL else "?"
        cursor.execute(f"SELECT key_value FROM settings WHERE key_name = {ph}", ("total_success_records",))
        row = cursor.fetchone()
        if row:
            val = row["key_value"] if isinstance(row, dict) else row[0]
            try:
                return int(val)
            except (ValueError, TypeError):
                return 0
        return 0


def increment_success_records_count() -> int:
    """Atomically increment total_success_records count upon successful POST /rest/v4/events/generic."""
    with get_db() as conn:
        cursor = conn.cursor()
        if _IS_MYSQL:
            cursor.execute("""
                INSERT INTO settings (key_name, key_value) VALUES ('total_success_records', '1')
                ON DUPLICATE KEY UPDATE key_value = CAST(COALESCE(key_value, '0') AS UNSIGNED) + 1
            """)
        else:
            cursor.execute("""
                INSERT INTO settings (key_name, key_value) VALUES ('total_success_records', '1')
                ON CONFLICT(key_name) DO UPDATE SET key_value = CAST(COALESCE(key_value, '0') AS INTEGER) + 1
            """)
    return get_success_records_count()


def get_all_rules() -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM rules ORDER BY created_at DESC")
        rows = cursor.fetchall()
        results = []
        for r in rows:
            item = dict(r)
            results.append(item)
        return results


def get_rule_by_id(rule_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        ph = "%s" if _IS_MYSQL else "?"
        cursor.execute(f"SELECT * FROM rules WHERE id = {ph}", (rule_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_active_face_rules() -> List[Dict[str, Any]]:
    """
    Query active rules for 'Face-human & Recon.':
    rules.channel_type = 'Face-human & Recon.' AND rules.enabled = 1
    """
    with get_db() as conn:
        cursor = conn.cursor()
        ph = "%s" if _IS_MYSQL else "?"
        cursor.execute(
            f"SELECT * FROM rules WHERE channel_type = {ph} AND enabled = 1 ORDER BY created_at DESC",
            ("Face-human & Recon.",)
        )
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


def get_all_rules_by_text_key(text_key: str) -> List[Dict[str, Any]]:
    """
    Find all rules matching text_key.
    Matches directly on rules.text_key, or joins channel_alarm_mappings table
    if the rule does not have text_key stored directly.
    """
    if not text_key:
        return []

    tk = str(text_key).strip()
    with get_db() as conn:
        cursor = conn.cursor()
        ph = "%s" if _IS_MYSQL else "?"
        query = f"""
            SELECT DISTINCT r.* 
            FROM rules r
            LEFT JOIN channel_alarm_mappings m 
              ON r.channel_type = m.channel_type 
             AND (r.alarm_type = m.alarm_type OR (r.alarm_type IS NULL AND m.alarm_type IS NULL) OR (r.alarm_type = '' AND m.alarm_type IS NULL))
            WHERE r.text_key = {ph} OR m.text_key = {ph}
            ORDER BY r.created_at DESC
        """
        cursor.execute(query, (tk, tk))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


def get_rule_by_text_key(text_key: str) -> Optional[Dict[str, Any]]:
    """Find the most recent rule corresponding to text_key."""
    rules = get_all_rules_by_text_key(text_key)
    return rules[0] if rules else None


def find_matching_rules(
    text_key: str,
    device_id: str,
    stream_id: Any
) -> List[Dict[str, Any]]:
    """
    Find rules matching the 3 Webhook criteria:
    - alert_events.alertor_type == rules.text_key (or mapped via channel_alarm_mappings)
    - webhook.device_id == rules.device_id
    - webhook.stream_id == rules.stream_id
    """
    if not text_key or not device_id or stream_id is None:
        return []

    tk = str(text_key).strip()
    dev = str(device_id).strip()
    try:
        stm = int(stream_id)
    except (ValueError, TypeError):
        stm = 1

    with get_db() as conn:
        cursor = conn.cursor()
        ph = "%s" if _IS_MYSQL else "?"

        query = f"""
            SELECT DISTINCT r.* 
            FROM rules r
            LEFT JOIN channel_alarm_mappings m 
              ON r.channel_type = m.channel_type 
             AND (r.alarm_type = m.alarm_type OR (r.alarm_type IS NULL AND m.alarm_type IS NULL) OR (r.alarm_type = '' AND m.alarm_type IS NULL))
            WHERE (r.text_key = {ph} OR m.text_key = {ph})
              AND TRIM(r.device_id) = TRIM({ph})
              AND r.stream_id = {ph}
            ORDER BY r.created_at DESC
        """
        cursor.execute(query, (tk, tk, dev, stm))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


def save_or_update_rule(rule_data: Dict[str, Any]) -> Dict[str, Any]:
    with get_db() as conn:
        cursor = conn.cursor()

        channel_type = rule_data.get("channel_type") or rule_data.get("channelType", "")
        alarm_type = rule_data.get("alarm_type") or rule_data.get("alarmType")
        text_key = rule_data.get("text_key") or rule_data.get("textKey")

        # Automatically look up text_key if not provided
        if not text_key and channel_type:
            text_key = get_text_key_by_channel_alarm(channel_type, alarm_type)

        # Parse stream_id correctly whether streamId or stream_id is passed
        stream_val = 1
        if rule_data.get("streamId") is not None:
            try:
                stream_val = int(rule_data["streamId"])
            except (ValueError, TypeError):
                stream_val = 1
        elif rule_data.get("stream_id") is not None:
            try:
                stream_val = int(rule_data["stream_id"])
            except (ValueError, TypeError):
                stream_val = 1

        enable_source = True
        if rule_data.get("enableSource") is not None:
            enable_source = bool(rule_data["enableSource"])
        elif rule_data.get("enable_source") is not None:
            enable_source = bool(rule_data["enable_source"])

        enable_caption = True
        if rule_data.get("enableCaption") is not None:
            enable_caption = bool(rule_data["enableCaption"])
        elif rule_data.get("enable_caption") is not None:
            enable_caption = bool(rule_data["enable_caption"])

        enable_description = False
        if rule_data.get("enableDescription") is not None:
            enable_description = bool(rule_data["enableDescription"])
        elif rule_data.get("enable_description") is not None:
            enable_description = bool(rule_data["enable_description"])

        enabled_val = True
        if rule_data.get("enabled") is not None:
            enabled_val = bool(rule_data["enabled"])

        face_groups = rule_data.get("face_groups")
        if face_groups is None:
            face_groups = rule_data.get("faceGroups")

        params = (
            rule_data.get("id"),
            rule_data.get("name"),
            rule_data.get("camera_id") or rule_data.get("cameraId", ""),
            channel_type,
            alarm_type,
            text_key,
            face_groups,
            rule_data.get("device_id") or rule_data.get("deviceId", ""),
            stream_val,
            1 if enable_source else 0,
            rule_data.get("source", "Senturian_AI"),
            1 if enable_caption else 0,
            rule_data.get("caption", ""),
            1 if enable_description else 0,
            rule_data.get("description", ""),
            1 if enabled_val else 0,
        )

        if _IS_MYSQL:
            cursor.execute("""
                INSERT INTO rules (
                    id, name, camera_id, channel_type, alarm_type, text_key, face_groups, device_id,
                    stream_id, enable_source, source, enable_caption, caption,
                    enable_description, description, enabled
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    camera_id = VALUES(camera_id),
                    channel_type = VALUES(channel_type),
                    alarm_type = VALUES(alarm_type),
                    text_key = VALUES(text_key),
                    face_groups = VALUES(face_groups),
                    device_id = VALUES(device_id),
                    stream_id = VALUES(stream_id),
                    enable_source = VALUES(enable_source),
                    source = VALUES(source),
                    enable_caption = VALUES(enable_caption),
                    caption = VALUES(caption),
                    enable_description = VALUES(enable_description),
                    description = VALUES(description),
                    enabled = VALUES(enabled),
                    updated_at = CURRENT_TIMESTAMP
            """, params)
        else:
            cursor.execute("""
                INSERT INTO rules (
                    id, name, camera_id, channel_type, alarm_type, text_key, face_groups, device_id,
                    stream_id, enable_source, source, enable_caption, caption,
                    enable_description, description, enabled
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    camera_id = excluded.camera_id,
                    channel_type = excluded.channel_type,
                    alarm_type = excluded.alarm_type,
                    text_key = excluded.text_key,
                    face_groups = excluded.face_groups,
                    device_id = excluded.device_id,
                    stream_id = excluded.stream_id,
                    enable_source = excluded.enable_source,
                    source = excluded.source,
                    enable_caption = excluded.enable_caption,
                    caption = excluded.caption,
                    enable_description = excluded.enable_description,
                    description = excluded.description,
                    enabled = excluded.enabled,
                    updated_at = CURRENT_TIMESTAMP
            """, params)

    return get_rule_by_id(rule_data.get("id"))


def delete_rule(rule_id: str) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        ph = "%s" if _IS_MYSQL else "?"
        cursor.execute(f"DELETE FROM rules WHERE id = {ph}", (rule_id,))
        return cursor.rowcount > 0


def toggle_rule(rule_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        ph = "%s" if _IS_MYSQL else "?"
        cursor.execute(f"UPDATE rules SET enabled = 1 - enabled, updated_at = CURRENT_TIMESTAMP WHERE id = {ph}", (rule_id,))
    return get_rule_by_id(rule_id)


# ==============================================================================
# channel_alarm_mappings TABLE OPERATIONS
# ==============================================================================

def get_all_channel_alarm_mappings() -> List[Dict[str, Any]]:
    """Retrieve all 36 mapping records from channel_alarm_mappings table."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, channel_type, alarm_type, text_key, note FROM channel_alarm_mappings ORDER BY id ASC")
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


def get_text_key_by_channel_alarm(channel_type: str, alarm_type: Optional[str] = None) -> Optional[str]:
    """
    Match Channel Type + Alarm Type to retrieve the corresponding text_key from database.
    If alarm_type is None or empty (e.g. Face-human or Structure Analysis),
    matches records where alarm_type IS NULL or empty.
    """
    if not channel_type:
        return None

    ch = channel_type.strip()
    al = alarm_type.strip() if alarm_type and alarm_type.strip() else None

    with get_db() as conn:
        cursor = conn.cursor()
        if al:
            ph = ("%s", "%s") if _IS_MYSQL else ("?", "?")
            cursor.execute(f"""
                SELECT text_key FROM channel_alarm_mappings 
                WHERE channel_type = {ph[0]} AND alarm_type = {ph[1]} 
                LIMIT 1
            """, (ch, al))
        else:
            ph = "%s" if _IS_MYSQL else "?"
            cursor.execute(f"""
                SELECT text_key FROM channel_alarm_mappings 
                WHERE channel_type = {ph} AND (alarm_type IS NULL OR alarm_type = '') 
                LIMIT 1
            """, (ch,))

        row = cursor.fetchone()
        if row:
            return row["text_key"] if isinstance(row, dict) else row[0]
        return None


def update_mapping_text_key(mapping_id: int, text_key: str) -> bool:
    """Update text_key for a mapping record by ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        ph = ("%s", "%s") if _IS_MYSQL else ("?", "?")
        cursor.execute(f"""
            UPDATE channel_alarm_mappings 
            SET text_key = {ph[0]}, updated_at = CURRENT_TIMESTAMP 
            WHERE id = {ph[1]}
        """, (text_key.strip(), mapping_id))
        return cursor.rowcount > 0
