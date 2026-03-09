import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { ExchangeRate } from '../models/bot.model';
import { IExchangeRateService } from './exchange-rate.interface';

/**
 * Service réel pour les taux de change Binance
 * Appelle le backend Node.js qui lui-même appelle l'API Binance
 * Cela permet au serveur d'avoir accès à Binance même si le client n'y a pas accès
 */
@Injectable({
  providedIn: 'root',
})
export class BinanceService implements IExchangeRateService {
  private http = inject(HttpClient);
  // Backend API endpoint - uses relative path for Home Assistant ingress compatibility
  private readonly apiUrl = 'api/rates';

  getExchangeRates(): Observable<Map<string, ExchangeRate>> {
    return this.http.get<ExchangeRate[]>(this.apiUrl).pipe(
      map((rates) => {
        const ratesMap = new Map<string, ExchangeRate>();
        rates.forEach((rate) => {
          ratesMap.set(rate.symbol, rate);
        });
        return ratesMap;
      }),
      catchError((error) => {
        console.error('Error fetching exchange rates from backend:', error);
        return of(new Map<string, ExchangeRate>());
      }),
    );
  }
}
