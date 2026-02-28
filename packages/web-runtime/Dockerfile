# Build stage
FROM node:20-alpine AS builder

# Accept build arguments
ARG VITE_API_BASE_URL=http://localhost:3000
ARG VITE_DISCORD_CLIENT_ID
ARG VITE_MULTIPLAYER_URL=ws://localhost:2567

# Set environment variables from build args
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_DISCORD_CLIENT_ID=$VITE_DISCORD_CLIENT_ID
ENV VITE_MULTIPLAYER_URL=$VITE_MULTIPLAYER_URL

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy root package.json and pnpm workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json tsconfig.base.json ./

# Copy shared package
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src/

# Copy web-runtime package
COPY packages/web-runtime/package.json packages/web-runtime/
COPY packages/web-runtime/tsconfig.json packages/web-runtime/
COPY packages/web-runtime/vite.config.ts packages/web-runtime/
COPY packages/web-runtime/index.html packages/web-runtime/
COPY packages/web-runtime/public packages/web-runtime/public/
COPY packages/web-runtime/src packages/web-runtime/src/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared package
RUN pnpm --filter @gamevibe/shared build

# Build web-runtime
RUN pnpm --filter @gamevibe/web-runtime build

# Production stage
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/packages/web-runtime/dist /usr/share/nginx/html

# Copy nginx configuration
COPY packages/web-runtime/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]