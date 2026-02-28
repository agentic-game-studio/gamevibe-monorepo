FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable
RUN corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml .
COPY package.json .
COPY pnpm-lock.yaml .
COPY tsconfig.json .
COPY tsconfig.base.json .

# Copy shared package
COPY packages/shared/package.json packages/shared/
COPY packages/shared packages/shared/

# Copy multiplayer server package
COPY packages/multiplayer-server/package.json packages/multiplayer-server/
COPY packages/multiplayer-server packages/multiplayer-server/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @gamevibe/multiplayer-server...

# Build shared and multiplayer-server
RUN pnpm --filter @gamevibe/shared run build
RUN pnpm --filter @gamevibe/multiplayer-server run build

# Production stage
FROM node:20-alpine

RUN corepack enable
RUN corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy built files
COPY --from=base /app/packages/shared/dist packages/shared/dist
COPY --from=base /app/packages/shared/package.json packages/shared/
COPY --from=base /app/packages/multiplayer-server/dist packages/multiplayer-server/dist
COPY --from=base /app/packages/multiplayer-server/package.json packages/multiplayer-server/
COPY --from=base /app/package.json .
COPY --from=base /app/pnpm-workspace.yaml .
COPY --from=base /app/pnpm-lock.yaml .

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter @gamevibe/multiplayer-server... --prod

WORKDIR /app/packages/multiplayer-server

# Expose ports
EXPOSE 2567

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:2567/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Run the server
CMD ["node", "dist/index.js"]