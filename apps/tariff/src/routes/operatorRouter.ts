import express, { Router, Request, Response } from 'express';
import { createOperatorController } from '../controllers/operatorController';
import { OverrideHandlerService } from '../services/overrideHandlerService';
import { TariffCalculatorService } from '../services/tariffCalculatorService';

export const operatorRouter: Router = express.Router();
let controllers: ReturnType<typeof createOperatorController> | null = null;

const getControllers = () => {
  if (!controllers) {
    const overrideHandler = OverrideHandlerService.getInstance();
    const calculator = TariffCalculatorService.getInstance();
    controllers = createOperatorController(overrideHandler, calculator);
  } return controllers;
};

operatorRouter.post('/tariff/override', (req: Request, res: Response) => getControllers().tariffOverrideController(req, res));
operatorRouter.get('/tariff/:region', (req: Request, res: Response) => getControllers().getCurrentTariffController(req, res));
operatorRouter.get('/tariff/:region/history', (req: Request, res: Response) => getControllers().getTariffHistoryController(req, res));
operatorRouter.get('/tariffs/all', (req: Request, res: Response) => getControllers().getAllTariffsController(req, res));
operatorRouter.delete('/tariff/override/:tariffId', (req: Request, res: Response) => getControllers().removeTariffOverrideController(req, res));