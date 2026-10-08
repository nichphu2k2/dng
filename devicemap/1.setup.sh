#!/bin/bash
set -e

# Project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
MEDIAMTX_FILE="$SCRIPT_DIR/mediamtx/mediamtx.yml"

# Check Docker
if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is not installed. Start installation..."

    sudo apt update
    sudo apt upgrade -y
    sudo apt install net-tools -y
    sudo timedatectl set-timezone Asia/Ho_Chi_Minh
    sudo apt install vim -y
    echo 'export HISTTIMEFORMAT="%F %T "' | sudo tee -a /etc/bash.bashrc
    sudo apt install apt-transport-https ca-certificates curl software-properties-common -y
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
    sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable"
    apt-cache policy docker-ce
    sudo apt install docker-ce -y
    sudo systemctl restart docker
    sudo systemctl enable docker

    sudo usermod -aG docker ${USER}
    echo "Docker group has been updated."
    echo "Please restart and run this script again."
    exit 0
else
    echo "Docker has been installed."
fi

# Check Docker Compose (Compose V2)
if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose is not installed. Start installation..."
    sudo apt install docker-compose -y
else
    echo "Docker Compose has been installed."
fi

echo ""
echo "=========================================="
echo "      CONFIG AND DEPLOY PARAMETERS        "
echo "=========================================="

# 1. Config Web/Nginx Port
CURRENT_PORT="80"
if [ -f "$ENV_FILE" ]; then
    SAVED_PORT=$(grep -E '^APP_PORT=' "$ENV_FILE" | cut -d '=' -f2 | tr -d '[:space:]')
    [ -n "$SAVED_PORT" ] && CURRENT_PORT="$SAVED_PORT"
fi

read -rp "Enter port for Web/Nginx (Default: $CURRENT_PORT): " INPUT_PORT
CHOSEN_PORT="${INPUT_PORT:-$CURRENT_PORT}"
CHOSEN_PORT=$(echo "$CHOSEN_PORT" | tr -cd '0-9')
[ -z "$CHOSEN_PORT" ] && CHOSEN_PORT="80"
echo "-> Web Portal: $CHOSEN_PORT"

# Fill in .env
if [ -f "$ENV_FILE" ] && grep -q '^APP_PORT=' "$ENV_FILE"; then
    sed -i "s/^APP_PORT=.*/APP_PORT=$CHOSEN_PORT/" "$ENV_FILE"
else
    echo "APP_PORT=$CHOSEN_PORT" >> "$ENV_FILE"
fi

# 2. Config WebRTC MediaMTX Host
CURRENT_WEBRTC="cam.thangnd.fun"
if [ -f "$MEDIAMTX_FILE" ]; then
    SAVED_WEBRTC=$(awk '/^webrtcAdditionalHosts:/{flag=1; next} flag && /^[[:space:]]*- /{print $2; exit} !/^[[:space:]]*- /{flag=0}' "$MEDIAMTX_FILE")
    [ -n "$SAVED_WEBRTC" ] && CURRENT_WEBRTC="$SAVED_WEBRTC"
fi

echo ""
read -rp "Input IP/Domain for WebRTC MediaMTX (Default: $CURRENT_WEBRTC): " INPUT_WEBRTC
CLEAN_WEBRTC=$(echo "$INPUT_WEBRTC" | sed -e 's|^https*://||' -e 's|/.*||' -e 's|:.*||' | tr -d '[:space:]')
CHOSEN_WEBRTC="${CLEAN_WEBRTC:-$CURRENT_WEBRTC}"
echo "-> WebRTC Host: $CHOSEN_WEBRTC"

if [ -f "$MEDIAMTX_FILE" ]; then
    TMP_FILE=$(mktemp)
    awk -v new_host="$CHOSEN_WEBRTC" '
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
    ' "$MEDIAMTX_FILE" > "$TMP_FILE"
    mv "$TMP_FILE" "$MEDIAMTX_FILE"
fi

echo ""
echo "=========================================="
echo "    BEGIN START CONTAINERS                "
echo "=========================================="
cd "$SCRIPT_DIR"
docker compose down
docker compose up -d --build

echo ""
echo "=========================================="
echo " Deploy successful!"
echo "   - Web portal: $CHOSEN_PORT"
echo "   - WebRTC Host: $CHOSEN_WEBRTC"
echo "=========================================="
