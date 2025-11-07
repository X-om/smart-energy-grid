#!/bin/bash

# Create Kafka Topics for SEGS
# Usage: ./scripts/create-topics.sh

echo "🔧 Creating Kafka topics for Smart Energy Grid System..."

KAFKA_CONTAINER="segs-kafka"
TOPICS=(
  "energy-readings"
  "meter-events"
  "processed-data"
  "tariff-calculations"
  "alerts"
  "notifications"
)

for TOPIC in "${TOPICS[@]}"; do
  echo "Creating topic: $TOPIC"
  docker exec $KAFKA_CONTAINER kafka-topics \
    --create \
    --if-not-exists \
    --topic $TOPIC \
    --bootstrap-server localhost:9092 \
    --partitions 3 \
    --replication-factor 1
done

echo "✅ All Kafka topics created successfully!"
