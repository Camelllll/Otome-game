FROM node:24-bookworm-slim AS studio-assets
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/vite.config.js ./
COPY backend/resources ./resources
COPY backend/app ./app
RUN npm run build

FROM dunglas/frankenphp:php8.4-trixie AS game-assets
WORKDIR /game
COPY index.html style.css carnet.css ./
COPY src ./src
COPY styles ./styles
COPY assets ./assets
COPY scripts/build-game.php scripts/public-game.php ./scripts/
RUN php scripts/build-game.php /out

FROM dunglas/frankenphp:php8.4-trixie
WORKDIR /app
RUN install-php-extensions pdo_mysql zip
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY backend/ ./
RUN mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs storage/app/studio-media bootstrap/cache \
    && COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --no-interaction --optimize-autoloader
COPY --from=studio-assets /app/public/build ./public/build
COPY --from=game-assets /out ./public
COPY deploy/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
CMD ["sh", "-c", "php artisan migrate --force && exec frankenphp run --config /etc/caddy/Caddyfile --adapter caddyfile"]
