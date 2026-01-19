FROM node:18-alpine

RUN apk add --no-cache libc6-compat

WORKDIR /app/backend

# Now that you moved the file, this line will work!
COPY package.json package-lock.json ./

RUN npm install

# Copy the rest of your backend code
COPY . .

RUN npm run build

EXPOSE 5000

CMD ["node", "dist/index.js"]