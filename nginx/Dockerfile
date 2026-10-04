FROM nginx:stable-alpine
RUN apk add --no-cache certbot && mkdir -p /var/www/certbot
COPY http.conf /etc/nginx/conf.d/default.conf
COPY https.conf.template /etc/nginx/
COPY cert.sh /docker-entrypoint.d/
# git on Windows drops the executable bit, and the image skips scripts without it
RUN chmod +x /docker-entrypoint.d/cert.sh
