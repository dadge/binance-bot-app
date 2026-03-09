import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { SavedDataEntry } from '../../models/bot.model';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent {
  private storageService = inject(StorageService);
  private router = inject(Router);

  // Historique des sauvegardes
  history = this.storageService.history;

  // État pour confirmation de suppression
  deleteConfirmId = signal<string | null>(null);

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
