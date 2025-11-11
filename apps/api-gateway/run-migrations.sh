#!/bin/bash

set -e

echo "🚀 Running API Gateway migrations..."

# Use Docker exec instead of direct psql connection
CONTAINER_NAME="segs-postgres"
DB_USER="segs_user"
DB_NAME="segs_db"
MIGRATIONS_DIR="src/db/migrations"

# Check if Docker container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Error: PostgreSQL container '$CONTAINER_NAME' is not running"
    echo "Start it with: docker-compose up -d postgres"
    exit 1
fi

# Array of migration files in order (only new ones needed)
migrations=(
    "002_create_sessions.sql"
    "003_create_token_blacklist.sql"
    "004_create_user_preferences.sql"
    "005_create_payment_transactions.sql"
)

# Run each migration
for migration in "${migrations[@]}"; do
    if [ -f "$MIGRATIONS_DIR/$migration" ]; then
        echo "📝 Running migration: $migration"
        docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$MIGRATIONS_DIR/$migration"
        if [ $? -eq 0 ]; then
            echo "✅ Success: $migration"
        else
            echo "❌ Failed: $migration"
            exit 1
        fi
    else
        echo "⚠️  Skipping (not found): $migration"
    fi
done

echo ""
echo "✅ All migrations completed successfully!"
echo ""
echo "Current database tables:"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "\dt"
