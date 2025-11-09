#!/bin/bash

set -e

echo "🚀 Running API Gateway migrations..."

POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-segs_user}
POSTGRES_DB=${POSTGRES_DB:-segs_db}

export PGPASSWORD=${POSTGRES_PASSWORD:-segs_password}

echo "📝 Running migration: 001_create_users.sql"
psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -f src/db/migrations/001_create_users.sql

echo "✅ Migrations completed successfully!"
