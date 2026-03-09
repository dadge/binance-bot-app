// Parsed bot data from Binance copy/paste
export interface ParsedBot {
  pair: string; // e.g., "DUSK/BTC"
  baseAsset: string; // e.g., "DUSK"
  quoteAsset: string; // e.g., "BTC"
  timeCreated: Date;
  totalInvestment: number;
  totalProfit: number;
  totalProfitPercent: number;
  gridProfit: number;
  gridProfitPercent: number;
  floatingProfit: number;
  floatingProfitPercent: number;
  matchedTrades: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  status: string;
}

export interface ExchangeRate {
  symbol: string;
  price: number;
  baseAsset: string;
  quoteAsset: string;
}

export interface BotProfitDisplay {
  bot: ParsedBot;
  gridProfitInEUR: number;
  gridProfitInUSDC: number;
}

export interface ProfitSummary {
  totalGridProfitEUR: number;
  totalGridProfitUSDC: number;
  closedBotsGridProfitEUR: number;
  closedBotsGridProfitUSDC: number;
}

export interface ClosedBotsConfig {
  totalGridProfitEUR: number;
  totalGridProfitUSDC: number;
}

// Saved data entry for history
export interface SavedDataEntry {
  id: string;
  savedAt: Date;
  closedBotsConfig: ClosedBotsConfig | null;
  botDataText: string;
  parsedBotsCount: number;
  totalGridProfitEUR: number;
  totalGridProfitUSDC: number;
}
