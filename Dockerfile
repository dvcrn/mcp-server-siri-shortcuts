# syntax=docker/dockerfile:1
# check=experimental=all

FROM node:22-alpine@sha256:9bef0ef1e268f60627da9ba7d7605e8831d5b56ad07487d24d1aa386336d1944 AS node

FROM node AS builder
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/root/.npm npm install

FROM node AS release
WORKDIR /app
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json
ENV NODE_ENV=production
RUN npm ci --ignore-scripts --omit-dev
CMD ["node", "dist/index.js"]