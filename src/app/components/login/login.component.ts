import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private configService = inject(ConfigService);
  private router = inject(Router);

  password = signal('');
  error = signal<string | null>(null);
  loading = signal(false);

  onSubmit(): void {
    this.loading.set(true);
    this.error.set(null);

    // Petit délai pour éviter le brute force
    setTimeout(() => {
      if (this.configService.login(this.password())) {
        this.router.navigate(['/']);
      } else {
        this.error.set('Mot de passe incorrect');
        this.password.set('');
      }
      this.loading.set(false);
    }, 500);
  }
}
