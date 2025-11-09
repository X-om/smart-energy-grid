#!/bin/bash

# Run database migrations for API Gateway

set -e

echo "🚀 Running API Gateway database migrations..."

# Get PostgreSQL connection details from environment or use defaults
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-segs_user}
POSTGRES_DB=${POSTGRES_DB:-segs_db}

# Export password for psql
export PGPASSWORD=${POSTGRES_PASSWORD:-segs_password}

# Run migration
echo "📝 Creating users table and related tables..."
psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -f src/db/migrations/001_create_users_table.sql

echo "✅ Migration completed successfully!"
