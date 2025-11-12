import { initialize, startProcessing, startServer, shutdown } from './lifecycle/processLifecycle';
import { createLogger } from './utils/logger';
import { Config } from './config/env';

const logger = createLogger('main');

const main = async (): Promise<void> => {
  try {
    console.log(`
