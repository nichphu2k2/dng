FROM node:20-alpine

WORKDIR /app

COPY package.json ./

RUN npm install --production

COPY src ./src
COPY default_camera.jpg ./default_camera.jpg


# Install dependencies and build mbpoll
RUN apk add --no-cache \
    git \
    cmake \
    make \
    gcc \
    g++ \
    musl-dev \
    linux-headers \
    libmodbus-dev \
    && git clone https://github.com/epsilonrt/mbpoll.git /tmp/mbpoll \
    && cd /tmp/mbpoll \
    && mkdir build \
    && cd build \
    && cmake .. \
    && make \
    && cp ./bin/mbpoll /usr/local/bin/mbpoll \
    && cd / \
    && rm -rf /tmp/mbpoll \
    && apk del \
        git \
        cmake \
        make \
        gcc \
        g++ \
        musl-dev \
        linux-headers


# Verify mbpoll exists
RUN mbpoll -h


EXPOSE 3000

CMD ["node", "src/server.js"]