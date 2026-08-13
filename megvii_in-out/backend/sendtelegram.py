import requests
import logging

BOT_TOKEN = "7260570513:AAFtQtFWN-TuPSQLY70UMEN-sR28en8dcpQ"
CHAT_ID = "6767911255"

MESSAGE_URL = (
    f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
)

PHOTO_URL = (
    f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
)


def send_telegram(message: str, parse_mode="HTML") -> bool:
    try:
        resp = requests.post(
            MESSAGE_URL,
            json={
                "chat_id": CHAT_ID,
                "text": message,
                "parse_mode": parse_mode,
            },
            timeout=5,
        )

        resp.raise_for_status()
        return True

    except Exception:
        logging.exception(
            "Send Telegram failed"
        )
        return False


def send_telegram_photo(photo_path, caption="") -> bool:
    try:
        with open(photo_path, "rb") as photo:

            resp = requests.post(
                PHOTO_URL,
                data={
                    "chat_id": CHAT_ID,
                    "caption": caption,
                    "parse_mode": "HTML",
                },
                files={
                    "photo": photo
                },
                timeout=10,
            )

        resp.raise_for_status()

        return True

    except Exception:
        logging.exception(
            "Send Telegram photo failed"
        )
        return False