import json
import logging
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Any, Dict, Generator, List

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pymysql.connections import Connection
from pymysql.err import MySQLError

from database import close_connection, get_connection, release_connection
from apscheduler.schedulers.background import BackgroundScheduler
from sendtelegram import send_telegram

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


logging.basicConfig(
	level=logging.INFO,
	format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Line Crossing Backend")

scheduler = BackgroundScheduler(
	timezone="Asia/Ho_Chi_Minh"
)


@contextmanager
def db_connection() -> Generator[Connection, None, None]:
	"""Provide a pooled DB connection and always return it to the pool."""
	conn = get_connection()
	try:
		yield conn
	finally:
		release_connection(conn)


def ensure_unique_indexes() -> None:
	"""Create unique indexes required for UPSERT, only if missing."""
	with db_connection() as conn:
		with conn.cursor() as cur:
			try:
				cur.execute(
					"""
					SELECT COUNT(1) AS cnt
					FROM information_schema.statistics
					WHERE table_schema = DATABASE()
					  AND table_name = 'day'
					  AND index_name = 'uq_day_name'
					"""
				)
				if cur.fetchone()["cnt"] == 0:
					cur.execute("ALTER TABLE `day` ADD UNIQUE KEY `uq_day_name` (`name`)")

				cur.execute(
					"""
					SELECT COUNT(1) AS cnt
					FROM information_schema.statistics
					WHERE table_schema = DATABASE()
					  AND table_name = 'summary'
					  AND index_name = 'uq_summary_date'
					"""
				)
				if cur.fetchone()["cnt"] == 0:
					cur.execute("ALTER TABLE `summary` ADD UNIQUE KEY `uq_summary_date` (`date`)")

				conn.commit()
			except MySQLError:
				conn.rollback()
				logger.exception("SQL error while creating unique indexes")
				raise


def update_day_and_summary(conn: Connection, stream_name: str, direction: str) -> None:
	"""Update day and summary tables in one atomic transaction."""
	in_increment = 1 if direction == "IN" else 0
	out_increment = 1 if direction == "OUT" else 0
	today = date.today()

	with conn.cursor() as cur:
		# Atomic upsert for day table.
		cur.execute(
			"""
			INSERT INTO `day` (`name`, `in`, `out`)
			VALUES (%s, %s, %s)
			ON DUPLICATE KEY UPDATE
				`in` = `in` + VALUES(`in`),
				`out` = `out` + VALUES(`out`)
			""",
			(stream_name, in_increment, out_increment),
		)

		cur.execute("SELECT COALESCE(SUM(`in`), 0) AS in_total, COALESCE(SUM(`out`), 0) AS out_total FROM `day`")
		totals = cur.fetchone()

		# Keep one summary row per day.
		cur.execute(
			"""
			INSERT INTO `summary` (`date`, `in_total`, `out_total`)
			VALUES (%s, %s, %s)
			ON DUPLICATE KEY UPDATE
				`in_total` = VALUES(`in_total`),
				`out_total` = VALUES(`out_total`)
			""",
			(today, totals["in_total"], totals["out_total"]),
		)

# =====================================================
# Gửi báo cáo summary hàng ngày qua Telegram
# =====================================================

def send_daily_summary():
	# Lấy ngày hiện tại theo giờ Việt Nam
	today_vn = datetime.now(VN_TZ).date()

	# Báo cáo của ngày hôm trước theo giờ Việt Nam
	yesterday = today_vn - timedelta(days=1)

	logger.info(
		"Telegram daily summary: today_vn=%s, report_date=%s",
		today_vn,
		yesterday,
	)

	with db_connection() as conn:
		try:
			with conn.cursor() as cur:

				cur.execute(
					"""
					SELECT
						`date`,
						`in_total`,
						`out_total`
					FROM `summary`
					WHERE `date` = %s
					""",
					(yesterday,)
				)

				row = cur.fetchone()

				if not row:
					message = (
						"📊 <b>BÁO CÁO NGÀY</b>\n\n"
						f"📅 Ngày: {yesterday}\n"
						"⚠️ Không có báo cáo trong ngày."
					)

					if send_telegram(message):
						logger.info(
							"No-data Telegram notification sent for %s",
							yesterday
						)
					else:
						logger.error(
							"Failed to send no-data Telegram notification"
						)

					return

				message = (
					"📊 <b>BÁO CÁO NGÀY</b>\n\n"
					f"📅 Ngày: {row['date']}\n"
					f"🟢 IN: {row['in_total']}\n"
					f"🔴 OUT: {row['out_total']}"
				)

				if send_telegram(message):
					logger.info(
						"Telegram summary sent successfully for %s",
						yesterday
					)
				else:
					logger.error(
						"Telegram summary sending failed"
					)

		except Exception:
			logger.exception(
				"Failed to create daily summary"
			)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
	return JSONResponse(status_code=400, content={"detail": "Invalid JSON", "errors": exc.errors()})


@app.on_event("startup")
def on_startup() -> None:

	logger.info(
		"Starting server and initializing database constraints"
	)
	try:
		ensure_unique_indexes()
		# =====================================================
		# THÊM: chạy Telegram report lúc 00:01 mỗi ngày
		# =====================================================

		scheduler.add_job(
			send_daily_summary,
			trigger="cron",
			hour=6,
			minute=30,
			id="daily-summary",
			replace_existing=True,
		)
		scheduler.start()
		logger.info(
			"Daily Telegram scheduler started"
		)
	except Exception:
		logger.exception(
			"Startup database initialization failed"
		)

@app.on_event("shutdown")
def on_shutdown() -> None:

	logger.info(
		"Shutting down server and closing DB pool"
	)
	# =====================================================
	# THÊM: dừng scheduler khi container stop
	# =====================================================

	if scheduler.running:
		scheduler.shutdown()
	close_connection()

@app.post("/webhook")
async def webhook(request: Request) -> Dict[str, Any]:
	try:
		payload = await request.json()
	except json.JSONDecodeError:
		raise HTTPException(status_code=400, detail="Invalid JSON")

	logger.info("Webhook received: %s", payload)

	if not isinstance(payload, dict):
		raise HTTPException(status_code=400, detail="Invalid JSON")

	stream_name = payload.get("stream_name")
	alert_events = payload.get("alert_events", [])

	if not isinstance(stream_name, str) or not stream_name.strip():
		raise HTTPException(status_code=400, detail="stream_name is required")
	if not isinstance(alert_events, list):
		raise HTTPException(status_code=400, detail="alert_events must be a list")

	processed = 0

	with db_connection() as conn:
		try:
			for event in alert_events:
				if not isinstance(event, dict):
					continue
				if event.get("alertor_type") != "cross_line":
					continue

				direction = event.get("cross_direction")
				if direction not in {"IN", "OUT"}:
					continue

				update_day_and_summary(conn, stream_name.strip(), direction)
				processed += 1

			conn.commit()
		except MySQLError:
			conn.rollback()
			logger.exception("SQL error while processing webhook")
			raise HTTPException(status_code=500, detail="Database error")
		except Exception:
			conn.rollback()
			logger.exception("Unexpected error while processing webhook")
			raise HTTPException(status_code=500, detail="Internal server error")

	return {"status": "ok", "processed": processed}


@app.get("/day")
def get_day() -> List[Dict[str, Any]]:
	with db_connection() as conn:
		try:
			with conn.cursor() as cur:
				cur.execute("SELECT `id`, `name`, `in`, `out` FROM `day` ORDER BY `name` ASC")
				return cur.fetchall()
		except MySQLError:
			logger.exception("SQL error while fetching day data")
			raise HTTPException(status_code=500, detail="Database error")


@app.get("/summary")
def get_summary() -> List[Dict[str, Any]]:
	with db_connection() as conn:
		try:
			with conn.cursor() as cur:
				cur.execute(
					"SELECT `date`, `in_total`, `out_total` FROM `summary` ORDER BY `date` DESC"
				)
				rows = cur.fetchall()
				for row in rows:
					if hasattr(row["date"], "isoformat"):
						row["date"] = row["date"].isoformat()
				return rows
		except MySQLError:
			logger.exception("SQL error while fetching summary data")
			raise HTTPException(status_code=500, detail="Database error")
