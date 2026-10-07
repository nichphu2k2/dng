#!/usr/bin/env bash
set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

CONTAINER_NAME="webnote"
IMAGE_NAME="webnote"
PORT=8080
DATA_DIR="${APP_DIR}/data"

mkdir -p "${DATA_DIR}/images"

if [ "$(docker ps -aq -f name=^/${CONTAINER_NAME}$)" ]; then
    docker stop "${CONTAINER_NAME}" 2>/dev/null || true
    docker rm "${CONTAINER_NAME}" 2>/dev/null || true
fi

docker build -t "${IMAGE_NAME}" .

docker run -d \
  --name "${CONTAINER_NAME}" \
  -p "${PORT}:80" \
  -v "${DATA_DIR}:/data" \
  --restart unless-stopped \
  "${IMAGE_NAME}"
