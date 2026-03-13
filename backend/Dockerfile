FROM node:18-alpine

RUN apk add --no-cache libc6-compat curl

WORKDIR /app/backend

COPY package.json ./

RUN npm install

COPY . .

RUN npm run build

# Dynamic port configuration
ARG PORT=5001
ENV PORT=${PORT}
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

CMD ["node", "dist/index.js"]