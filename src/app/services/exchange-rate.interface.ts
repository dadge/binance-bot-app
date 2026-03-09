import { Observable } from 'rxjs';
import { ExchangeRate } from '../models/bot.model';

/**
 * Interface commune pour les services de taux de change
 */
export interface IExchangeRateService {
  getExchangeRates(): Observable<Map<string, ExchangeRate>>;
}

/**
 * Token d'injection pour le service de taux de change
 */
import { InjectionToken } from '@angular/core';
export const EXCHANGE_RATE_SERVICE = new InjectionToken<IExchangeRateService>(
  'ExchangeRateService',
);
