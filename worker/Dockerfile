FROM node:22-slim
WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY worker/package.json ./worker/

RUN pnpm install --frozen-lockfile

COPY lib/ ./lib/
COPY worker/ ./worker/

ENV NODE_ENV=production
CMD ["node", "--loader", "tsx/esm", "worker/src/index.ts"]
