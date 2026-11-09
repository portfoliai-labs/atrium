# atrium's image for a self-hosted install (forum's deploy/): Next's standalone server. Built with
# no NEXT_PUBLIC_* by default, so the API and the authentication are the page's own origin
# (lib/origins) and one image serves every install; a build argument sets one when needed.
FROM node:24.11.1-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# Empty: the page's own origin (lib/origins).
ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SOLANA_CHAIN="solana:mainnet"
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24.11.1-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
