import type { Router } from 'express';
import { PayPalClient } from './client';
import { PayPalService } from './service';
export declare function registerAuthorizationRoutes(router: Router, client: PayPalClient, service: PayPalService): void;
