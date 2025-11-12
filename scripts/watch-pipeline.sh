#!/bin/bash

# Real-time Pipeline Watcher
# Shows live updates from the data pipeline

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${BOLD}${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║  📊 LIVE Pipeline Monitor - Press Ctrl+C to stop         ║${NC}"
echo -e "${BOLD}${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${YELLOW}Watching logs in real-time...${NC}\n"

# Function to colorize and format logs
tail -f /tmp/segs-logs/ingestion.log \
    /tmp/segs-logs/stream-processor.log \
    /tmp/segs-logs/alert.log 2>/dev/null | \
    grep --line-buffered -E "(Batch processing|Published alert|accepted|duplicates|severity|meterId)" | \
    while IFS= read -r line; do
        timestamp=$(date '+%H:%M:%S')
        
        if echo "$line" | grep -q "ingestion.log"; then
            echo -e "${GREEN}[$timestamp] 📥 INGESTION${NC} → $line"
        elif echo "$line" | grep -q "stream-processor.log"; then
            echo -e "${BLUE}[$timestamp] ⚙️  PROCESSOR${NC} → $line"
        elif echo "$line" | grep -q "alert.log"; then
            echo -e "${YELLOW}[$timestamp] 🚨 ALERT${NC} → $line"
        else
            echo -e "[$timestamp] $line"
        fi
    done
