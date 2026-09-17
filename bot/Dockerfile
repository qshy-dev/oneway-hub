FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY bot ./bot
USER node
CMD ["node", "bot/worker.mjs"]
