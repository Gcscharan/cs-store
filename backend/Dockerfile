FROM node:18-alpine

RUN apk add --no-cache libc6-compat

WORKDIR /app/backend

# Copy backend dependency files FIRST
COPY backend/package.json backend/package-lock.json ./

RUN npm install

# Copy the rest of backend source
COPY backend ./

RUN npm run build

EXPOSE 5000

CMD ["node", "dist/index.js"]