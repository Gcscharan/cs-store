FROM node:18-alpine

RUN apk add --no-cache libc6-compat

WORKDIR /app/backend

COPY package.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 10000

CMD ["node", "dist/index.js"]