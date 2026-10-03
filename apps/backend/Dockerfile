FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci --workspace @ghostdrop/backend --omit=dev --ignore-scripts \
    && npm cache clean --force

COPY apps/backend/src/ apps/backend/src/
COPY apps/backend/scripts/ apps/backend/scripts/
RUN mkdir -p /app/data && chown node:node /app/data

USER node
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/api/config', { signal: AbortSignal.timeout(3000) }).then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1));"
CMD ["node", "apps/backend/src/server.js"]
