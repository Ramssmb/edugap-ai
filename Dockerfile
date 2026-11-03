# syntax=docker/dockerfile:1

# ---- build: install everything, compile the server and bundle the client
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime: production dependencies + build output only
FROM node:26-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --workspace server && npm cache clean --force
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/drizzle server/drizzle
COPY --from=build /app/client/dist client/dist
# Writable location for the embedded database when DATABASE_URL is not set.
RUN mkdir -p server/.data && chown -R node:node server/.data
USER node
EXPOSE 8080
# Hosts like Render override PORT, so the health check follows it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1
CMD ["node", "server/dist/index.js"]
