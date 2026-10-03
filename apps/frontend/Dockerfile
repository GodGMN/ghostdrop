FROM nginx:stable-alpine

ENV BACKEND_URL=http://ghostdrop-backend:3000 \
    NGINX_ENVSUBST_FILTER=^BACKEND_URL$

COPY apps/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY apps/frontend/public/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
