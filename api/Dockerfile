FROM node:18-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# 1. Copy the ROOT package.json and the API's package.json
COPY package*.json ./
COPY api/package*.json ./api/

# 2. Install dependencies for the API
WORKDIR /app/api
RUN npm install --production

# 3. Go back to root and copy the shared folders our API needs!
WORKDIR /app
COPY prisma ./prisma
COPY agents ./agents
COPY ecommerce-app ./ecommerce-app

# Install ecommerce dependencies (so pg and supertest are available for tests)
WORKDIR /app/ecommerce-app
RUN npm install

# 4. Copy the actual API source code
WORKDIR /app
COPY api ./api

# 5. Generate Prisma Client inside the container so the API can talk to the DB
RUN npx prisma generate

WORKDIR /app/api
EXPOSE 3001
CMD ["npm", "start"]