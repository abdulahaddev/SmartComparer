import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="app-layout">
      <nav class="sidebar">
        <div class="sidebar-header">
          <div class="logo">
            <span class="logo-icon">📊</span>
            <span class="logo-text">SmartCompare</span>
          </div>
        </div>
        <ul class="nav-links">
          <li>
            <a routerLink="/dashboard" routerLinkActive="active">
              <span class="nav-icon">🏠</span>
              <span>Dashboard</span>
            </a>
          </li>
          <li>
            <a routerLink="/products" routerLinkActive="active">
              <span class="nav-icon">📦</span>
              <span>Products</span>
            </a>
          </li>
          <li>
            <a routerLink="/competitors" routerLinkActive="active">
              <span class="nav-icon">🏪</span>
              <span>Competitors</span>
            </a>
          </li>
          <li>
            <a routerLink="/mappings" routerLinkActive="active">
              <span class="nav-icon">🔗</span>
              <span>Mappings</span>
            </a>
          </li>
          <li>
            <a routerLink="/scrape-runs" routerLinkActive="active">
              <span class="nav-icon">🔄</span>
              <span>Scrape Runs</span>
            </a>
          </li>
        </ul>
        <div class="sidebar-footer">
          <div class="user-info">
            <span class="user-icon">👤</span>
            <span class="user-name">{{ username$ | async }}</span>
          </div>
          <button class="logout-btn" (click)="logout()">Logout</button>
        </div>
      </nav>
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-layout {
      display: flex;
      min-height: 100vh;
      background: #0f0f23;
    }

    .sidebar {
      width: 260px;
      background: linear-gradient(180deg, #1a1a3e 0%, #0d0d2b 100%);
      border-right: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      flex-direction: column;
      position: fixed;
      height: 100vh;
      z-index: 100;
    }

    .sidebar-header {
      padding: 24px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      font-size: 28px;
    }

    .logo-text {
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: 0.5px;
    }

    .nav-links {
      list-style: none;
      padding: 16px 12px;
      margin: 0;
      flex: 1;
    }

    .nav-links li { margin-bottom: 4px; }

    .nav-links a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 10px;
      color: #8b8bae;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .nav-links a:hover {
      background: rgba(102, 126, 234, 0.1);
      color: #c4c4e0;
    }

    .nav-links a.active {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
      color: #fff;
      box-shadow: 0 0 20px rgba(102, 126, 234, 0.1);
    }

    .nav-icon { font-size: 18px; }

    .sidebar-footer {
      padding: 16px 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #8b8bae;
      font-size: 14px;
      margin-bottom: 12px;
    }

    .logout-btn {
      width: 100%;
      padding: 10px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 8px;
      color: #ef4444;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .logout-btn:hover {
      background: rgba(239, 68, 68, 0.2);
    }

    .main-content {
      flex: 1;
      margin-left: 260px;
      padding: 32px;
      min-height: 100vh;
      overflow-y: auto;
    }
  `],
})
export class LayoutComponent {
  private authService = inject(AuthService);
  username$ = this.authService.username$;

  logout() {
    this.authService.logout();
    window.location.href = '/login';
  }
}
