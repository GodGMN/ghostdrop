FROM nginx:stable-alpine

COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/frontend/public/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
