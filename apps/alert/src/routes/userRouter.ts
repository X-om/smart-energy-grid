import express, { Router, Request, Response } from 'express';
import { createUserController } from '../controllers/userController';
import { AlertManagerService } from '../services/alertManagerService';

export const userRouter: Router = express.Router();
let controllers: ReturnType<typeof createUserController> | null = null;

const getControllers = () => {
  if (!controllers) {
    const alertManager = AlertManagerService.getInstance();
    controllers = createUserController(alertManager);
  }
  return controllers;
};

userRouter.get('/alerts', (req: Request, res: Response) => getControllers().getUserAlertsController(req, res));
userRouter.get('/alerts/:id', (req: Request, res: Response) => getControllers().getUserAlertByIdController(req, res));
