import express, { Router, Request, Response } from 'express';
import { createOperatorController } from '../controllers/operatorController';
import { AlertManagerService } from '../services/alertManagerService';

export const operatorRouter: Router = express.Router();
let controllers: ReturnType<typeof createOperatorController> | null = null;

const getControllers = () => {
  if (!controllers) {
    const alertManager = AlertManagerService.getInstance();
    controllers = createOperatorController(alertManager);
  }
  return controllers;
};

operatorRouter.get('/alerts', (req: Request, res: Response) => getControllers().getAlertsController(req, res));
operatorRouter.get('/alerts/active', (req: Request, res: Response) => getControllers().getActiveAlertsController(req, res));
operatorRouter.get('/alerts/stats', (req: Request, res: Response) => getControllers().getAlertStatsController(req, res));
operatorRouter.get('/alerts/history/:region', (req: Request, res: Response) => getControllers().getAlertHistoryController(req, res));
operatorRouter.get('/alerts/:id', (req: Request, res: Response) => getControllers().getAlertByIdController(req, res));
operatorRouter.post('/alerts/bulk-resolve', (req: Request, res: Response) => getControllers().bulkResolveAlertsController(req, res));
operatorRouter.post('/alerts/auto-resolve', (req: Request, res: Response) => getControllers().autoResolveOldAlertsController(req, res));
operatorRouter.post('/alerts/:id/acknowledge', (req: Request, res: Response) => getControllers().acknowledgeAlertController(req, res));
operatorRouter.post('/alerts/:id/resolve', (req: Request, res: Response) => getControllers().resolveAlertController(req, res));
