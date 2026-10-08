#!/bin/bash
set -e

# Identify the project root directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/mediamtx/mediamtx.yml"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Error: Configuration file not found at $CONFIG_FILE"
    exit 1
fi

# Use the host/IP currently configured in mediamtx.yml.
CURRENT_HOST=$(awk '/^webrtcAdditionalHosts:/{flag=1; next} flag && /^[[:space:]]*- /{print $2; exit} !/^[[:space:]]*- /{flag=0}' "$CONFIG_FILE")

echo "=========================================="
echo "    Configure IP / DOMAIN CHO MEDIAMTX     "
echo "=========================================="
echo "Current host in mediamtx.yml: ${CURRENT_HOST:-Not yet configured}"
echo ""

read -rp "Enter a new IP or domain (Ex: 192.168.1.88 or cam.domain.com): " INPUT_HOST

CLEAN_HOST=$(echo "$INPUT_HOST" | sed -e 's|^https*://||' -e 's|/.*||' -e 's|:.*||' | tr -d '[:space:]')

if [ -z "$CLEAN_HOST" ]; then
    echo "⚠️  You haven't entered a value. Operation cancelled."
    exit 0
fi

echo ""
echo "-> Update webrtcAdditionalHosts to: $CLEAN_HOST"

TMP_FILE=$(mktemp)
awk -v new_host="$CLEAN_HOST" '
BEGIN { in_block = 0 }
/^webrtcAdditionalHosts:/ {
    print $0
    print "  - " new_host
    in_block = 1
    next
}
in_block && /^[[:space:]]*- / {
    next
}
in_block && !/^[[:space:]]*- / {
    in_block = 0
}
{ print $0 }
' "$CONFIG_FILE" > "$TMP_FILE"

mv "$TMP_FILE" "$CONFIG_FILE"

echo "✓ Successfully updated the mediamtx/mediamtx.yml file!"
echo ""
echo "-> Restarting the mediamtx container...."

cd "$SCRIPT_DIR"
if docker compose version >/dev/null 2>&1; then
    docker compose restart mediamtx
elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose restart mediamtx
else
    echo "⚠️  docker-compose not found. Please restart the mediamtx container using the command:"
    echo "   docker restart devicemap-mediamtx"
    exit 1
fi

echo ""
echo "=========================================="
echo "Done! MediaMTX has accepted the new host: $CLEAN_HOST"
echo "=========================================="
