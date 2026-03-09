import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ConfigService } from '../services/config.service';

export const authGuard: CanActivateFn = () => {
  const configService = inject(ConfigService);
  const router = inject(Router);

  // Si pas de mot de passe configuré, accès libre
  if (!configService.isPasswordProtected()) {
    return true;
  }

  // Si authentifié, accès autorisé
  if (configService.isAuthenticated()) {
    return true;
  }

  // Sinon, redirection vers la page de login
  return router.createUrlTree(['/login']);
};

// Guard inverse pour la page login (rediriger si déjà authentifié)
export const loginGuard: CanActivateFn = () => {
  const configService = inject(ConfigService);
  const router = inject(Router);

  // Si pas de mot de passe configuré ou déjà authentifié, rediriger vers le dashboard
  if (!configService.isPasswordProtected() || configService.isAuthenticated()) {
    return router.createUrlTree(['/']);
  }

  return true;
};
