#!/bin/bash

# Run Energy Grid Simulator
# Usage: ./scripts/run-simulator.sh

echo "🔌 Starting Smart Energy Grid Simulator..."

cd apps/simulator

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install
fi

echo "Running simulator in development mode..."
pnpm dev
