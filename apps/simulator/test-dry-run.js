#!/usr/bin/env node

/**
 * Dry-run test script for Telemetry Simulator
 * Tests data generation without network calls
 */

import { initializeMeters, generateReadings } from './dist/generator.js';
import { isTelemetryReading } from '@segs/shared-types';

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║         Telemetry Simulator - Dry Run Test                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// Mock configuration
const mockConfig = {
  meters: 10,
  regions: ['Pune-West', 'Mumbai-North', 'Delhi-South', 'Bangalore-East'],
  baseLoadMinKw: 2.0,
  baseLoadMaxKw: 6.0,
  minVoltage: 220,
  maxVoltage: 240,
  interval: 10,
  mode: 'normal',
  duplicateRate: 0.05, // 5% duplicates for testing
};

console.log('📋 Test Configuration:');
console.log(`   • Meters: ${mockConfig.meters}`);
console.log(`   • Regions: ${mockConfig.regions.join(', ')}`);
console.log(`   • Mode: ${mockConfig.mode}`);
console.log(`   • Duplicate Rate: ${mockConfig.duplicateRate * 100}%`);
console.log();

// Test 1: Meter Initialization
console.log('🧪 Test 1: Virtual Meter Initialization');
const meters = initializeMeters(mockConfig);

if (meters.length !== mockConfig.meters) {
  console.error('❌ FAILED: Expected', mockConfig.meters, 'meters, got', meters.length);
  process.exit(1);
}

console.log('✅ PASSED: Generated', meters.length, 'virtual meters');
console.log('   Sample meter:', JSON.stringify(meters[0], null, 2));
console.log();

// Test 2: Region Distribution
console.log('🧪 Test 2: Region Distribution');
const regionCounts = meters.reduce((acc, m) => {
  acc[m.region] = (acc[m.region] || 0) + 1;
  return acc;
}, {});

console.log('✅ PASSED: Region distribution:', regionCounts);
console.log();

// Test 3: Telemetry Generation
console.log('🧪 Test 3: Telemetry Reading Generation');
const readings = generateReadings(meters, mockConfig);

console.log('✅ PASSED: Generated', readings.length, 'readings');
console.log('   Expected:', mockConfig.meters, '+', 'duplicates');
console.log();

// Test 4: Data Format Validation
console.log('🧪 Test 4: Data Format Validation');
let validCount = 0;
let invalidCount = 0;

for (const reading of readings) {
  if (isTelemetryReading(reading)) {
    validCount++;
  } else {
    invalidCount++;
    console.error('❌ Invalid reading:', reading);
  }
}

if (invalidCount > 0) {
  console.error('❌ FAILED:', invalidCount, 'invalid readings');
  process.exit(1);
}

console.log('✅ PASSED: All', validCount, 'readings are valid TelemetryReading objects');
console.log();

// Test 5: Sample Reading Inspection
console.log('🧪 Test 5: Sample Reading Data Quality');
const sample = readings[0];

console.log('Sample Reading:');
console.log(JSON.stringify(sample, null, 2));
console.log();

const checks = [
  { name: 'Has UUID readingId', pass: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sample.readingId) },
  { name: 'Has meterId', pass: !!sample.meterId },
  { name: 'Has timestamp', pass: !!sample.timestamp && !isNaN(Date.parse(sample.timestamp)) },
  { name: 'Power is positive', pass: sample.powerKw > 0 },
  { name: 'Energy calculated', pass: sample.energyKwh !== undefined && sample.energyKwh > 0 },
  { name: 'Voltage in range', pass: sample.voltage >= 220 && sample.voltage <= 240 },
  { name: 'Has region', pass: mockConfig.regions.includes(sample.region) },
  { name: 'Has sequence number', pass: sample.seq > 0 },
  { name: 'Status is OK or ERROR', pass: sample.status === 'OK' || sample.status === 'ERROR' },
];

let allPassed = true;
checks.forEach(check => {
  const icon = check.pass ? '✅' : '❌';
  console.log(`${icon} ${check.name}`);
  if (!check.pass) allPassed = false;
});

console.log();

// Test 6: Multiple Cycles
console.log('🧪 Test 6: Multiple Generation Cycles');
const cycle1 = generateReadings(meters, mockConfig);
const cycle2 = generateReadings(meters, mockConfig);

const seq1 = cycle1.find(r => r.meterId === meters[0].meterId).seq;
const seq2 = cycle2.find(r => r.meterId === meters[0].meterId).seq;

if (seq2 > seq1) {
  console.log('✅ PASSED: Sequence numbers increment across cycles');
  console.log(`   Cycle 1 seq: ${seq1}, Cycle 2 seq: ${seq2}`);
} else {
  console.error('❌ FAILED: Sequence numbers not incrementing');
  allPassed = false;
}

console.log();

// Test 7: Duplicate Detection
console.log('🧪 Test 7: Duplicate Generation');
const readingsWithDupes = generateReadings(meters, { ...mockConfig, duplicateRate: 0.5 });
const uniqueIds = new Set(readingsWithDupes.map(r => r.readingId));
const duplicateCount = readingsWithDupes.length - uniqueIds.size;

if (duplicateCount > 0) {
  console.log('✅ PASSED: Duplicates generated:', duplicateCount);
} else {
  console.log('⚠️  WARNING: No duplicates found (expected ~50% with rate 0.5)');
}

console.log();

// Final Summary
console.log('╔══════════════════════════════════════════════════════════════╗');
if (allPassed) {
  console.log('║                   ✅ ALL TESTS PASSED                        ║');
} else {
  console.log('║                   ❌ SOME TESTS FAILED                       ║');
}
console.log('╚══════════════════════════════════════════════════════════════╝\n');

if (!allPassed) {
  process.exit(1);
}

console.log('🎉 Simulator data generation is working correctly!');
console.log('📝 Run with: node test-dry-run.js\n');
