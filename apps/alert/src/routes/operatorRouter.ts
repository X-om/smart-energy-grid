import express, { Router } from 'express';
import { createOperatorController } from '../controllers/operatorController.js';
import { AlertManagerService } from '../services/alertManagerService.js';

export const operatorRouter: Router = express.Router();

const alertManager = AlertManagerService.getInstance();
const {
  getAlertsController,
  getActiveAlertsController,
  getAlertHistoryController,
  getAlertByIdController,
  acknowledgeAlertController,
  resolveAlertController,
  bulkResolveAlertsController,
  getAlertStatsController,
  autoResolveOldAlertsController
} = createOperatorController(alertManager);

operatorRouter.get('/alerts', getAlertsController);
operatorRouter.get('/alerts/active', getActiveAlertsController);
operatorRouter.get('/alerts/history/:region', getAlertHistoryController);
operatorRouter.get('/alerts/:id', getAlertByIdController);
operatorRouter.post('/alerts/:id/acknowledge', acknowledgeAlertController);
operatorRouter.post('/alerts/:id/resolve', resolveAlertController);
operatorRouter.post('/alerts/bulk-resolve', bulkResolveAlertsController);
operatorRouter.get('/alerts/stats', getAlertStatsController);
operatorRouter.post('/alerts/auto-resolve', autoResolveOldAlertsController);
