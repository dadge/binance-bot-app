import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { SavedDataEntry } from '../../models/bot.model';

type ChartCurrency = 'EUR' | 'USDC';
type ChartPeriod = '7d' | '1m' | '3m';

interface ChartDataPoint {
  date: Date;
  value: number;
  label: string;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryComponent {
  private storageService = inject(StorageService);
  private router = inject(Router);

  // Expose Math for template
  Math = Math;

  // Historique des sauvegardes
  history = this.storageService.history;

  // État pour confirmation de suppression
  deleteConfirmId = signal<string | null>(null);

  // État pour les entrées étendues
  expandedEntries = signal<Set<string>>(new Set());

  // Chart settings
  chartCurrency = signal<ChartCurrency>('EUR');
  chartPeriod = signal<ChartPeriod>('1m');

  // Stats calculées
  totalEntries = computed(() => this.history().length);

  totalProfitEUR = computed(() => {
    const entries = this.history();
    if (entries.length === 0) return 0;
    // Prendre la dernière entrée (la plus récente)
    return entries[0].totalGridProfitEUR;
  });

  totalProfitUSDC = computed(() => {
    const entries = this.history();
    if (entries.length === 0) return 0;
    return entries[0].totalGridProfitUSDC;
  });

  // Chart data computed
  chartData = computed<ChartDataPoint[]>(() => {
    const entries = this.history();
    const currency = this.chartCurrency();
    const period = this.chartPeriod();
    
    if (entries.length === 0) return [];

    // Calculate the cutoff date based on period
    const now = new Date();
    let cutoffDate: Date;
    switch (period) {
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1m':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3m':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
    }

    // Filter and map entries
    const filteredEntries = entries
      .filter(e => new Date(e.savedAt) >= cutoffDate)
      .map(e => ({
        date: new Date(e.savedAt),
        value: currency === 'EUR' ? e.totalGridProfitEUR : e.totalGridProfitUSDC,
        label: this.formatShortDate(new Date(e.savedAt))
      }))
      .reverse(); // Oldest first for chart

    return filteredEntries;
  });

  // Chart min/max for scaling
  chartMinValue = computed(() => {
    const data = this.chartData();
    if (data.length === 0) return 0;
    return Math.min(...data.map(d => d.value)) * 0.95;
  });

  chartMaxValue = computed(() => {
    const data = this.chartData();
    if (data.length === 0) return 100;
    return Math.max(...data.map(d => d.value)) * 1.05;
  });

  isExpanded(id: string): boolean {
    return this.expandedEntries().has(id);
  }

  toggleExpand(id: string): void {
    const current = new Set(this.expandedEntries());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.expandedEntries.set(current);
  }

  setChartCurrency(currency: ChartCurrency): void {
    this.chartCurrency.set(currency);
  }

  setChartPeriod(period: ChartPeriod): void {
    this.chartPeriod.set(period);
  }

  formatShortDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
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

  formatCurrency(value: number, currency: string): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency === 'USDC' ? 'USD' : currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  // Get Y position for chart point (percentage from bottom)
  getChartY(value: number): number {
    const min = this.chartMinValue();
    const max = this.chartMaxValue();
    const range = max - min;
    if (range === 0) return 50;
    return ((value - min) / range) * 100;
  }

  // Generate SVG path for the chart line
  getChartPath(): string {
    const data = this.chartData();
    if (data.length < 2) return '';

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - this.getChartY(d.value);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  }

  // Generate SVG area path for gradient fill
  getChartAreaPath(): string {
    const data = this.chartData();
    if (data.length < 2) return '';

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - this.getChartY(d.value);
      return `${x},${y}`;
    });

    return `M 0,100 L ${points.join(' L ')} L 100,100 Z`;
  }

  confirmDelete(id: string): void {
    this.deleteConfirmId.set(id);
  }

  cancelDelete(): void {
    this.deleteConfirmId.set(null);
  }

  deleteEntry(id: string): void {
    this.storageService.deleteEntry(id).then(() => {
      this.deleteConfirmId.set(null);
    });
  }

  restoreEntry(entry: SavedDataEntry): void {
    this.storageService.restoreEntry(entry).then(() => {
      this.router.navigate(['/']);
    });
  }

  clearAllHistory(): void {
    if (confirm("Êtes-vous sûr de vouloir supprimer tout l'historique ?")) {
      this.storageService.clearHistory();
    }
  }

  goToDashboard(): void {
    this.router.navigate(['/']);
  }

  getPreviewText(text: string): string {
    if (!text) return 'Aucune donnée';
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length <= 3) return text;
    return lines.slice(0, 3).join('\n') + '\n...';
  }
}
