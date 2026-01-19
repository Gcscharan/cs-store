FROM node:18-alpine

RUN apk add --no-cache libc6-compat

WORKDIR /app/backend

# Use ./ to represent the current directory where the Dockerfile lives
COPY package.json package-lock.json ./

RUN npm install

# Copy everything from the current directory (the backend folder)
COPY . .

RUN npm run build

# Ensure the port matches Render's expectations
EXPOSE 5000

CMD ["node", "dist/index.js"]