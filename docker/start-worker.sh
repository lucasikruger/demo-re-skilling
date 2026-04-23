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

echo "Esperando que la DB esté disponible..."
until php artisan about >/dev/null 2>&1; do
  echo "DB no disponible aún, reintentando en 2s..."
  sleep 2
done

echo "Iniciando queue worker..."
exec php artisan queue:work database --sleep=1 --tries=1 --timeout=0
