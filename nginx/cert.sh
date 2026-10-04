#!/bin/sh
# Launched by the nginx image before nginx starts (/docker-entrypoint.d). nginx refuses to start with a
# certificate that doesn't exist yet, so the https server block is only switched on once certbot has one.
cert=/etc/letsencrypt/live/$DOMAIN/fullchain.pem
enable() { envsubst '$DOMAIN' < /etc/nginx/https.conf.template > /etc/nginx/conf.d/https.conf; }

if [ -e "$cert" ]; then
  enable
else
  (
    sleep 5 # nginx has to be up: it answers the challenge on port 80
    # 15 min between tries stays under Let's Encrypt's limit of 5 failures per hour
    until certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" -n --agree-tos --register-unsafely-without-email; do
      echo "cert.sh: no certificate for $DOMAIN yet. Does its DNS point at this server, with ports 80 and 443 open?"
      echo "cert.sh: trying again in 15 minutes (or now: docker compose restart nginx)"
      sleep 900
    done
    enable && nginx -s reload
  ) &
fi

# every 12 h; certbot only renews when the certificate is within 30 days of expiring
(while sleep 43200; do certbot renew -q --deploy-hook 'nginx -s reload'; done) &
