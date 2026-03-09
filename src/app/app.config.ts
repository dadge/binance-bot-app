import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { EXCHANGE_RATE_SERVICE } from './services/exchange-rate.interface';
import { BinanceService } from './services/binance.service';
import { MockExchangeRateService } from './services/mock-exchange-rate.service';
import { ConfigService } from './services/config.service';
import { provideServiceWorker } from '@angular/service-worker';

/**
 * Factory pour déterminer quel service de taux de change utiliser
 * selon le mode configuré (mock ou live)
 */
function exchangeRateServiceFactory(
  configService: ConfigService,
  binanceService: BinanceService,
  mockService: MockExchangeRateService,
) {
  const mode = configService.getMode();
  console.log(`🔄 [AppConfig] Using ${mode} exchange rate service`);

  if (mode === 'mock') {
    return mockService;
  }
  return binanceService;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // Provider dynamique pour le service de taux de change
    {
      provide: EXCHANGE_RATE_SERVICE,
      useFactory: exchangeRateServiceFactory,
      deps: [ConfigService, BinanceService, MockExchangeRateService],
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
