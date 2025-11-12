import { Router } from 'express';
import { validateSingleReading, validateBatchReadings } from '../middlewares/validationMiddleware';
import { checkSingleTelemetryDuplicate, checkBatchTelemetryDuplicate } from '../middlewares/dedupeMiddleware';
import { singleTelemetryReadingController, batchTelemetryReadingController } from '../controllers/telemetry/telemetryOperationalController';

const telemetryRouter: Router = Router();

telemetryRouter.post('/', validateSingleReading, checkSingleTelemetryDuplicate, singleTelemetryReadingController);
telemetryRouter.post('/batch', validateBatchReadings, checkBatchTelemetryDuplicate, batchTelemetryReadingController);

export { telemetryRouter };