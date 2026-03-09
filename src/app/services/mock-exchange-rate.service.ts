import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { ExchangeRate } from '../models/bot.model';
import { IExchangeRateService } from './exchange-rate.interface';

/**
 * Service Mock pour les taux de change
 * Utilisé en développement local pour éviter les problèmes de CORS/SSL
 */
@Injectable({
  providedIn: 'root',
})
export class MockExchangeRateService implements IExchangeRateService {
  // Données mockées basées sur les valeurs fournies
  private readonly MOCK_RATES: { symbol: string; price: number }[] = [
    // BTC/EUR = €58,138.33 -> BTC/USDT = 58138.33 * 1.0866 (EUR/USDT inverse)
    { symbol: 'BTCUSDT', price: 63173.5 },
    // ETH/EUR = €1,707.90 -> ETH/USDT
    { symbol: 'ETHUSDT', price: 1855.45 },
    // BNB/EUR = €540.24 -> BNB/USDT
    { symbol: 'BNBUSDT', price: 586.95 },
    // EUR/USDT = 1/1.0866 (inverse de USDC/EUR)
    { symbol: 'EURUSDT', price: 1.1529 },
    // Direct EUR pairs
    { symbol: 'BTCEUR', price: 58138.33 },
    { symbol: 'ETHEUR', price: 1707.9 },
  ];

  getExchangeRates(): Observable<Map<string, ExchangeRate>> {
    console.log('📊 [MockExchangeRateService] Returning mock exchange rates');

    const ratesMap = new Map<string, ExchangeRate>();

    this.MOCK_RATES.forEach((rate) => {
      const baseAsset = this.extractBaseAsset(rate.symbol);
      const quoteAsset = this.extractQuoteAsset(rate.symbol);

      ratesMap.set(rate.symbol, {
        symbol: rate.symbol,
        price: rate.price,
        baseAsset,
        quoteAsset,
      });
    });

    // Simuler un délai réseau de 300ms
    return of(ratesMap).pipe(delay(300));
  }

  private extractBaseAsset(symbol: string): string {
    const quoteAssets = ['EUR', 'USDC', 'USDT', 'BTC', 'ETH', 'BNB'];
    for (const quote of quoteAssets) {
      if (symbol.endsWith(quote)) {
        return symbol.slice(0, -quote.length);
      }
    }
    return symbol;
  }

  private extractQuoteAsset(symbol: string): string {
    const quoteAssets = ['EUR', 'USDC', 'USDT', 'BTC', 'ETH', 'BNB'];
    for (const quote of quoteAssets) {
      if (symbol.endsWith(quote)) {
        return quote;
      }
    }
    return '';
  }
}
