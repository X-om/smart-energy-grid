import { Router } from 'express';
import { validateSingleReading, validateBatchReadings } from '../middlewares/validationMiddleware.js';
import { checkSingleTelemetryDuplicate, checkBatchTelemetryDuplicate } from '../middlewares/dedupeMiddleware.js';
import { singleTelemetryReadingController, batchTelemetryReadingController } from '../controllers/telemetry/telemetryOperationalController.js';

const telemetryRouter: Router = Router();

telemetryRouter.post('/', validateSingleReading, checkSingleTelemetryDuplicate, singleTelemetryReadingController);
telemetryRouter.post('/batch', validateBatchReadings, checkBatchTelemetryDuplicate, batchTelemetryReadingController);

export { telemetryRouter };