FROM node:20-alpine AS builder

WORKDIR /app

COPY packages/shared-types/ ./packages/shared-types/
COPY frontend/ ./frontend/

RUN npm install --no-audit --no-fund --loglevel=error --prefix /app/packages/shared-types \
    && npm install --no-audit --no-fund --loglevel=error --prefix /app/frontend

ARG VITE_API_URL=/api
ARG VITE_APP_TITLE=KMS
ARG VITE_APP_LOGO=/logos/PHEnlinea.svg

ENV VITE_API_URL=${VITE_API_URL} \
    VITE_APP_TITLE=${VITE_APP_TITLE} \
    VITE_APP_LOGO=${VITE_APP_LOGO}

RUN npm run build --prefix /app/frontend

FROM nginx:1.27-alpine AS runtime

COPY infra/docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/frontend/dist /usr/share/nginx/html

RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
