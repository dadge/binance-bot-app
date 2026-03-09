import { Injectable, signal } from '@angular/core';

export type ServiceMode = 'mock' | 'live';

export interface BinanceConfig {
  apiKey: string;
  secretKey: string;
  mode: ServiceMode;
  password: string;
}

// Déclaration pour la config injectée par le script run.sh
declare global {
  interface Window {
    BINANCE_CONFIG?: Partial<BinanceConfig>;
  }
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private config: BinanceConfig = {
    apiKey: '',
    secretKey: '',
    mode: 'mock', // Par défaut en mode mock pour le développement
    password: '', // Mot de passe vide = pas de protection
  };

  // Signal pour l'état d'authentification
  private _isAuthenticated = signal<boolean>(false);
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  constructor() {
    this.loadConfig();
    this.checkStoredAuth();
  }

  private loadConfig(): void {
    // En production (Hassio), les valeurs sont injectées via window.BINANCE_CONFIG
    if (typeof window !== 'undefined' && window.BINANCE_CONFIG) {
      this.config = {
        apiKey: window.BINANCE_CONFIG.apiKey || '',
        secretKey: window.BINANCE_CONFIG.secretKey || '',
        mode: window.BINANCE_CONFIG.mode || 'mock',
        password: window.BINANCE_CONFIG.password || '',
      };
      console.log(`🔧 [ConfigService] Mode: ${this.config.mode}`);
      console.log(
        `🔒 [ConfigService] Password protection: ${this.isPasswordProtected() ? 'enabled' : 'disabled'}`,
      );
    }
  }

  private checkStoredAuth(): void {
    // Si pas de mot de passe configuré, on est automatiquement authentifié
    if (!this.isPasswordProtected()) {
      this._isAuthenticated.set(true);
      return;
    }

    // Vérifier si une session est stockée
    const storedAuth = sessionStorage.getItem('binance_bot_auth');
    if (storedAuth === 'true') {
      this._isAuthenticated.set(true);
    }
  }

  isPasswordProtected(): boolean {
    return this.config.password.length > 0;
  }

  validatePassword(password: string): boolean {
    if (!this.isPasswordProtected()) {
      return true;
    }
    return password === this.config.password;
  }

  login(password: string): boolean {
    if (this.validatePassword(password)) {
      this._isAuthenticated.set(true);
      sessionStorage.setItem('binance_bot_auth', 'true');
      return true;
    }
    return false;
  }

  logout(): void {
    this._isAuthenticated.set(false);
    sessionStorage.removeItem('binance_bot_auth');
  }

  getApiKey(): string {
    return this.config.apiKey;
  }

  getSecretKey(): string {
    return this.config.secretKey;
  }

  getMode(): ServiceMode {
    return this.config.mode;
  }

  isMockMode(): boolean {
    return this.config.mode === 'mock';
  }

  isLiveMode(): boolean {
    return this.config.mode === 'live';
  }

  hasApiKeys(): boolean {
    return !!(this.config.apiKey && this.config.secretKey);
  }

  getConfig(): BinanceConfig {
    return { ...this.config };
  }
}
