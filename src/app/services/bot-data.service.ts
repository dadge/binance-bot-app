import { Injectable, Inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  ParsedBot,
  ExchangeRate,
  BotProfitDisplay,
  ProfitSummary,
  ClosedBotsConfig,
} from '../models/bot.model';
import { EXCHANGE_RATE_SERVICE, IExchangeRateService } from './exchange-rate.interface';

@Injectable({
  providedIn: 'root',
})
export class BotDataService {
  private exchangeRates$ = new BehaviorSubject<Map<string, ExchangeRate>>(new Map());
  private loading$ = new BehaviorSubject<boolean>(false);
  private error$ = new BehaviorSubject<string | null>(null);

  constructor(@Inject(EXCHANGE_RATE_SERVICE) private exchangeRateService: IExchangeRateService) {}

  getExchangeRates(): Observable<Map<string, ExchangeRate>> {
    return this.exchangeRates$.asObservable();
  }

  getCurrentRates(): Map<string, ExchangeRate> {
    return this.exchangeRates$.getValue();
  }

  isLoading(): Observable<boolean> {
    return this.loading$.asObservable();
  }

  getError(): Observable<string | null> {
    return this.error$.asObservable();
  }

  loadExchangeRates(): void {
    this.loading$.next(true);
    this.exchangeRateService.getExchangeRates().subscribe({
      next: (rates: Map<string, ExchangeRate>) => {
        this.exchangeRates$.next(rates);
        this.loading$.next(false);
      },
      error: (err: Error) => {
        this.error$.next('Erreur lors du chargement des taux: ' + err.message);
        this.loading$.next(false);
      },
    });
  }

  convertToEUR(amount: number, fromAsset: string, rates: Map<string, ExchangeRate>): number {
    if (fromAsset === 'EUR') {
      return amount;
    }

    // Try direct EUR pair
    const directSymbol = `${fromAsset}EUR`;
    if (rates.has(directSymbol)) {
      return amount * rates.get(directSymbol)!.price;
    }

    // Fallback via USDT: asset -> USDT -> EUR
    const toUsdtSymbol = `${fromAsset}USDT`;
    const eurUsdtRate = rates.get('EURUSDT');
    if (rates.has(toUsdtSymbol) && eurUsdtRate) {
      const amountInUsdt = amount * rates.get(toUsdtSymbol)!.price;
      // EURUSDT = how many USDT per EUR, so EUR = USDT / EURUSDT
      return amountInUsdt / eurUsdtRate.price;
    }

    // If fromAsset is USDT or USDC
    if ((fromAsset === 'USDT' || fromAsset === 'USDC') && eurUsdtRate) {
      return amount / eurUsdtRate.price;
    }

    console.warn(`Cannot convert ${fromAsset} to EUR`);
    return 0;
  }

  convertToUSDC(amount: number, fromAsset: string, rates: Map<string, ExchangeRate>): number {
    if (fromAsset === 'USDC' || fromAsset === 'USDT') {
      // USDC ≈ USDT (stablecoins)
      return amount;
    }

    // Try direct USDT pair (USDC ≈ USDT)
    const toUsdtSymbol = `${fromAsset}USDT`;
    if (rates.has(toUsdtSymbol)) {
      return amount * rates.get(toUsdtSymbol)!.price;
    }

    // Fallback via EUR
    const toEurSymbol = `${fromAsset}EUR`;
    const eurUsdtRate = rates.get('EURUSDT');
    if (rates.has(toEurSymbol) && eurUsdtRate) {
      const amountInEur = amount * rates.get(toEurSymbol)!.price;
      return amountInEur * eurUsdtRate.price; // EUR * EURUSDT = USDT ≈ USDC
    }

    console.warn(`Cannot convert ${fromAsset} to USDC`);
    return 0;
  }

  calculateBotProfits(bot: ParsedBot, rates: Map<string, ExchangeRate>): BotProfitDisplay {
    const quoteAsset = bot.quoteAsset;
    const gridProfit = bot.gridProfit;

    return {
      bot,
      gridProfitInEUR: this.convertToEUR(gridProfit, quoteAsset, rates),
      gridProfitInUSDC: this.convertToUSDC(gridProfit, quoteAsset, rates),
    };
  }

  calculateSummary(
    openBots: BotProfitDisplay[],
    closedBotsConfig: ClosedBotsConfig,
  ): ProfitSummary {
    const openBotsGridProfitEUR = openBots.reduce((sum, b) => sum + b.gridProfitInEUR, 0);
    const openBotsGridProfitUSDC = openBots.reduce((sum, b) => sum + b.gridProfitInUSDC, 0);

    return {
      totalGridProfitEUR: openBotsGridProfitEUR + closedBotsConfig.totalGridProfitEUR,
      totalGridProfitUSDC: openBotsGridProfitUSDC + closedBotsConfig.totalGridProfitUSDC,
      closedBotsGridProfitEUR: closedBotsConfig.totalGridProfitEUR,
      closedBotsGridProfitUSDC: closedBotsConfig.totalGridProfitUSDC,
    };
  }
}
