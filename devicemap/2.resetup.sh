docker compose down
docker image prune -a -f
docker compose build --no-cache
docker compose up -d