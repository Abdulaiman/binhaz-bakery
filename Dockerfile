FROM node:20-alpine AS builder

WORKDIR /app

# No native build tools needed — bcryptjs is pure JavaScript

# 1. Build Backend
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
COPY server/prisma ./prisma
# Install all deps (including prisma devDep needed for generate)
RUN npm install
RUN npx prisma generate
# Remove devDependencies after generate
RUN npm prune --omit=dev

# 2. Build Frontend
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npm run build

# 3. Production Image
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

# Copy backend with production deps only
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/package.json ./server/
COPY server/src ./server/src
COPY server/prisma ./server/prisma

# Copy frontend build
COPY --from=builder /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

WORKDIR /app/server
CMD ["sh", "-c", "npx prisma db push && node prisma/seed.js && node src/index.js"]
