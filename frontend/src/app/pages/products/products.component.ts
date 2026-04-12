import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Products</h1>
          <p class="subtitle">Manage your WooCommerce products</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" (click)="syncProducts()" [disabled]="syncing">
            {{ syncing ? '⏳ Syncing...' : '🔄 Sync from WordPress' }}
          </button>
        </div>
      </div>

      <!-- Sync Result -->
      <div class="alert success" *ngIf="syncResult">
        ✅ Sync complete — Inserted: {{ syncResult.inserted }}, Updated: {{ syncResult.updated }},
        Deactivated: {{ syncResult.deactivated }}, Total WP Products: {{ syncResult.total_wp_products }}
        <button class="alert-close" (click)="syncResult = null">×</button>
      </div>

      <!-- Search -->
      <div class="search-bar">
        <input type="text" [(ngModel)]="searchQuery" placeholder="Search products..." (input)="loadProducts()" />
        <select [(ngModel)]="activeFilter" (change)="loadProducts()">
          <option [ngValue]="null">All</option>
          <option [ngValue]="true">Active</option>
          <option [ngValue]="false">Inactive</option>
        </select>
      </div>

      <!-- Table -->
      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>WP ID</th>
                <th>Name</th>
                <th>Price</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of products">
                <td>{{ p.id }}</td>
                <td class="mono">{{ p.wp_product_id }}</td>
                <td>{{ p.name }}</td>
                <td class="mono">{{ p.current_price | number:'1.2-2' }}</td>
                <td>
                  <span class="badge" [ngClass]="p.is_active ? 'active' : 'inactive'">
                    {{ p.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="muted">{{ p.updated_at | date:'short' }}</td>
                <td>
                  <div class="action-btns">
                    <button class="btn-sm" (click)="viewHistory(p)" title="View price history">📈</button>
                    <button class="btn-sm map-btn" (click)="mapProduct(p)" title="Visual Mapper">🎯 Map</button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="products.length === 0">
                <td colspan="7" class="empty">No products found. Sync from WordPress to get started.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pagination" *ngIf="total > 50">
          <button class="btn-sm" [disabled]="page === 0" (click)="page = page - 1; loadProducts()">← Prev</button>
          <span class="page-info">Page {{ page + 1 }} of {{ totalPages }}</span>
          <button class="btn-sm" [disabled]="page >= totalPages - 1" (click)="page = page + 1; loadProducts()">Next →</button>
        </div>
      </div>

      <!-- Price History Modal -->
      <div class="modal-overlay" *ngIf="showHistory" (click)="showHistory = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Price History — {{ selectedProduct?.name }}</h2>
            <button class="modal-close" (click)="showHistory = false">×</button>
          </div>
          <div class="modal-body">
            <div *ngIf="historyLoading" class="loading">Loading...</div>
            <div *ngIf="!historyLoading && priceHistory.length === 0" class="empty">No price history yet.</div>
            
            <div *ngIf="priceHistory.length > 0" class="chart-container">
              <canvas baseChart
                [data]="chartData"
                [options]="chartOptions"
                [type]="'line'">
              </canvas>
            </div>

            <div class="table-wrapper" *ngIf="priceHistory.length > 0">
              <table>
                <thead>
                  <tr>
                    <th>Competitor</th>
                    <th>Price</th>
                    <th>Diff</th>
                    <th>Diff %</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let h of priceHistory">
                    <td>{{ h.competitor_name }}</td>
                    <td class="mono">{{ h.price | number:'1.2-2' }}</td>
                    <td class="mono" [ngClass]="{'lower': h.price_diff < 0, 'higher': h.price_diff > 0}">
                      {{ h.price_diff | number:'1.2-2' }}
                    </td>
                    <td class="mono" [ngClass]="{'lower': h.price_diff_percent < 0, 'higher': h.price_diff_percent > 0}">
                      {{ h.price_diff_percent | number:'1.1-1' }}%
                    </td>
                    <td class="muted">{{ h.scraped_at | date:'medium' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 1200px; }
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px;
    }
    h1 { font-size: 28px; font-weight: 700; color: #e0e0f0; margin: 0 0 8px; }
    .subtitle { color: #6b6b8d; font-size: 14px; margin: 0; }

    .btn { padding: 10px 20px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-primary {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
      padding: 10px 20px; border: none; border-radius: 10px;
      font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 25px rgba(102, 126, 234, 0.4); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .alert {
      padding: 14px 20px; border-radius: 10px; margin-bottom: 20px;
      display: flex; justify-content: space-between; align-items: center; font-size: 14px;
    }
    .alert.success { background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); color: #22c55e; }
    .alert-close { background: none; border: none; color: inherit; font-size: 20px; cursor: pointer; }

    .search-bar {
      display: flex; gap: 12px; margin-bottom: 20px;
    }
    .search-bar input {
      flex: 1; padding: 10px 16px; background: rgba(26, 26, 62, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px;
      color: #e0e0f0; font-size: 14px; outline: none;
    }
    .search-bar input:focus { border-color: #667eea; }
    .search-bar input::placeholder { color: #4a4a6a; }
    .search-bar select {
      padding: 10px 16px; background: rgba(26, 26, 62, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px;
      color: #e0e0f0; font-size: 14px; outline: none;
    }

    .card {
      background: rgba(26, 26, 62, 0.6); border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px; padding: 0; overflow: hidden;
    }
    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left; padding: 14px 16px; font-size: 12px; color: #6b6b8d;
      text-transform: uppercase; letter-spacing: 0.5px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(15, 15, 35, 0.3);
    }
    td {
      padding: 12px 16px; font-size: 14px; color: #c4c4e0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    }
    tr:hover td { background: rgba(102, 126, 234, 0.03); }

    .mono { font-family: 'JetBrains Mono', 'Fira Code', monospace; }
    .muted { color: #6b6b8d; }
    .empty { text-align: center; color: #6b6b8d; padding: 40px 16px !important; }
    .lower { color: #22c55e; }
    .higher { color: #ef4444; }

    .badge {
      display: inline-block; padding: 3px 10px; border-radius: 6px;
      font-size: 11px; font-weight: 600; text-transform: uppercase;
    }
    .badge.active { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    .badge.inactive { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

    .btn-sm {
      padding: 6px 12px; background: rgba(102, 126, 234, 0.1);
      border: 1px solid rgba(102, 126, 234, 0.2); border-radius: 6px;
      color: #667eea; font-size: 13px; cursor: pointer; transition: all 0.2s;
    }
    .btn-sm:hover:not(:disabled) { background: rgba(102, 126, 234, 0.2); }
    .btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }
    .action-btns { display: flex; gap: 6px; }
    .map-btn { background: rgba(118, 75, 162, 0.1); border-color: rgba(118, 75, 162, 0.2); color: #764ba2; }
    .map-btn:hover { background: rgba(118, 75, 162, 0.2); }

    .pagination {
      display: flex; justify-content: center; align-items: center; gap: 16px;
      padding: 16px;
    }
    .page-info { color: #6b6b8d; font-size: 13px; }

    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
      backdrop-filter: blur(4px);
    }
    .modal {
      width: 800px; max-width: 90vw; max-height: 80vh;
      background: #1a1a3e; border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px; overflow: hidden; display: flex; flex-direction: column;
    }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 20px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .modal-header h2 { font-size: 18px; color: #e0e0f0; margin: 0; font-weight: 600; }
    .modal-close {
      background: none; border: none; color: #6b6b8d; font-size: 24px;
      cursor: pointer; transition: color 0.2s;
    }
    .modal-close:hover { color: #e0e0f0; }
    .modal-body { padding: 0; overflow-y: auto; flex: 1; }
    .chart-container {
      height: 300px;
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .loading { text-align: center; padding: 40px; color: #6b6b8d; }
  `],
})
export class ProductsComponent implements OnInit {
  products: any[] = [];
  total = 0;
  page = 0;
  totalPages = 1;
  searchQuery = '';
  activeFilter: boolean | null = null;
  syncing = false;
  syncResult: any = null;

  showHistory = false;
  selectedProduct: any = null;
  priceHistory: any[] = [];
  historyLoading = false;

  chartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#e0e0f0' } },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: { ticks: { color: '#8b8bae' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#8b8bae' }, grid: { color: 'rgba(255,255,255,0.05)' } }
    }
  };

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    const params: any = { skip: this.page * 50, limit: 50 };
    if (this.searchQuery) params.search = this.searchQuery;
    if (this.activeFilter !== null) params.is_active = this.activeFilter;

    this.api.getProducts(params).subscribe((data) => {
      this.products = data.products;
      this.total = data.total;
      this.totalPages = Math.ceil(this.total / 50);
    });
  }

  syncProducts() {
    this.syncing = true;
    this.syncResult = null;
    this.api.syncProducts().subscribe({
      next: (result) => {
        this.syncResult = result;
        this.syncing = false;
        this.loadProducts();
      },
      error: () => {
        this.syncing = false;
      },
    });
  }

  viewHistory(product: any) {
    this.selectedProduct = product;
    this.showHistory = true;
    this.historyLoading = true;
    this.priceHistory = [];

    this.api.getProductPriceHistory(product.id).subscribe({
      next: (data) => {
        this.priceHistory = data.filter((h: any) => h.price !== null);
        this.setupChart();
        this.historyLoading = false;
      },
      error: () => {
        this.historyLoading = false;
      },
    });
  }

  mapProduct(product: any) {
    this.router.navigate(['/visual-mapper'], {
      queryParams: { product_id: product.id },
    });
  }

  setupChart() {
    if (!this.priceHistory || this.priceHistory.length === 0) return;

    // Group history by date to build the x-axis labels
    // Sort chronologically ascending
    const sorted = [...this.priceHistory].sort((a, b) => new Date(a.scraped_at).getTime() - new Date(b.scraped_at).getTime());
    
    const xLabels = Array.from(new Set(sorted.map(h => new Date(h.scraped_at).toLocaleDateString())));

    // Group by competitor
    const grouped: any = {};
    for (const h of sorted) {
      if (!grouped[h.competitor_name]) grouped[h.competitor_name] = [];
      grouped[h.competitor_name].push(h);
    }

    const datasets: any[] = [];
    
    // Competitor lines
    let colors = ['#667eea', '#ed8936', '#38b2ac', '#ed64a6', '#9f7aea'];
    let cIdx = 0;
    
    for (const comp in grouped) {
      const dataPoints = xLabels.map(label => {
        const point = grouped[comp].filter((h: any) => new Date(h.scraped_at).toLocaleDateString() === label).pop();
        return point ? point.price : null;
      });
      datasets.push({
        label: comp,
        data: dataPoints,
        borderColor: colors[cIdx % colors.length],
        tension: 0.1,
        spanGaps: true
      });
      cIdx++;
    }

    // Add internal product price line
    datasets.push({
      label: 'Our Price',
      data: xLabels.map(() => this.selectedProduct.current_price),
      borderColor: '#22c55e',
      borderDash: [5, 5],
      tension: 0
    });

    this.chartData = {
      labels: xLabels,
      datasets: datasets
    };
  }
}
