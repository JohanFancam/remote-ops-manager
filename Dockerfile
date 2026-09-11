# Build the app
FROM node:22-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 needs build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime image
FROM node:22-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/data/remote-ops.db
ENV UPLOADS_DIR=/data/uploads

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/scripts ./scripts

RUN mkdir -p /data /data/uploads

EXPOSE 3001
CMD ["node", "server/index.js"]
