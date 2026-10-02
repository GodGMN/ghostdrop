FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/app/data

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force

COPY src/ ./src/
COPY public/ ./public/
COPY scripts/hash-password.js ./scripts/hash-password.js
RUN mkdir -p /app/data && chown node:node /app/data

USER node
VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/api/config', { signal: AbortSignal.timeout(3000) }).then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "src/server.js"]
