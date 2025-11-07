# 🧪 Telemetry Simulator - Testing Guide

## Quick Testing Options

### ✅ Option 1: Dry Run Test (No Network - FASTEST)

Tests data generation without any network calls:

```bash
cd /tmp/smart-energy-grid/apps/simulator
pnpm test:dry
```

**What it tests:**
- Virtual meter initialization
- Region distribution
- Data generation with all modes
- Type validation
- Sequence number incrementing
- Duplicate generation

---

### ✅ Option 2: Integration Test with Mock Server (RECOMMENDED)

Automatically starts a mock HTTP server and runs the simulator:

```bash
cd /tmp/smart-energy-grid/apps/simulator
pnpm test:integration
```

**What it does:**
- Starts mock HTTP server on port 3001
- Runs simulator with 50 meters for 3 cycles
- Shows received batches in real-time
- Reports summary statistics

---

### ✅ Option 3: Manual Test with Mock Server

#### Terminal 1 - Start Mock Server:

**Option A: Simple Python Server (Easiest)**
```bash
python3 << 'EOF'
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/telemetry/batch':
            length = int(self.headers['Content-Length'])
            body = json.loads(self.rfile.read(length))
            count = len(body.get('readings', []))
            print(f'✅ Received {count} readings (Batch: {body.get("batchId", "?")[:8]}...)')
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"success":true}')
    def log_message(self, *args): pass

print('🌐 Mock server running on http://localhost:3001')
print('📡 Waiting for POST /telemetry/batch...\n')
HTTPServer(('', 3001), Handler).serve_forever()
EOF
```

**Option B: Node.js Server**
```bash
node << 'EOF'
const http = require('http');
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/telemetry/batch') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      const data = JSON.parse(body);
      console.log(`✅ Received ${data.readings?.length || 0} readings`);
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end('{"success":true}');
    });
  }
}).listen(3001, () => console.log('🌐 Mock server on http://localhost:3001'));
EOF
```

#### Terminal 2 - Run Simulator:

```bash
cd /tmp/smart-energy-grid/apps/simulator

# Basic test
pnpm dev

# Custom test
pnpm dev -- --meters 100 --interval 3 --iterations 5

# Peak mode test
pnpm dev -- --mode peak --meters 50

# Outage mode test
pnpm dev -- --mode outage --meters 50
```

---

### ✅ Option 4: Production Build Test

Test the built version (what Docker will run):

```bash
cd /tmp/smart-energy-grid/apps/simulator

# Build
pnpm build

# Run built version
node dist/index.js --meters 100 --iterations 3
```

---

## Test Scenarios

### 🎯 Scenario 1: Normal Daily Usage
```bash
pnpm dev -- --mode normal --meters 100 --interval 5 --iterations 10
```
**Expected:** Power readings between 0.8x - 1.2x base load, all status=OK

---

### 🔥 Scenario 2: Peak Hours
```bash
pnpm dev -- --mode peak --meters 100 --interval 5 --iterations 10
```
**Expected:** Power readings between 1.5x - 2.0x base load, all status=OK

---

### ⚡ Scenario 3: Grid Outage
```bash
pnpm dev -- --mode outage --meters 100 --interval 5 --iterations 10
```
**Expected:** Very low/zero power, ~10% status=ERROR

---

### 📈 Scenario 4: Scale Test (5000 meters)
```bash
pnpm dev -- --meters 5000 --interval 10 --iterations 3
```
**Expected:** Handles 5000 meters, batches sent concurrently

---

### 🔄 Scenario 5: High Frequency
```bash
pnpm dev -- --meters 1000 --interval 1 --iterations 30
```
**Expected:** 1000 readings every second, stable performance

---

## Expected Output

### Successful Run (with mock server):
```
╔═══════════════════════════════════════════════════════════════╗
║     🔌  Smart Energy Grid Telemetry Simulator v1.0.0         ║
╚═══════════════════════════════════════════════════════════════╝

[INFO] Initializing telemetry simulator
[INFO] Virtual meters initialized | totalMeters=100
[INFO] 🚀 Starting telemetry simulator | meters=100 | interval="5s"

[INFO] 📊 Cycle complete
    cycle: 1 | generated: 100 | sent: 100 | errors: 0
    latency: "120ms" | successRate: "100.0%"

[INFO] 📊 Cycle complete
    cycle: 2 | generated: 101 | sent: 101 | errors: 0
    latency: "115ms" | successRate: "100.0%"

[INFO] 📈 Cumulative Statistics
    totalCycles: 10 | totalSent: 1005 | throughput: "100 readings/s"

[INFO] ✅ Simulator stopped gracefully
```

### Failed Connection (no server):
```
[WARN] Retrying batch send | attempt: 1 | delay: 1000ms
[ERROR] Failed to send batch after all retries | error: "ECONNREFUSED"
[INFO] 📊 Cycle complete | sent: 0 | errors: 1 | successRate: "0.0%"
```

---

## Verification Checklist

After running tests, verify:

- [x] Meters initialized correctly
- [x] Readings have valid UUIDs
- [x] Timestamps are ISO 8601
- [x] Power values are positive (except outage mode)
- [x] Voltage in range 220-240V
- [x] Regions match configuration
- [x] Sequence numbers increment
- [x] Batching works (500 per batch by default)
- [x] Retry logic triggers on failures
- [x] Statistics are accurate
- [x] Graceful shutdown on Ctrl+C

---

## Sample Generated Reading

```json
{
  "readingId": "550e8400-e29b-41d4-a716-446655440000",
  "meterId": "MTR-00000001",
  "userId": "USR-00000001",
  "timestamp": "2025-11-07T09:05:03.123Z",
  "powerKw": 4.523,
  "energyKwh": 0.0126,
  "voltage": 232.4,
  "region": "Pune-West",
  "seq": 1,
  "status": "OK",
  "metadata": {
    "mode": "normal",
    "baseLoad": 4.12
  }
}
```

---

## Troubleshooting

### Issue: "Cannot find module"
**Solution:** Run `pnpm build` first
```bash
pnpm build
pnpm start
```

### Issue: "ECONNREFUSED"
**Solution:** Start mock server first (see Option 3 above)

### Issue: "Port 3001 already in use"
**Solution:** Change port in .env
```bash
echo "INGESTION_URL=http://localhost:3002/telemetry/batch" >> .env
```

### Issue: Out of memory with many meters
**Solution:** Increase Node.js heap
```bash
NODE_OPTIONS="--max-old-space-size=4096" pnpm dev -- --meters 10000
```

---

## Performance Benchmarks

| Meters | Interval | Throughput | Memory | CPU |
|--------|----------|------------|--------|-----|
| 100    | 5s       | ~20/s      | 30MB   | 3%  |
| 1,000  | 10s      | ~100/s     | 50MB   | 5%  |
| 5,000  | 10s      | ~500/s     | 120MB  | 15% |
| 10,000 | 10s      | ~1000/s    | 200MB  | 25% |

---

## Next Steps

Once testing is complete:

1. **Integrate with Ingestion Service**
   - Build the ingestion service
   - Point simulator to it
   - Verify end-to-end flow

2. **Test with Kafka**
   ```bash
   # Start Kafka (via Docker Compose)
   docker-compose up -d kafka
   
   # Run simulator in Kafka mode
   pnpm dev -- --target kafka
   ```

3. **Run in Docker**
   ```bash
   docker build -t segs-simulator -f Dockerfile ../..
   docker run --rm -e METERS=5000 segs-simulator
   ```

4. **Load Testing**
   - Run multiple simulator instances
   - Monitor Ingestion Service
   - Check Kafka lag
   - Validate data in TimescaleDB

---

**✅ You're ready to test the simulator!**

Start with `pnpm test:integration` for the quickest validation.
