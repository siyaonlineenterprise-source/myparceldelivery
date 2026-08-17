FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    bash \
    curl \
    coreutils \
    util-linux \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci

COPY . .
RUN chmod +x scripts/*.sh
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

EXPOSE 8080

CMD ["sh", "-c", "npm start -- --port ${PORT:-8080} --hostname 0.0.0.0"]
