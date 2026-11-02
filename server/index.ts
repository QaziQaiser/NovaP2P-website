import express from 'express';
import { apiRouter } from './api.ts';

export const apiApp = express();
apiApp.use(express.json());
apiApp.use('/swap', apiRouter);

export default apiApp;
