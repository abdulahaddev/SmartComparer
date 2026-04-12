import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Market Intelligence</h1>
        <p class="subtitle">Actionable insights from your competitor landscape</p>
      </div>

      <div class="top-row">
        <!-- Market Health Chart -->
        <div class="card chart-card" *ngIf="summary">
          <h2 class="card-title">Portfolio Health</h2>
          <div class="chart-container">
            <canvas baseChart
              [data]="doughnutChartData"
              [options]="doughnutChartOptions"
              [type]="doughnutChartType">
            </canvas>
            <div class="chart-center">
               <div class="total-label">Products</div>
               <div class="total-value">{{ summary.active_products }}</div>
            </div>
          </div>
          <div class="chart-legend">
            <div class="legend-item"><span class="dot leader"></span> Leader: {{ summary.status_distribution.leader }}</div>
            <div class="legend-item"><span class="dot competitive"></span> Competitive: {{ summary.status_distribution.competitive }}</div>
            <div class="legend-item"><span class="dot overpriced"></span> Overpriced: {{ summary.status_distribution.overpriced }}</div>
          </div>
        </div>

        <!-- Quick Summary Metrics -->
        <div class="summary-pills" *ngIf="summary">
          <div class="stat-pill">
             <div class="pill-label">Competitors</div>
             <div class="pill-value">{{ summary.total_competitors }}</div>
          </div>
          <div class="stat-pill">
             <div class="pill-label">Active Mappings</div>
             <div class="pill-value">{{ summary.total_mappings }}</div>
          </div>
          <div class="card last-run-mini" *ngIf="summary.last_run">
             <div class="mini-label">Last Scrape</div>
             <div class="mini-status" [ngClass]="summary.last_run.status">{{ summary.last_run.status }}</div>
             <div class="mini-time">{{ summary.last_run.finished_at | date:'shortTime' }}</div>
          </div>
        </div>
      </div>

      <!-- Actionable Insights Panels -->
      <div class="insights-row" *ngIf="priceComparison.length > 0">
        <!-- Quick Wins -->
        <div class="card action-card">
          <h2 class="card-title accent-orange">🚀 Quick Wins</h2>
          <p class="panel-desc">Be the leader with a tiny price adjustment (< 2%)</p>
          <div class="opportunity-list">
             <div class="opp-item" *ngFor="let item of getQuickWins()">
                <div class="opp-main">
                  <div class="opp-name">{{ item.product_name }}</div>
                  <div class="opp-suggest">Target: <span>৳{{ item.intelligence?.recommended_price | number:'1.0-0' }}</span></div>
                </div>
                <div class="opp-badge win">Win</div>
             </div>
             <div *ngIf="getQuickWins().length === 0" class="empty-list">No matches found</div>
          </div>
        </div>

        <!-- Margin Booster -->
        <div class="card action-card">
          <h2 class="card-title accent-emerald">💎 Margin Guard</h2>
          <p class="panel-desc">You are dominant. Safe to increase price without losing rank.</p>
          <div class="opportunity-list">
            <div class="opp-item" *ngFor="let item of getMarginBoosters()">
                <div class="opp-main">
                  <div class="opp-name">{{ item.product_name }}</div>
                  <div class="opp-suggest">Limit: <span>৳{{ item.intelligence?.recommended_price | number:'1.0-0' }}</span></div>
                </div>
                <div class="opp-badge boost">Boost</div>
             </div>
             <div *ngIf="getMarginBoosters().length === 0" class="empty-list">No matches found</div>
          </div>
        </div>
      </div>

      <!-- Price Intelligence Matrix -->
      <div class="card main-table-card">
        <h2 class="card-title">Competitive Price Visualizer</h2>
        <div class="table-wrapper" *ngIf="priceComparison.length > 0">
          <table>
            <thead>
              <tr>
                <th style="width: 250px">Product</th>
                <th style="width: 120px">Your Price</th>
                <th>Market Position Corridor</th>
                <th style="width: 140px; text-align: right">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of priceComparison">
                <td>
                  <div class="prod-name">{{ item.product_name }}</div>
                  <div class="prod-tag" *ngIf="item.intelligence">#{{ item.intelligence.rank }} / {{ item.intelligence.total_competitors + 1 }}</div>
                </td>
                <td class="price-cell">
                   <div class="main-price">৳{{ item.our_price | number:'1.2-2' }}</div>
                   <div class="status-dot" *ngIf="item.intelligence" [ngClass]="item.intelligence.status"></div>
                </td>
                <td>
                  <!-- Market Spread Corridor Visualization -->
                  <div class="corridor-container" *ngIf="item.intelligence">
                     <div class="corridor-limits">
                        <span>৳{{ item.intelligence.min_price | number:'1.0-0' }}</span>
                        <span>৳{{ item.intelligence.max_price | number:'1.0-0' }}</span>
                     </div>
                     <div class="corridor-track">
                        <div class="corridor-bar"></div>
                        <div class="corridor-marker" [style.left.%]="getPositionPercent(item)">
                           <div class="marker-label">Us</div>
                        </div>
                     </div>
                  </div>
                </td>
                <td style="text-align: right">
                  <div class="suggest-box" *ngIf="item.intelligence">
                    <div class="suggest-price">৳{{ item.intelligence.recommended_price | number:'1.0-0' }}</div>
                    <div class="suggest-action" [ngClass]="item.intelligence.opportunity">
                      {{ item.intelligence.opportunity === 'INCREASE_PRICE' ? '↗ Increase' : '↘ Decrease' }}
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 1400px; padding: 24px; color: #e0e0f0; }
    .page-header { margin-bottom: 32px; }
    h1 { font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #fff, #888); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
    .subtitle { color: #6b6b8d; font-size: 15px; margin-top: 8px; }

    .top-row { display: grid; grid-template-columns: 400px 1fr; gap: 24px; margin-bottom: 24px; min-height: 280px; }
    
    .card { background: rgba(13, 13, 30, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 20px; padding: 24px; backdrop-filter: blur(8px); }
    .card-title { font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 20px; }

    /* Chart Card */
    .chart-card { position: relative; }
    .chart-container { height: 180px; position: relative; display: flex; justify-content: center; }
    .chart-center { position: absolute; top: 52%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; }
    .total-label { font-size: 11px; color: #6b6b8d; text-transform: uppercase; }
    .total-value { font-size: 24px; font-weight: 800; color: #fff; }
    
    .chart-legend { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; }
    .legend-item { display: flex; align-items: center; gap: 8px; color: #c4c4e0; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot.leader { background: #10b981; }
    .dot.competitive { background: #f59e0b; }
    .dot.overpriced { background: #ef4444; }

    /* Summary Pills */
    .summary-pills { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 16px; }
    .stat-pill { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; justify-content: center; }
    .pill-label { font-size: 12px; color: #6b6b8d; text-transform: uppercase; margin-bottom: 4px; }
    .pill-value { font-size: 28px; font-weight: 800; color: #fff; }
    
    .last-run-mini { grid-column: span 2; display: flex; align-items: center; gap: 20px; padding: 16px 24px !important; }
    .mini-label { color: #6b6b8d; font-size: 12px; text-transform: uppercase; }
    .mini-status { font-weight: 700; font-size: 13px; text-transform: uppercase; }
    .mini-status.completed { color: #10b981; }
    .mini-time { margin-left: auto; color: #555; font-size: 12px; }

    /* Action Cards */
    .insights-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .accent-orange { color: #f59e0b !important; }
    .accent-emerald { color: #10b981 !important; }
    .panel-desc { color: #555; font-size: 12px; margin-top: -12px; margin-bottom: 16px; }
    
    .opportunity-list { display: flex; flex-direction: column; gap: 10px; }
    .opp-item { background: rgba(255,255,255,0.02); padding: 12px 16px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; }
    .opp-name { font-size: 14px; font-weight: 600; color: #c4c4e0; }
    .opp-suggest { font-size: 12px; color: #666; margin-top: 2px; }
    .opp-suggest span { color: #fff; font-weight: 600; font-family: 'JetBrains Mono'; }
    .opp-badge { padding: 4px 10px; border-radius: 8px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .opp-badge.win { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
    .opp-badge.boost { background: rgba(16, 185, 129, 0.1); color: #10b981; }

    /* Matrix Table */
    .main-table-card { padding: 0 !important; overflow: hidden; }
    .main-table-card .card-title { padding: 24px 24px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 16px 24px; font-size: 11px; color: #6b6b8d; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.04); }
    td { padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.02); vertical-align: middle; }
    
    .prod-name { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
    .prod-tag { font-size: 10px; font-weight: 700; color: #555; text-transform: uppercase; }
    
    .price-cell { position: relative; }
    .main-price { font-weight: 700; font-size: 16px; font-family: 'JetBrains Mono'; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; position: absolute; left: 8px; top: 26px; }
    .status-dot.LEADER { background: #10b981; box-shadow: 0 0 10px #10b981; }
    .status-dot.COMPETITIVE { background: #f59e0b; }
    .status-dot.OVERPRICED { background: #ef4444; }

    /* Corridor Visual */
    .corridor-container { max-width: 400px; padding: 4px 0; }
    .corridor-limits { display: flex; justify-content: space-between; font-size: 10px; color: #444; margin-bottom: 6px; font-family: 'JetBrains Mono'; }
    .corridor-track { height: 8px; background: rgba(255,255,255,0.04); border-radius: 4px; position: relative; }
    .corridor-bar { position: absolute; height: 100%; width: 100%; background: linear-gradient(90deg, #10b981, #f59e0b, #ef4444); opacity: 0.1; border-radius: 4px; }
    .corridor-marker { position: absolute; top: -12px; width: 2px; height: 32px; background: #fff; transition: left 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    .marker-label { position: absolute; top: -16px; left: 50%; transform: translateX(-50%); background: #fff; color: #000; font-size: 9px; font-weight: 800; padding: 1px 4px; border-radius: 4px; text-transform: uppercase; }

    /* Suggestion Box */
    .suggest-price { font-size: 16px; font-weight: 800; font-family: 'JetBrains Mono'; }
    .suggest-action { font-size: 10px; font-weight: 800; text-transform: uppercase; margin-top: 4px; }
    .suggest-action.INCREASE_PRICE { color: #10b981; }
    .suggest-action.DECREASE_PRICE { color: #f59e0b; }

    .empty-list { text-align: center; color: #444; font-size: 12px; font-style: italic; padding: 20px; }

    @media (max-width: 1100px) {
      .top-row { grid-template-columns: 1fr; }
      .insights-row { grid-template-columns: 1fr; }
    }
  `],
})
export class DashboardComponent implements OnInit {
  summary: any = null;
  priceComparison: any[] = [];

  // Chart Data
  public doughnutChartData: ChartData<'doughnut'> = {
    labels: ['Leader', 'Competitive', 'Overpriced'],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
      hoverBackgroundColor: ['#059669', '#d97706', '#dc2626'],
      borderWidth: 0,
      circumference: 360,
      rotation: 0
    }]
  };

  public doughnutChartType: 'doughnut' = 'doughnut';
  public doughnutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '85%',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    }
  };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getDashboardSummary().subscribe((data) => {
      this.summary = data;
      if (data.status_distribution) {
        this.doughnutChartData.datasets[0].data = [
          data.status_distribution.leader,
          data.status_distribution.competitive,
          data.status_distribution.overpriced
        ];
      }
    });

    this.api.getPriceComparison().subscribe((data) => {
      this.priceComparison = data;
    });
  }

  getPositionPercent(item: any): number {
    if (!item.intelligence) return 0;
    const { min_price, max_price } = item.intelligence;
    const our_price = item.our_price;
    if (max_price === min_price) return 0;
    const percent = ((our_price - min_price) / (max_price - min_price)) * 100;
    return Math.min(Math.max(percent, 0), 100);
  }

  getQuickWins(): any[] {
    return this.priceComparison.filter(i => i.intelligence?.is_quick_win);
  }

  getMarginBoosters(): any[] {
    return this.priceComparison.filter(i => i.intelligence?.is_margin_booster);
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
