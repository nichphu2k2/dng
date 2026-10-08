# Build context is the repository root (see docker-compose.yml).
# Stage 1: build frontend static assets
FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package.json ./
RUN npm install

COPY frontend/src ./src
COPY frontend/index.html ./
COPY frontend/vite.config.js ./
COPY frontend/.env.production ./

RUN npm run build

# Stage 2: single Nginx serving the frontend and proxying backend/MediaMTX
FROM nginx:stable-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
