import express from 'express';
import { apiRouter } from './api.ts';
import { affiliateRouter } from './affiliateApi.ts';

export const apiApp = express();
apiApp.use(express.json());
apiApp.use('/swap', apiRouter);
apiApp.use('/affiliate', affiliateRouter);

export default apiApp;
