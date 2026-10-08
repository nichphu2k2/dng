#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

CURRENT_PORT="80"
if [ -f "$ENV_FILE" ]; then
    SAVED_PORT=$(grep -E '^APP_PORT=' "$ENV_FILE" | cut -d '=' -f2 | tr -d '[:space:]')
    [ -n "$SAVED_PORT" ] && CURRENT_PORT="$SAVED_PORT"
fi

echo "=========================================="
echo "         CHANGE PORT WEB / NGINX        "
echo "=========================================="
echo "The port currently in use: $CURRENT_PORT"
echo ""

read -rp "Enter your desired new port (Press Enter to use the default: $CURRENT_PORT): " INPUT_PORT
CHOSEN_PORT="${INPUT_PORT:-$CURRENT_PORT}"
CHOSEN_PORT=$(echo "$CHOSEN_PORT" | tr -cd '0-9')
[ -z "$CHOSEN_PORT" ] && CHOSEN_PORT="80"

if [ "$CHOSEN_PORT" == "$CURRENT_PORT" ]; then
    echo "Port not change ($CHOSEN_PORT). Not input."
    exit 0
fi

echo ""
echo "-> Update port to: $CHOSEN_PORT"

# Ghi vào .env
if [ -f "$ENV_FILE" ] && grep -q '^APP_PORT=' "$ENV_FILE"; then
    sed -i "s/^APP_PORT=.*/APP_PORT=$CHOSEN_PORT/" "$ENV_FILE"
else
    echo "APP_PORT=$CHOSEN_PORT" >> "$ENV_FILE"
fi

echo "✓ Configuration saved file .env"
echo ""
echo "->Restart the Nginx container to apply the new port...."
cd "$SCRIPT_DIR"

if docker compose version >/dev/null 2>&1; then
    docker compose up -d --no-deps nginx
elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose up -d --no-deps nginx
else
    echo "⚠️  docker-compose not found."
    exit 1
fi

echo ""
echo "=========================================="
echo "Success! The current web access portal is: $CHOSEN_PORT"
echo "=========================================="

