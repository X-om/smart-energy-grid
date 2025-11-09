import express, { Router } from 'express';
import { createOperatorController } from '../controllers/operatorController.js';
import { OverrideHandlerService } from '../services/overrideHandlerService.js';
import { TariffCalculatorService } from '../services/tariffCalculatorService.js';

export const operatorRouter: Router = express.Router();

const overrideHandler = OverrideHandlerService.getInstance();
const calculator = TariffCalculatorService.getInstance();
const { tariffOverrideController, getCurrentTariffController, getTariffHistoryController, getAllTariffsController } = createOperatorController(overrideHandler, calculator);

operatorRouter.post('/tariff/override', tariffOverrideController);
operatorRouter.get('/tariff/:region', getCurrentTariffController);
operatorRouter.get('/tariff/:region/history', getTariffHistoryController);
operatorRouter.get('/tariffs/all', getAllTariffsController);
