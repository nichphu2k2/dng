#!/bin/bash
set -e
# Kiểm tra Docker
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
    su - ${USER}
else
    echo "Docker has been installed."
fi

# Kiểm tra Docker Compose (Compose V2)
if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose is not installed. Start installation..."

    sudo apt install docker-compose -y

else
    echo "Docker Compose has been installed."
fi


sudo mkdir -p /megvii/mysql_data
sudo chown -R 999:999 /megvii/mysql_data
docker image prune -a -f
docker compose up -d --build
