import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Dashboard</h1>
        <p class="subtitle">Overview of your price intelligence system</p>
      </div>

      <div class="stats-grid" *ngIf="summary">
        <div class="stat-card">
          <div class="stat-icon blue">📦</div>
          <div class="stat-info">
            <div class="stat-value">{{ summary.active_products }}</div>
            <div class="stat-label">Active Products</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">🏪</div>
          <div class="stat-info">
            <div class="stat-value">{{ summary.total_competitors }}</div>
            <div class="stat-label">Competitors</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">🔗</div>
          <div class="stat-info">
            <div class="stat-value">{{ summary.total_mappings }}</div>
            <div class="stat-label">Product Mappings</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">🔄</div>
          <div class="stat-info">
            <div class="stat-value">{{ summary.total_scrape_runs }}</div>
            <div class="stat-label">Scrape Runs</div>
          </div>
        </div>
      </div>

      <!-- Last Run Info -->
      <div class="card" *ngIf="summary?.last_run">
        <h2 class="card-title">Last Scrape Run</h2>
        <div class="last-run-info">
          <div class="run-detail">
            <span class="detail-label">Status</span>
            <span class="badge" [ngClass]="summary.last_run.status">{{ summary.last_run.status }}</span>
          </div>
          <div class="run-detail">
            <span class="detail-label">Started</span>
            <span class="detail-value">{{ summary.last_run.started_at | date:'medium' }}</span>
          </div>
          <div class="run-detail">
            <span class="detail-label">Success</span>
            <span class="detail-value success-text">{{ summary.last_run.success_count }}</span>
          </div>
          <div class="run-detail">
            <span class="detail-label">Failed</span>
            <span class="detail-value fail-text">{{ summary.last_run.failure_count }}</span>
          </div>
        </div>
      </div>
      <div class="card" *ngIf="summary && !summary.last_run">
        <h2 class="card-title">Last Scrape Run</h2>
        <p class="empty-text">No scrape runs yet. Go to Scrape Runs to trigger one.</p>
      </div>

      <!-- Price Comparison -->
      <div class="card">
        <h2 class="card-title">Price Comparison</h2>
        <div *ngIf="priceComparison.length === 0" class="empty-text">
          No price comparison data available. Sync products and run a scrape first.
        </div>
        <div class="table-wrapper" *ngIf="priceComparison.length > 0">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Our Price</th>
                <th *ngFor="let comp of getCompetitorNames()">{{ comp }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of priceComparison">
                <td>{{ item.product_name }}</td>
                <td class="price-cell">{{ item.our_price | number:'1.2-2' }}</td>
                <td *ngFor="let comp of getCompetitorNames()" class="price-cell">
                  <ng-container *ngIf="getCompPrice(item, comp) as cp">
                    <span [ngClass]="{'lower': cp.price_diff && cp.price_diff < 0, 'higher': cp.price_diff && cp.price_diff > 0}">
                      {{ cp.price | number:'1.2-2' }}
                    </span>
                    <small *ngIf="cp.price_diff_percent" class="diff" [ngClass]="{'lower': cp.price_diff_percent < 0, 'higher': cp.price_diff_percent > 0}">
                      ({{ cp.price_diff_percent > 0 ? '+' : '' }}{{ cp.price_diff_percent | number:'1.1-1' }}%)
                    </small>
                  </ng-container>
                  <span *ngIf="!getCompPrice(item, comp)" class="na">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 1200px; }

    .page-header { margin-bottom: 32px; }

    h1 {
      font-size: 28px;
      font-weight: 700;
      color: #e0e0f0;
      margin: 0 0 8px;
    }

    .subtitle { color: #6b6b8d; font-size: 14px; margin: 0; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 28px;
    }

    .stat-card {
      background: rgba(26, 26, 62, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
    }

    .stat-icon.blue { background: rgba(102, 126, 234, 0.15); }
    .stat-icon.purple { background: rgba(118, 75, 162, 0.15); }
    .stat-icon.green { background: rgba(34, 197, 94, 0.15); }
    .stat-icon.orange { background: rgba(249, 115, 22, 0.15); }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #e0e0f0;
    }

    .stat-label {
      font-size: 13px;
      color: #6b6b8d;
      margin-top: 2px;
    }

    .card {
      background: rgba(26, 26, 62, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 20px;
    }

    .card-title {
      font-size: 18px;
      font-weight: 600;
      color: #c4c4e0;
      margin: 0 0 20px;
    }

    .last-run-info {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .run-detail { display: flex; flex-direction: column; gap: 6px; }

    .detail-label {
      font-size: 12px;
      color: #6b6b8d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .detail-value { color: #c4c4e0; font-size: 15px; font-weight: 500; }

    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      width: fit-content;
    }

    .badge.completed { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    .badge.running { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
    .badge.failed { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

    .success-text { color: #22c55e; }
    .fail-text { color: #ef4444; }
    .empty-text { color: #6b6b8d; font-size: 14px; }

    .table-wrapper { overflow-x: auto; }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      text-align: left;
      padding: 12px 16px;
      font-size: 12px;
      color: #6b6b8d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    td {
      padding: 12px 16px;
      font-size: 14px;
      color: #c4c4e0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    }

    .price-cell { font-family: 'JetBrains Mono', monospace; }
    .lower { color: #22c55e; }
    .higher { color: #ef4444; }
    .na { color: #4a4a6a; }
    .diff { margin-left: 6px; font-size: 12px; }

    @media (max-width: 900px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .last-run-info { grid-template-columns: repeat(2, 1fr); }
    }
  `],
})
export class DashboardComponent implements OnInit {
  summary: any = null;
  priceComparison: any[] = [];

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getDashboardSummary().subscribe((data) => (this.summary = data));
    this.api.getPriceComparison().subscribe((data) => (this.priceComparison = data));
  }

  getCompetitorNames(): string[] {
    const names = new Set<string>();
    this.priceComparison.forEach((item) => {
      item.competitor_prices?.forEach((cp: any) => names.add(cp.competitor_name));
    });
    return Array.from(names);
  }

  getCompPrice(item: any, competitorName: string): any {
    return item.competitor_prices?.find((cp: any) => cp.competitor_name === competitorName);
  }
}
