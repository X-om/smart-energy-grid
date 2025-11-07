#!/usr/bin/env node

/**
 * Integration test with mock HTTP server
 * Starts a simple HTTP server and runs the simulator against it
 */

import { createServer } from 'http';
import { spawn } from 'child_process';

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║      Telemetry Simulator - Integration Test                 ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

let receivedBatches = 0;
let totalReadings = 0;

// Create mock HTTP server
const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/telemetry/batch') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        receivedBatches++;
        totalReadings += data.readings?.length || 0;

        console.log(`📨 Batch ${receivedBatches}: Received ${data.readings?.length || 0} readings`);
        console.log(`   • Batch ID: ${data.batchId}`);
        console.log(`   • Timestamp: ${data.timestamp}`);
        console.log(`   • Total so far: ${totalReadings} readings\n`);

        // Send success response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          accepted: data.readings?.length || 0
        }));
      } catch (error) {
        console.error('❌ Error parsing request:', error.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Start server
server.listen(3001, () => {
  console.log('🌐 Mock HTTP server started on http://localhost:3001');
  console.log('📡 Endpoint: POST /telemetry/batch\n');
  console.log('Starting simulator in 2 seconds...\n');

  setTimeout(() => {
    // Start simulator process
    const simulator = spawn('node', ['dist/index.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        METERS: '50',
        INTERVAL: '3',
        ITERATIONS: '3',
        TARGET: 'http',
        INGESTION_URL: 'http://localhost:3001/telemetry/batch',
        LOG_LEVEL: 'info',
      },
      stdio: 'inherit',
    });

    simulator.on('close', (code) => {
      console.log('\n' + '═'.repeat(64));
      console.log('📊 INTEGRATION TEST SUMMARY');
      console.log('═'.repeat(64));
      console.log(`✅ Batches received: ${receivedBatches}`);
      console.log(`✅ Total readings: ${totalReadings}`);
      console.log(`✅ Simulator exit code: ${code}`);
      console.log('═'.repeat(64) + '\n');

      if (receivedBatches > 0 && code === 0) {
        console.log('🎉 Integration test PASSED!\n');
        server.close();
        process.exit(0);
      } else {
        console.log('❌ Integration test FAILED!\n');
        server.close();
        process.exit(1);
      }
    });

    simulator.on('error', (error) => {
      console.error('❌ Failed to start simulator:', error);
      server.close();
      process.exit(1);
    });
  }, 2000);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted by user');
  server.close();
  process.exit(0);
});
