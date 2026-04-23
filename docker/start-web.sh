#!/bin/sh
set -e

echo "Preparando directorios runtime..."
mkdir -p \
  /var/www/html/storage/framework/cache \
  /var/www/html/storage/framework/sessions \
  /var/www/html/storage/framework/testing \
  /var/www/html/storage/framework/views \
  /var/www/html/storage/logs \
  /var/www/html/bootstrap/cache

echo "Corriendo migraciones..."
php artisan migrate --force

echo "Ejecutando seeders..."
php artisan db:seed --force 2>/dev/null || true

echo "Iniciando servidor..."
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8080}"
