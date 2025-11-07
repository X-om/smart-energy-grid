#!/bin/bash

# Smart Energy Grid System - Simulator Runner Script
# Starts the energy meter simulator with configurable parameters

set -e

echo "🔌 Starting Smart Energy Grid Simulator..."
echo ""

# Default values
NUM_METERS=${NUM_METERS:-100}
INTERVAL_MS=${INTERVAL_MS:-5000}
BATCH_SIZE=${BATCH_SIZE:-50}
INGESTION_URL=${INGESTION_URL:-http://localhost:3001}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --meters)
            NUM_METERS="$2"
            shift 2
            ;;
        --interval)
            INTERVAL_MS="$2"
            shift 2
            ;;
        --batch-size)
            BATCH_SIZE="$2"
            shift 2
            ;;
        --url)
            INGESTION_URL="$2"
            shift 2
            ;;
        --help)
            echo "Usage: ./run-simulator.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --meters NUM        Number of meters to simulate (default: 100)"
            echo "  --interval MS       Interval between readings in milliseconds (default: 5000)"
            echo "  --batch-size NUM    Batch size for sending readings (default: 50)"
            echo "  --url URL           Ingestion service URL (default: http://localhost:3001)"
            echo "  --help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./run-simulator.sh --meters 1000 --interval 10000"
            echo "  ./run-simulator.sh --meters 50 --batch-size 10 --url http://ingestion:3001"
            echo ""
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $1"
            echo "Run './run-simulator.sh --help' for usage information"
            exit 1
            ;;
    esac
done

echo "📊 Simulator Configuration:"
echo "   Meters:       $NUM_METERS"
echo "   Interval:     ${INTERVAL_MS}ms"
echo "   Batch Size:   $BATCH_SIZE"
echo "   Ingestion:    $INGESTION_URL"
echo ""

# Check if running in Docker Compose environment
if docker compose ps | grep -q "segs-ingestion"; then
    echo "🐳 Running in Docker Compose environment"
    echo ""
    
    # Start simulator with Docker Compose
    docker compose run \
        --rm \
        -e NUM_METERS="$NUM_METERS" \
        -e INTERVAL_MS="$INTERVAL_MS" \
        -e BATCH_SIZE="$BATCH_SIZE" \
        -e INGESTION_URL="http://ingestion:3001" \
        simulator
else
    echo "💻 Running locally (outside Docker)"
    echo ""
    
    # Check if ingestion service is reachable
    if ! curl -s "$INGESTION_URL/health" > /dev/null 2>&1; then
        echo "❌ Error: Ingestion service not reachable at $INGESTION_URL"
        echo "   Make sure the ingestion service is running"
        echo ""
        echo "   To start services: docker-compose up -d"
        echo "   Or run manually: cd apps/ingestion && pnpm dev"
        exit 1
    fi
    
    echo "✅ Ingestion service is reachable"
    echo ""
    
    # Run simulator locally
    cd apps/simulator
    NUM_METERS="$NUM_METERS" \
    INTERVAL_MS="$INTERVAL_MS" \
    BATCH_SIZE="$BATCH_SIZE" \
    INGESTION_URL="$INGESTION_URL" \
    pnpm start
fi

echo ""
echo "✅ Simulator finished!"
echo ""
echo "💡 Tips:"
echo "   - View Kafka topics: http://localhost:8080"
echo "   - Check ingestion metrics: $INGESTION_URL/metrics"
echo "   - Monitor Prometheus: http://localhost:9090"
echo "   - View Grafana dashboards: http://localhost:3006"
echo ""
