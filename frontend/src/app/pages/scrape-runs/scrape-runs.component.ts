import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-scrape-runs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Scrape Runs</h1>
          <p class="subtitle">Trigger and monitor scraping operations</p>
        </div>
        <button class="btn btn-primary" (click)="triggerScrape()" [disabled]="scraping">
          {{ scraping ? '⏳ Scraping...' : '🚀 Run Scrape Now' }}
        </button>
      </div>

      <!-- Runs Table -->
      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Run #</th>
                <th>Status</th>
                <th>Started</th>
                <th>Finished</th>
                <th>Total</th>
                <th>Success</th>
                <th>Failed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of runs">
                <td class="mono">#{{ r.id }}</td>
                <td>
                  <span class="badge" [ngClass]="r.status">{{ r.status }}</span>
                </td>
                <td class="muted">{{ r.started_at | date:'medium' }}</td>
                <td class="muted">{{ r.finished_at ? (r.finished_at | date:'medium') : '—' }}</td>
                <td class="mono">{{ r.total_products }}</td>
                <td class="mono success-text">{{ r.success_count }}</td>
                <td class="mono fail-text">{{ r.failure_count }}</td>
                <td>
                  <button class="btn-sm" (click)="viewLogs(r)">📋 Logs</button>
                </td>
              </tr>
              <tr *ngIf="runs.length === 0">
                <td colspan="8" class="empty">No scrape runs yet. Click "Run Scrape Now" to start.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Logs Modal -->
      <div class="modal-overlay" *ngIf="showLogs" (click)="showLogs = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Scrape Logs — Run #{{ selectedRun?.id }}</h2>
            <button class="modal-close" (click)="showLogs = false">×</button>
          </div>
          <div class="modal-body">
            <div *ngIf="logsLoading" class="loading">Loading logs...</div>
            <div *ngIf="!logsLoading && logs.length === 0" class="empty-modal">No logs for this run.</div>
            <div class="table-wrapper" *ngIf="logs.length > 0">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Competitor</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Error</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let log of logs">
                    <td>{{ log.product_name || 'ID: ' + log.competitor_product_id }}</td>
                    <td>{{ log.competitor_name || '—' }}</td>
                    <td>
                      <span class="badge" [ngClass]="log.status">{{ log.status }}</span>
                    </td>
                    <td class="mono">{{ log.attempt_count }}</td>
                    <td class="error-cell">{{ log.error_message || '—' }}</td>
                    <td class="muted">{{ log.created_at | date:'mediumTime' }}</td>
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
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    h1 { font-size: 28px; font-weight: 700; color: #e0e0f0; margin: 0 0 8px; }
    .subtitle { color: #6b6b8d; font-size: 14px; margin: 0; }

    .btn { padding: 10px 20px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); }
    .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 25px rgba(102, 126, 234, 0.4); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .card { background: rgba(26, 26, 62, 0.6); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; padding: 0; overflow: hidden; }
    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 14px 16px; font-size: 12px; color: #6b6b8d; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); background: rgba(15, 15, 35, 0.3); }
    td { padding: 12px 16px; font-size: 14px; color: #c4c4e0; border-bottom: 1px solid rgba(255, 255, 255, 0.03); }
    tr:hover td { background: rgba(102, 126, 234, 0.03); }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .muted { color: #6b6b8d; }
    .empty { text-align: center; color: #6b6b8d; padding: 40px 16px !important; }

    .badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .badge.completed { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    .badge.running { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
    .badge.failed { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
    .badge.success { background: rgba(34, 197, 94, 0.15); color: #22c55e; }

    .success-text { color: #22c55e; }
    .fail-text { color: #ef4444; }

    .btn-sm { padding: 6px 12px; background: rgba(102, 126, 234, 0.1); border: 1px solid rgba(102, 126, 234, 0.2); border-radius: 6px; color: #667eea; font-size: 13px; cursor: pointer; transition: all 0.2s; }
    .btn-sm:hover { background: rgba(102, 126, 234, 0.2); }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
    .modal { width: 900px; max-width: 95vw; max-height: 80vh; background: #1a1a3e; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
    .modal-header h2 { font-size: 18px; color: #e0e0f0; margin: 0; font-weight: 600; }
    .modal-close { background: none; border: none; color: #6b6b8d; font-size: 24px; cursor: pointer; }
    .modal-body { padding: 0; overflow-y: auto; flex: 1; }
    .loading { text-align: center; padding: 40px; color: #6b6b8d; }
    .empty-modal { text-align: center; padding: 40px; color: #6b6b8d; }
    .error-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ef4444; font-size: 12px; }
  `],
})
export class ScrapeRunsComponent implements OnInit {
  runs: any[] = [];
  scraping = false;
  showLogs = false;
  selectedRun: any = null;
  logs: any[] = [];
  logsLoading = false;

  constructor(private api: ApiService) {}

  ngOnInit() { this.loadRuns(); }

  loadRuns() {
    this.api.getScrapeRuns().subscribe((data) => (this.runs = data));
  }

  triggerScrape() {
    this.scraping = true;
    this.api.triggerScrape().subscribe({
      next: () => {
        this.scraping = false;
        this.loadRuns();
      },
      error: () => { this.scraping = false; },
    });
  }

  viewLogs(run: any) {
    this.selectedRun = run;
    this.showLogs = true;
    this.logsLoading = true;
    this.logs = [];
    this.api.getScrapeRunLogs(run.id).subscribe({
      next: (data) => { this.logs = data; this.logsLoading = false; },
      error: () => { this.logsLoading = false; },
    });
  }
}
