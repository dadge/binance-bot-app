import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { HistoryComponent } from './components/history/history.component';
import { LoginComponent } from './components/login/login.component';
import { authGuard, loginGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'history', component: HistoryComponent, canActivate: [authGuard] },
  { path: 'login', component: LoginComponent, canActivate: [loginGuard] },
  { path: '**', redirectTo: '' },
];
