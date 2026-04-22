#!/bin/sh
set -e

echo "Corriendo migraciones..."
php artisan migrate --force

echo "Ejecutando seeders..."
php artisan db:seed --force 2>/dev/null || true

echo "Iniciando servidor..."
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8080}"
