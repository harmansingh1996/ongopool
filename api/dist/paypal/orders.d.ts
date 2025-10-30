import type { Router } from 'express';
import { PayPalClient } from './client';
import { PayPalService } from './service';
export declare function registerOrderRoutes(router: Router, client: PayPalClient, service: PayPalService): void;
