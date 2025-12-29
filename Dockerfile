FROM node:18-alpine

WORKDIR /app

COPY package*.json ./


RUN apk add --no-cache python3 make g++
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

ARG GIT_COMMIT
ENV GIT_COMMIT=${GIT_COMMIT}

EXPOSE 3000

CMD ["node", "index.js"]
