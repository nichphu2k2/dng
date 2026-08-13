docker compose down
docker image prune -a -f
sudo rm -rf /megvii/*
sudo mkdir -p /megvii/mysql_data
sudo chown -R 999:999 /megvii/mysql_data
docker compose build --no-cache
docker compose up -d