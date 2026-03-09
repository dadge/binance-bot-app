import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BotDataService } from '../../services/bot-data.service';
import { BotParserService } from '../../services/bot-parser.service';
import { StorageService } from '../../services/storage.service';
import { ConfigService } from '../../services/config.service';
import {
  ParsedBot,
  ExchangeRate,
  BotProfitDisplay,
  ClosedBotsConfig,
} from '../../models/bot.model';
import { interval, Subscription } from 'rxjs';

// Types pour le tri
type SortColumn =
  | 'pair'
  | 'status'
  | 'gridProfitPercent'
  | 'gridProfitPercentDaily'
  | 'gridProfitEUR'
  | 'gridProfitUSDC'
  | 'totalProfit'
  | 'trades'
  | 'timeCreated';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private botDataService = inject(BotDataService);
  private botParserService = inject(BotParserService);
  private storageService = inject(StorageService);
  private configService = inject(ConfigService);
  private router = inject(Router);

  // Input data
  botDataText = signal('');
  // Closed bots config (stored in localStorage)
  closedBotsConfig = signal<ClosedBotsConfig>({
    totalGridProfitEUR: 0,
    totalGridProfitUSDC: 0,
  });

  // Track saved state for unsaved changes indicator
  private savedConfig = signal<ClosedBotsConfig>({
    totalGridProfitEUR: 0,
    totalGridProfitUSDC: 0,
  });
  private savedBotDataText = signal('');
  // State
  loading = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  exchangeRates = signal<Map<string, ExchangeRate>>(new Map());
  parsedBots = signal<ParsedBot[]>([]);

  // Computed values
  botsWithProfits = computed(() => {
    const rates = this.exchangeRates();
    return this.parsedBots().map((bot) => this.botDataService.calculateBotProfits(bot, rates));
  });

  summary = computed(() => {
    return this.botDataService.calculateSummary(this.botsWithProfits(), this.closedBotsConfig());
  });

  openBotsGridProfitEUR = computed(() => {
    return this.botsWithProfits().reduce((sum, b) => sum + b.gridProfitInEUR, 0);
  });

  openBotsGridProfitUSDC = computed(() => {
    return this.botsWithProfits().reduce((sum, b) => sum + b.gridProfitInUSDC, 0);
  });

  // Exchange rates display - calculate EUR values from USDT rates
  eurUsdtRate = computed(() => this.exchangeRates().get('EURUSDT')?.price || 1);

  btcEur = computed(() => {
    const btcUsdt = this.exchangeRates().get('BTCUSDT')?.price || 0;
    return btcUsdt / this.eurUsdtRate();
  });

  ethEur = computed(() => {
    const ethUsdt = this.exchangeRates().get('ETHUSDT')?.price || 0;
    return ethUsdt / this.eurUsdtRate();
  });

  bnbEur = computed(() => {
    const bnbUsdt = this.exchangeRates().get('BNBUSDT')?.price || 0;
    return bnbUsdt / this.eurUsdtRate();
  });

  usdtEur = computed(() => 1 / this.eurUsdtRate());

  // Computed: check if there are unsaved changes
  hasUnsavedChanges = computed(() => {
    const currentConfig = this.closedBotsConfig();
    const saved = this.savedConfig();
    const configChanged =
      currentConfig.totalGridProfitEUR !== saved.totalGridProfitEUR ||
      currentConfig.totalGridProfitUSDC !== saved.totalGridProfitUSDC;
    const textChanged = this.botDataText() !== this.savedBotDataText();
    return configChanged || textChanged;
  });

  // Sorting state
  sortColumn = signal<SortColumn>('gridProfitEUR');
  sortDirection = signal<SortDirection>('desc');

  // Computed: sorted bots
  sortedBotsWithProfits = computed(() => {
    const bots = [...this.botsWithProfits()];
    const column = this.sortColumn();
    const direction = this.sortDirection();

    bots.sort((a, b) => {
      let valueA: number | string;
      let valueB: number | string;

      switch (column) {
        case 'pair':
          valueA = a.bot.pair;
          valueB = b.bot.pair;
          break;
        case 'status':
          valueA = a.bot.status;
          valueB = b.bot.status;
          break;
        case 'gridProfitPercent':
          valueA = a.bot.gridProfitPercent;
          valueB = b.bot.gridProfitPercent;
          break;
        case 'gridProfitPercentDaily':
          valueA = this.calculateDailyPercent(a.bot);
          valueB = this.calculateDailyPercent(b.bot);
          break;
        case 'gridProfitEUR':
          valueA = a.gridProfitInEUR;
          valueB = b.gridProfitInEUR;
          break;
        case 'gridProfitUSDC':
          valueA = a.gridProfitInUSDC;
          valueB = b.gridProfitInUSDC;
          break;
        case 'totalProfit':
          valueA = a.bot.totalProfit;
          valueB = b.bot.totalProfit;
          break;
        case 'trades':
          valueA = a.bot.matchedTrades;
          valueB = b.bot.matchedTrades;
          break;
        case 'timeCreated':
          valueA = new Date(a.bot.timeCreated).getTime();
          valueB = new Date(b.bot.timeCreated).getTime();
          break;
        default:
          return 0;
      }

      // Comparaison
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        const comparison = valueA.localeCompare(valueB);
        return direction === 'asc' ? comparison : -comparison;
      } else {
        const comparison = (valueA as number) - (valueB as number);
        return direction === 'asc' ? comparison : -comparison;
      }
    });

    return bots;
  });

  private subscriptions: Subscription[] = [];
  private refreshInterval?: Subscription;

  ngOnInit(): void {
    // Load saved data from backend/localStorage
    this.loadSavedData();

    // Subscribe to data service
    this.subscriptions.push(
      this.botDataService.getExchangeRates().subscribe((rates) => this.exchangeRates.set(rates)),
      this.botDataService.isLoading().subscribe((loading) => this.loading.set(loading)),
      this.botDataService.getError().subscribe((error) => this.error.set(error)),
    );

    // Load exchange rates
    this.botDataService.loadExchangeRates();

    // Auto-refresh rates every 30 seconds
    this.refreshInterval = interval(30000).subscribe(() => {
      this.botDataService.loadExchangeRates();
    });
  }

  /**
   * Load saved data from backend (with localStorage fallback)
   */
  private async loadSavedData(): Promise<void> {
    try {
      // Load closed bots config
      const savedConfig = await this.storageService.getCurrentConfig();
      this.closedBotsConfig.set(savedConfig);
      this.savedConfig.set({ ...savedConfig });

      // Load saved bot data text
      const savedBotData = await this.storageService.getCurrentBotDataText();
      if (savedBotData) {
        this.botDataText.set(savedBotData);
        this.savedBotDataText.set(savedBotData);
        this.parseBotData();
      }
    } catch (e) {
      console.error('Error loading saved data:', e);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.refreshInterval?.unsubscribe();
  }

  parseBotData(): void {
    const text = this.botDataText();
    if (!text.trim()) {
      this.parsedBots.set([]);
      return;
    }
    try {
      const bots = this.botParserService.parseBotsFromText(text);
      this.parsedBots.set(bots);
      this.error.set(null);

      // Ne pas sauvegarder automatiquement - utiliser le bouton Sauvegarder
    } catch (e) {
      this.error.set('Erreur lors du parsing des données');
      console.error('Parse error:', e);
    }
  }
  updateClosedBotsConfig(): void {
    localStorage.setItem('closed_bots_config', JSON.stringify(this.closedBotsConfig()));
    this.savedConfig.set({ ...this.closedBotsConfig() });
  }

  updateClosedProfitEUR(value: number | string): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    // Si la valeur n'est pas un nombre valide, ne pas mettre à jour
    if (isNaN(numValue)) {
      return;
    }

    // Convert EUR to USDC using the rate
    const eurUsdtRate = this.eurUsdtRate();
    const usdcValue = numValue * eurUsdtRate; // EUR * (USDT/EUR) = USDT ≈ USDC

    this.closedBotsConfig.set({
      totalGridProfitEUR: numValue,
      totalGridProfitUSDC: Math.round(usdcValue * 100) / 100,
    });
    // Ne pas sauvegarder automatiquement
  }

  updateClosedProfitUSDC(value: number | string): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    // Si la valeur n'est pas un nombre valide, ne pas mettre à jour
    if (isNaN(numValue)) {
      return;
    }

    // Convert USDC to EUR using the rate
    const eurUsdtRate = this.eurUsdtRate();
    const eurValue = numValue / eurUsdtRate; // USDC / (USDT/EUR) = EUR

    this.closedBotsConfig.set({
      totalGridProfitEUR: Math.round(eurValue * 100) / 100,
      totalGridProfitUSDC: numValue,
    });
    // Ne pas sauvegarder automatiquement
  }
  saveAllData(): void {
    const config = this.closedBotsConfig();
    const text = this.botDataText();
    const summary = this.summary();

    // Ajouter une entrée à l'historique
    this.storageService.addEntry(
      config,
      text,
      this.parsedBots().length,
      summary.totalGridProfitEUR,
      summary.totalGridProfitUSDC,
    );

    // Mettre à jour l'état sauvegardé
    this.savedConfig.set({ ...config });
    this.savedBotDataText.set(text);

    // Afficher le message de succès
    this.successMessage.set('✅ Sauvegarde effectuée avec succès !');

    // Masquer le message après 3 secondes
    setTimeout(() => {
      this.successMessage.set(null);
    }, 3000);
  }

  goToHistory(): void {
    this.router.navigate(['/history']);
  }

  clearData(): void {
    this.botDataText.set('');
    this.parsedBots.set([]);
    localStorage.removeItem('bot_data_text');
  }

  refreshRates(): void {
    this.botDataService.loadExchangeRates();
  }

  formatCurrency(value: number, currency: string): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency === 'USDC' ? 'USD' : currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  formatPriceSmall(value: number): string {
    if (value < 0.0001) {
      return value.toFixed(8);
    } else if (value < 1) {
      return value.toFixed(6);
    }
    return this.formatPrice(value);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatPercent(value: number): string {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}%`;
  }

  getProfitClass(value: number): string {
    return value >= 0 ? 'positive' : 'negative';
  }

  // Calcule le nombre de jours depuis la création du bot
  calculateDaysActive(bot: ParsedBot): number {
    const now = new Date();
    const created = new Date(bot.timeCreated);
    const diffMs = now.getTime() - created.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return Math.max(diffDays, 1); // Minimum 1 jour pour éviter division par 0
  }

  // Calcule le % de grid profit moyen journalier
  calculateDailyPercent(bot: ParsedBot): number {
    const days = this.calculateDaysActive(bot);
    return bot.gridProfitPercent / days;
  }

  // Formate le % journalier pour l'affichage
  formatDailyPercent(bot: ParsedBot): string {
    const dailyPercent = this.calculateDailyPercent(bot);
    const prefix = dailyPercent >= 0 ? '+' : '';
    return `${prefix}${dailyPercent.toFixed(4)}%/j`;
  }

  // Méthode pour trier par colonne
  sortBy(column: SortColumn): void {
    if (this.sortColumn() === column) {
      // Si on clique sur la même colonne, inverser la direction
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      // Nouvelle colonne: tri descendant par défaut pour les nombres, ascendant pour le texte
      this.sortColumn.set(column);
      if (column === 'pair' || column === 'status') {
        this.sortDirection.set('asc');
      } else {
        this.sortDirection.set('desc');
      }
    }
  }

  // Méthode pour obtenir l'icône de tri
  getSortIcon(column: SortColumn): string {
    if (this.sortColumn() !== column) {
      return '⇅'; // Tri inactif
    }
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  // Vérifie si une colonne est triée
  isSorted(column: SortColumn): boolean {
    return this.sortColumn() === column;
  }

  // Vérifie si la protection par mot de passe est activée
  isPasswordProtected(): boolean {
    return this.configService.isPasswordProtected();
  }

  // Déconnexion
  logout(): void {
    this.configService.logout();
    this.router.navigate(['/login']);
  }
}
