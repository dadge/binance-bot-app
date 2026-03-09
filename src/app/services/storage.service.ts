import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SavedDataEntry, ClosedBotsConfig } from '../models/bot.model';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  // Backend API base - uses relative path for Home Assistant ingress compatibility
  private readonly API_BASE = 'api';

  // Fallback keys for localStorage (used if backend is unavailable)
  private readonly HISTORY_KEY = 'bot_data_history';
  private readonly CURRENT_CONFIG_KEY = 'closed_bots_config';
  private readonly CURRENT_BOT_DATA_KEY = 'bot_data_text';

  // Signal pour l'historique
  history = signal<SavedDataEntry[]>([]);

  // Track if backend is available
  private backendAvailable = true;

  constructor(private http: HttpClient) {
    this.loadHistory();
  }

  /**
   * Load history from backend, fallback to localStorage
   */
  async loadHistory(): Promise<void> {
    try {
      const entries = await firstValueFrom(
        this.http.get<SavedDataEntry[]>(`${this.API_BASE}/history`),
      );
      // Convert date strings to Date objects
      entries.forEach((e) => (e.savedAt = new Date(e.savedAt)));
      this.history.set(entries);
      this.backendAvailable = true;
      console.log('📊 [StorageService] Loaded history from backend:', entries.length, 'entries');
    } catch (error) {
      console.warn('⚠️ [StorageService] Backend unavailable, using localStorage fallback');
      this.backendAvailable = false;
      this.loadHistoryFromLocalStorage();
    }
  }

  private loadHistoryFromLocalStorage(): void {
    const data = localStorage.getItem(this.HISTORY_KEY);
    if (data) {
      try {
        const entries = JSON.parse(data) as SavedDataEntry[];
        entries.forEach((e) => (e.savedAt = new Date(e.savedAt)));
        this.history.set(entries);
      } catch (e) {
        console.error('Error loading history from localStorage:', e);
        this.history.set([]);
      }
    }
  }

  private saveHistoryToLocalStorage(): void {
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.history()));
  }

  /**
   * Ajouter une nouvelle entrée à l'historique
   */
  async addEntry(
    closedBotsConfig: ClosedBotsConfig,
    botDataText: string,
    parsedBotsCount: number,
    totalGridProfitEUR: number,
    totalGridProfitUSDC: number,
  ): Promise<SavedDataEntry> {
    const entry: SavedDataEntry = {
      id: this.generateId(),
      savedAt: new Date(),
      closedBotsConfig: { ...closedBotsConfig },
      botDataText,
      parsedBotsCount,
      totalGridProfitEUR,
      totalGridProfitUSDC,
    };

    if (this.backendAvailable) {
      try {
        const savedEntry = await firstValueFrom(
          this.http.post<SavedDataEntry>(`${this.API_BASE}/history`, {
            ...entry,
            savedAt: entry.savedAt.toISOString(),
          }),
        );
        savedEntry.savedAt = new Date(savedEntry.savedAt);
        this.history.update((h) => [savedEntry, ...h]);
        console.log('📊 [StorageService] Entry saved to backend');

        // Also save current config to backend
        await this.saveCurrentConfigToBackend(closedBotsConfig, botDataText);

        return savedEntry;
      } catch (error) {
        console.warn('⚠️ [StorageService] Failed to save to backend, using localStorage');
        this.backendAvailable = false;
      }
    }

    // Fallback to localStorage
    this.history.update((h) => [entry, ...h]);
    this.saveHistoryToLocalStorage();
    localStorage.setItem(this.CURRENT_CONFIG_KEY, JSON.stringify(closedBotsConfig));
    if (botDataText.trim()) {
      localStorage.setItem(this.CURRENT_BOT_DATA_KEY, botDataText);
    }

    return entry;
  }

  /**
   * Supprimer une entrée de l'historique
   */
  async deleteEntry(id: string): Promise<void> {
    if (this.backendAvailable) {
      try {
        await firstValueFrom(this.http.delete(`${this.API_BASE}/history/${id}`));
        this.history.update((h) => h.filter((e) => e.id !== id));
        console.log('📊 [StorageService] Entry deleted from backend');
        return;
      } catch (error) {
        console.warn('⚠️ [StorageService] Failed to delete from backend');
      }
    }

    // Fallback to localStorage
    this.history.update((h) => h.filter((e) => e.id !== id));
    this.saveHistoryToLocalStorage();
  }

  /**
   * Supprimer toutes les entrées
   */
  async clearHistory(): Promise<void> {
    if (this.backendAvailable) {
      try {
        await firstValueFrom(this.http.delete(`${this.API_BASE}/history`));
        this.history.set([]);
        console.log('📊 [StorageService] History cleared from backend');
        return;
      } catch (error) {
        console.warn('⚠️ [StorageService] Failed to clear history from backend');
      }
    }

    // Fallback to localStorage
    this.history.set([]);
    this.saveHistoryToLocalStorage();
  }
  /**
   * Restaurer une entrée (la charger comme données courantes)
   */
  async restoreEntry(entry: SavedDataEntry): Promise<void> {
    const config = entry.closedBotsConfig ?? { totalGridProfitEUR: 0, totalGridProfitUSDC: 0 };

    if (this.backendAvailable) {
      try {
        await this.saveCurrentConfigToBackend(config, entry.botDataText);
        return;
      } catch (error) {
        console.warn('⚠️ [StorageService] Failed to restore to backend');
      }
    }

    // Fallback to localStorage
    localStorage.setItem(this.CURRENT_CONFIG_KEY, JSON.stringify(config));
    localStorage.setItem(this.CURRENT_BOT_DATA_KEY, entry.botDataText);
  }
  /**
   * Obtenir les données courantes
   */
  async getCurrentConfig(): Promise<ClosedBotsConfig> {
    if (this.backendAvailable) {
      try {
        const response = await firstValueFrom(
          this.http.get<{ key: string; value: ClosedBotsConfig | null }>(
            `${this.API_BASE}/config/closedBotsConfig`,
          ),
        );
        if (response.value !== null) {
          return response.value;
        }
        // Value is null, use default
        console.log('📊 [StorageService] No closedBotsConfig in backend, using default');
      } catch (error) {
        console.warn('⚠️ [StorageService] Failed to get config from backend');
      }
    }

    // Fallback to localStorage
    const data = localStorage.getItem(this.CURRENT_CONFIG_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error('Error parsing current config:', e);
      }
    }
    return { totalGridProfitEUR: 0, totalGridProfitUSDC: 0 };
  }
  async getCurrentBotDataText(): Promise<string> {
    if (this.backendAvailable) {
      try {
        const response = await firstValueFrom(
          this.http.get<{ key: string; value: string | null }>(
            `${this.API_BASE}/config/botDataText`,
          ),
        );
        if (response.value !== null) {
          return response.value;
        }
        // Value is null, use default
        console.log('📊 [StorageService] No botDataText in backend, using default');
      } catch (error) {
        console.warn('⚠️ [StorageService] Failed to get botDataText from backend');
      }
    }

    // Fallback to localStorage
    return localStorage.getItem(this.CURRENT_BOT_DATA_KEY) || '';
  }

  /**
   * Save current config to backend
   */
  private async saveCurrentConfigToBackend(
    closedBotsConfig: ClosedBotsConfig,
    botDataText: string,
  ): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.API_BASE}/config`, {
        closedBotsConfig,
        botDataText,
      }),
    );
  }

  /**
   * Save closed bots config
   */
  async saveClosedBotsConfig(config: ClosedBotsConfig): Promise<void> {
    if (this.backendAvailable) {
      try {
        await firstValueFrom(
          this.http.put(`${this.API_BASE}/config/closedBotsConfig`, { value: config }),
        );
        return;
      } catch (error) {
        console.warn('⚠️ [StorageService] Failed to save config to backend');
      }
    }

    // Fallback to localStorage
    localStorage.setItem(this.CURRENT_CONFIG_KEY, JSON.stringify(config));
  }

  /**
   * Save bot data text
   */
  async saveBotDataText(text: string): Promise<void> {
    if (this.backendAvailable) {
      try {
        await firstValueFrom(this.http.put(`${this.API_BASE}/config/botDataText`, { value: text }));
        return;
      } catch (error) {
        console.warn('⚠️ [StorageService] Failed to save bot data text to backend');
      }
    }

    // Fallback to localStorage
    if (text.trim()) {
      localStorage.setItem(this.CURRENT_BOT_DATA_KEY, text);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
