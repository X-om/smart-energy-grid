#!/bin/bash

# Smart Energy Grid System - Pipeline Monitor
# Real-time monitoring of data flow through the entire pipeline

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

clear

echo -e "${BOLD}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                                                               ║${NC}"
echo -e "${BOLD}║     📊  Smart Energy Grid - Pipeline Monitor                 ║${NC}"
echo -e "${BOLD}║                                                               ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to display a section
section() {
    echo -e "\n${BLUE}${BOLD}━━━ $1 ━━━${NC}\n"
}

# 1. Service Health
section "🏥 Service Health"
echo -e "${YELLOW}Checking all microservices...${NC}\n"

services=(
    "3000:API Gateway"
    "3001:Ingestion"
    "3002:Stream Processor"
    "3003:Notification"
    "3004:Alert"
    "3005:Tariff"
)

for service in "${services[@]}"; do
    port="${service%%:*}"
    name="${service##*:}"
    
    if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $name (Port: $port) - ${GREEN}HEALTHY${NC}"
    else
        echo -e "  ${RED}✗${NC} $name (Port: $port) - ${RED}DOWN${NC}"
    fi
done

# 2. Kafka Topics
section "📨 Kafka Message Count"
echo -e "${YELLOW}Checking Kafka topics...${NC}\n"

topics=("raw_readings" "aggregates_1m" "alerts" "alerts_processed" "tariff_updates")

for topic in "${topics[@]}"; do
    # Get partition count and latest offset
    result=$(docker exec segs-kafka kafka-run-class kafka.tools.GetOffsetShell \
        --broker-list localhost:9092 \
        --topic "$topic" 2>/dev/null | awk -F: '{sum+=$3} END {print sum}')
    
    if [ -z "$result" ]; then
        result=0
    fi
    
    if [ "$result" -gt 0 ]; then
        echo -e "  ${GREEN}✓${NC} $topic: ${GREEN}$result messages${NC}"
    else
        echo -e "  ${YELLOW}○${NC} $topic: ${YELLOW}$result messages${NC}"
    fi
done

# 3. Database Stats
section "💾 Database Statistics"

# PostgreSQL
echo -e "${YELLOW}PostgreSQL (Operational Data):${NC}\n"
docker exec -i segs-postgres psql -U segs_user -d segs_db << 'EOF' 2>/dev/null
SELECT 
    'Users' as table_name,
    COUNT(*) as records
FROM users
UNION ALL
SELECT 
    'Alerts' as table_name,
    COUNT(*) as records
FROM alerts
UNION ALL
SELECT 
    'Tariffs' as table_name,
    COUNT(*) as records
FROM tariffs
ORDER BY table_name;
EOF

# TimescaleDB
echo -e "\n${YELLOW}TimescaleDB (Time-Series Data):${NC}\n"
docker exec -i segs-timescaledb psql -U segs_user -d segs_db << 'EOF' 2>/dev/null
SELECT 
    'raw_readings' as table_name,
    COUNT(*) as records,
    COUNT(DISTINCT meter_id) as unique_meters,
    TO_CHAR(MAX(timestamp), 'HH24:MI:SS') as latest_time
FROM raw_readings
WHERE timestamp > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
    'aggregates_1m' as table_name,
    COUNT(*) as records,
    COUNT(DISTINCT meter_id) as unique_meters,
    TO_CHAR(MAX(time), 'HH24:MI:SS') as latest_time
FROM aggregates_1m
WHERE time > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
    'aggregates_15m' as table_name,
    COUNT(*) as records,
    COUNT(DISTINCT meter_id) as unique_meters,
    TO_CHAR(MAX(time), 'HH24:MI:SS') as latest_time
FROM aggregates_15m
WHERE time > NOW() - INTERVAL '1 hour'
ORDER BY table_name;
EOF

# 4. Recent Activity
section "📈 Recent Activity (Last 10 seconds)"

echo -e "${YELLOW}Latest ingestion logs:${NC}"
tail -5 /tmp/segs-logs/ingestion.log | grep -E "(Batch processing|accepted|duplicates)" | tail -3

echo -e "\n${YELLOW}Latest stream processor logs:${NC}"
tail -10 /tmp/segs-logs/stream-processor.log | grep -E "(Published|Processed|alert)" | tail -3

# 5. Quick Stats
section "📊 Quick Statistics"

echo -e "${YELLOW}Last minute overview:${NC}\n"

# Count messages in last minute from Kafka
recent_msgs=$(docker exec segs-kafka kafka-console-consumer \
    --bootstrap-server localhost:9092 \
    --topic raw_readings \
    --from-beginning \
    --max-messages 100 \
    --timeout-ms 2000 2>/dev/null | wc -l || echo "0")

echo -e "  Messages in Kafka: ${GREEN}$recent_msgs${NC}"

# Check if simulator is running
if ps aux | grep -E "simulator.*index.js" | grep -v grep > /dev/null; then
    echo -e "  Simulator Status: ${GREEN}RUNNING${NC}"
else
    echo -e "  Simulator Status: ${YELLOW}STOPPED${NC}"
fi

echo ""
echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}💡 Monitoring Commands:${NC}"
echo ""
echo -e "  ${GREEN}tail -f /tmp/segs-logs/ingestion.log${NC}     # Watch ingestion"
echo -e "  ${GREEN}tail -f /tmp/segs-logs/stream-processor.log${NC}  # Watch processing"
echo -e "  ${GREEN}tail -f /tmp/segs-logs/alert.log${NC}        # Watch alerts"
echo ""
echo -e "  ${GREEN}./scripts/monitor-pipeline.sh${NC}           # Run this script again"
echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
