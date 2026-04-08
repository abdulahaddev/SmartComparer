import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-mappings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Product Mappings</h1>
          <p class="subtitle">Link your products to competitor product pages</p>
        </div>
        <button class="btn btn-primary" (click)="openAdd()">+ Add Mapping</button>
      </div>

      <!-- Table -->
      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Competitor</th>
                <th>URL</th>
                <th>Strategy</th>
                <th>Last Scraped</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let m of mappings">
                <td>{{ m.product_name || 'ID: ' + m.product_id }}</td>
                <td>{{ m.competitor_name || 'ID: ' + m.competitor_id }}</td>
                <td>
                  <a [href]="m.url" target="_blank" class="link">{{ truncate(m.url, 40) }}</a>
                </td>
                <td>
                  <span class="badge mono" [ngClass]="m.strategy_json ? 'active' : 'inactive'">
                    {{ m.strategy_json ? 'Set' : 'None' }}
                  </span>
                </td>
                <td class="muted">{{ m.last_scraped_at ? (m.last_scraped_at | date:'short') : 'Never' }}</td>
                <td>
                  <span class="badge" [ngClass]="m.is_active ? 'active' : 'inactive'">
                    {{ m.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td>
                  <div class="actions">
                    <button class="btn-icon" (click)="editMapping(m)" title="Edit">✏️</button>
                    <button class="btn-icon danger" (click)="deleteMapping(m)" title="Deactivate">🗑️</button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="mappings.length === 0">
                <td colspan="7" class="empty">No mappings yet. Add products and competitors first, then create mappings.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add/Edit Modal -->
      <div class="modal-overlay" *ngIf="showForm" (click)="showForm = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingId ? 'Edit Mapping' : 'Add Mapping' }}</h2>
            <button class="modal-close" (click)="showForm = false">×</button>
          </div>
          <div class="modal-body">
            <form (ngSubmit)="saveMapping()">
              <div class="form-group" *ngIf="!editingId">
                <label>Product</label>
                <select [(ngModel)]="formData.product_id" name="product_id" required>
                  <option [ngValue]="null" disabled>Select a product</option>
                  <option *ngFor="let p of products" [ngValue]="p.id">{{ p.name }} (ID: {{ p.id }})</option>
                </select>
              </div>
              <div class="form-group" *ngIf="!editingId">
                <label>Competitor</label>
                <select [(ngModel)]="formData.competitor_id" name="competitor_id" required>
                  <option [ngValue]="null" disabled>Select a competitor</option>
                  <option *ngFor="let c of competitors" [ngValue]="c.id">{{ c.name }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>Product URL on Competitor Site</label>
                <input type="url" [(ngModel)]="formData.url" name="url" placeholder="https://competitor.com/product/123" required />
              </div>
              <div class="form-group">
                <label>Price CSS Selector</label>
                <input type="text" [(ngModel)]="strategyFields.price_selector" name="price_selector" placeholder=".product-price .amount" />
              </div>
              <div class="form-group">
                <label>Stock CSS Selector (optional)</label>
                <input type="text" [(ngModel)]="strategyFields.stock_selector" name="stock_selector" placeholder=".stock-status" />
              </div>
              <div class="form-group">
                <label>Wait For Selector (optional)</label>
                <input type="text" [(ngModel)]="strategyFields.wait_for" name="wait_for" placeholder=".product-price" />
              </div>
              <div class="form-group">
                <label>Currency Symbol (optional)</label>
                <input type="text" [(ngModel)]="strategyFields.currency_symbol" name="currency_symbol" placeholder="৳" />
              </div>
              <div class="form-group" *ngIf="editingId">
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="formData.is_active" name="is_active" />
                  Active
                </label>
              </div>
              <div class="form-actions">
                <button type="button" class="btn btn-secondary" (click)="showForm = false">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="saving">
                  {{ saving ? 'Saving...' : (editingId ? 'Update' : 'Create') }}
                </button>
              </div>
            </form>
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
    .btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { background: rgba(255, 255, 255, 0.06); color: #8b8bae; border: 1px solid rgba(255, 255, 255, 0.08); }

    .card { background: rgba(26, 26, 62, 0.6); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; padding: 0; overflow: hidden; }
    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 14px 16px; font-size: 12px; color: #6b6b8d; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); background: rgba(15, 15, 35, 0.3); }
    td { padding: 12px 16px; font-size: 14px; color: #c4c4e0; border-bottom: 1px solid rgba(255, 255, 255, 0.03); }
    tr:hover td { background: rgba(102, 126, 234, 0.03); }
    .muted { color: #6b6b8d; }
    .empty { text-align: center; color: #6b6b8d; padding: 40px 16px !important; }
    .mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }

    .link { color: #667eea; text-decoration: none; font-size: 13px; }
    .link:hover { text-decoration: underline; }

    .badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .badge.active { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    .badge.inactive { background: rgba(107, 107, 141, 0.15); color: #6b6b8d; }

    .actions { display: flex; gap: 6px; }
    .btn-icon { width: 32px; height: 32px; border-radius: 8px; border: none; background: rgba(255, 255, 255, 0.04); cursor: pointer; font-size: 14px; transition: background 0.2s; }
    .btn-icon:hover { background: rgba(255, 255, 255, 0.1); }
    .btn-icon.danger:hover { background: rgba(239, 68, 68, 0.2); }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
    .modal { width: 540px; max-width: 90vw; max-height: 90vh; overflow-y: auto; background: #1a1a3e; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
    .modal-header h2 { font-size: 18px; color: #e0e0f0; margin: 0; font-weight: 600; }
    .modal-close { background: none; border: none; color: #6b6b8d; font-size: 24px; cursor: pointer; }
    .modal-body { padding: 24px; }

    .form-group { margin-bottom: 16px; }
    label { display: block; color: #8b8bae; font-size: 13px; font-weight: 500; margin-bottom: 8px; }
    input[type="text"], input[type="url"], select {
      width: 100%; padding: 10px 14px; background: rgba(15, 15, 35, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px;
      color: #e0e0f0; font-size: 14px; outline: none; box-sizing: border-box;
    }
    select { appearance: auto; }
    input:focus, select:focus { border-color: #667eea; }
    input::placeholder { color: #4a4a6a; }
    .checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    input[type="checkbox"] { accent-color: #667eea; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
  `],
})
export class MappingsComponent implements OnInit {
  mappings: any[] = [];
  products: any[] = [];
  competitors: any[] = [];
  showForm = false;
  editingId: number | null = null;
  saving = false;
  formData: any = { product_id: null, competitor_id: null, url: '', is_active: true };
  strategyFields = { price_selector: '', stock_selector: '', wait_for: '', currency_symbol: '' };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadMappings();
    this.loadDropdowns();
  }

  loadMappings() {
    this.api.getCompetitorProducts({ include_inactive: true }).subscribe((data) => (this.mappings = data));
  }

  loadDropdowns() {
    this.api.getProducts({ limit: 200 }).subscribe((data) => (this.products = data.products));
    this.api.getCompetitors().subscribe((data) => (this.competitors = data));
  }

  openAdd() {
    this.editingId = null;
    this.formData = { product_id: null, competitor_id: null, url: '', is_active: true };
    this.strategyFields = { price_selector: '', stock_selector: '', wait_for: '', currency_symbol: '' };
    this.showForm = true;
  }

  editMapping(m: any) {
    this.editingId = m.id;
    this.formData = { url: m.url, is_active: m.is_active };
    const s = m.strategy_json || {};
    this.strategyFields = {
      price_selector: s.price_selector || '',
      stock_selector: s.stock_selector || '',
      wait_for: s.wait_for || '',
      currency_symbol: s.currency_symbol || '',
    };
    this.showForm = true;
  }

  saveMapping() {
    this.saving = true;

    // Build strategy JSON from fields (omit empty)
    const strategy: any = {};
    if (this.strategyFields.price_selector) strategy.price_selector = this.strategyFields.price_selector;
    if (this.strategyFields.stock_selector) strategy.stock_selector = this.strategyFields.stock_selector;
    if (this.strategyFields.wait_for) strategy.wait_for = this.strategyFields.wait_for;
    if (this.strategyFields.currency_symbol) strategy.currency_symbol = this.strategyFields.currency_symbol;

    const payload: any = {
      ...this.formData,
      strategy_json: Object.keys(strategy).length > 0 ? strategy : null,
    };

    const obs = this.editingId
      ? this.api.updateCompetitorProduct(this.editingId, payload)
      : this.api.createCompetitorProduct(payload);

    obs.subscribe({
      next: () => {
        this.showForm = false;
        this.saving = false;
        this.loadMappings();
      },
      error: () => { this.saving = false; },
    });
  }

  deleteMapping(m: any) {
    if (confirm('Deactivate this mapping?')) {
      this.api.deleteCompetitorProduct(m.id).subscribe(() => this.loadMappings());
    }
  }

  truncate(text: string, len: number): string {
    return text && text.length > len ? text.substring(0, len) + '...' : text;
  }
}
