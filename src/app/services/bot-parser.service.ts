import { Injectable } from '@angular/core';
import { ParsedBot } from '../models/bot.model';

@Injectable({
  providedIn: 'root',
})
export class BotParserService {
  /**
   * Parse the text copied from Binance Grid Bot page
   * More flexible parser that handles different formats
   */
  parseBotsFromText(text: string): ParsedBot[] {
    console.log('=== Starting parsing ===');
    console.log('Raw text:', text);

    // Split by lines and filter empty
    const lines = text
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);
    console.log('All lines:', lines);

    const bots: ParsedBot[] = [];
    let currentBot: Partial<ParsedBot> | null = null;
    let amountFields: number[] = [];
    let percentFields: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      console.log(`Line ${i}: "${line}"`);

      // Skip common header/menu items
      if (this.isHeaderLine(line)) {
        console.log('  -> Skipping header line');
        continue;
      }

      // Check for trading pair pattern (e.g., "DUSK/BTC", "BTC/USDC", "ETH/USDT")
      const pairMatch = line.match(/^([A-Z0-9]+)\/([A-Z0-9]+)$/);
      if (pairMatch) {
        console.log('  -> Found pair:', line);
        // Save previous bot if we have collected enough data
        if (currentBot && currentBot.pair && amountFields.length >= 1) {
          console.log('  -> Saving previous bot:', currentBot);
          bots.push(this.finalizeBot(currentBot, amountFields, percentFields));
        }
        // Start new bot
        currentBot = {
          pair: line,
          baseAsset: pairMatch[1],
          quoteAsset: pairMatch[2],
        };
        amountFields = [];
        percentFields = [];
        continue;
      }

      if (!currentBot) {
        continue;
      }

      // Date pattern: 2024-03-03 13:30:29 or 2024/03/03 13:30:29
      const dateMatch = line.match(/^(\d{4}[-\/]\d{2}[-\/]\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
      if (dateMatch) {
        console.log('  -> Found date:', line);
        currentBot.timeCreated = new Date(line.replace(/\//g, '-'));
        continue;
      }

      // Just a date (without time)
      if (/^\d{4}[-\/]\d{2}[-\/]\d{2}$/.test(line)) {
        console.log('  -> Found date only:', line);
        currentBot.timeCreated = new Date(line.replace(/\//g, '-'));
        continue;
      }

      // Percent pattern: +1.33% or -0.5% or 1.33%
      const percentMatch = line.match(/^([+-]?\d+\.?\d*)%$/);
      if (percentMatch) {
        const value = parseFloat(percentMatch[1]);
        console.log(`  -> Found percent: ${value}%`);
        percentFields.push(value);
        continue;
      }

      // Matched trades: standalone integer (typically after percent values)
      // Must check BEFORE amount pattern since amount pattern would also match integers
      if (/^\d{1,6}$/.test(line) && !line.includes('.')) {
        const num = parseInt(line, 10);
        // If it's a reasonable number for matched trades and we have context
        // (already seen percent or several amounts)
        if (num > 0 && num < 1000000 && (percentFields.length >= 1 || amountFields.length >= 2)) {
          console.log('  -> Found matched trades:', num);
          currentBot.matchedTrades = num;
          continue;
        }
      }

      // Amount pattern: 0.07549589 BTC or +0.00100460 BTC or just 0.07549589
      // Must have a decimal point OR a currency suffix to distinguish from trade counts
      const amountMatch = line.match(/^([+-]?\d+\.?\d*)\s*([A-Z]{2,})?$/);
      if (amountMatch && !this.isStatusLine(line)) {
        const valueStr = amountMatch[1];
        const suffix = amountMatch[2];
        const value = parseFloat(valueStr);
        // Only treat as amount if it has a decimal OR a currency suffix OR is a very large number
        const hasDecimal = valueStr.includes('.');
        const hasSuffix = !!suffix && suffix.length >= 2;
        const isLargeNumber = value >= 1000000;

        if (!isNaN(value) && (hasDecimal || hasSuffix || isLargeNumber)) {
          console.log(`  -> Found amount: ${value} (decimal: ${hasDecimal}, suffix: ${hasSuffix})`);
          amountFields.push(value);
          continue;
        }
      }

      // Price range: 0.00000090 - 0.00000160 or 100.00 - 200.00
      const rangeMatch = line.match(/^(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)$/);
      if (rangeMatch) {
        console.log('  -> Found price range:', line);
        currentBot.priceRangeLow = parseFloat(rangeMatch[1]);
        currentBot.priceRangeHigh = parseFloat(rangeMatch[2]);
        continue;
      }

      // Status: Working, Stopped, etc
      if (this.isStatusLine(line)) {
        console.log('  -> Found status:', line);
        currentBot.status = line;
        continue;
      }

      console.log('  -> Line not matched');
    }

    // Save last bot
    if (currentBot && currentBot.pair && amountFields.length >= 1) {
      console.log('Saving last bot:', currentBot);
      bots.push(this.finalizeBot(currentBot, amountFields, percentFields));
    }

    console.log('=== Parsing complete ===');
    console.log('Parsed bots:', bots);
    return bots;
  }

  private isHeaderLine(line: string): boolean {
    const headers = [
      'Pair',
      'Time Created',
      'Total Investment',
      'Total Profit',
      'Grid Profit',
      'Floating Profit',
      'Matched Trades',
      'Price Range',
      'Grid Status',
      'Action',
      'Parameters',
      'Running',
      'All',
      'History',
      'Spot Grid',
      'Futures Grid',
      'Strategy',
    ];
    return headers.some((h) => line.toLowerCase() === h.toLowerCase());
  }

  private isStatusLine(line: string): boolean {
    const statuses = ['Working', 'Stopped', 'Terminated', 'Cancelled', 'Running'];
    return statuses.some((s) => line.toLowerCase() === s.toLowerCase());
  }

  private finalizeBot(
    partial: Partial<ParsedBot>,
    amounts: number[],
    percents: number[],
  ): ParsedBot {
    console.log('Finalizing bot with amounts:', amounts, 'percents:', percents);

    // Expected order: totalInvestment, totalProfit, gridProfit, floatingProfit
    // But we may have less values, so assign what we have

    return {
      pair: partial.pair || '',
      baseAsset: partial.baseAsset || '',
      quoteAsset: partial.quoteAsset || '',
      timeCreated: partial.timeCreated || new Date(),
      totalInvestment: amounts[0] || 0,
      totalProfit: amounts[1] || 0,
      gridProfit: amounts[2] || 0,
      floatingProfit: amounts[3] || 0,
      totalProfitPercent: percents[0] || 0,
      gridProfitPercent: percents[1] || 0,
      floatingProfitPercent: percents[2] || 0,
      matchedTrades: partial.matchedTrades || 0,
      priceRangeLow: partial.priceRangeLow || 0,
      priceRangeHigh: partial.priceRangeHigh || 0,
      status: partial.status || 'Working',
    };
  }
}
