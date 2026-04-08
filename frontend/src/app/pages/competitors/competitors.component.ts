import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-competitors',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Competitors</h1>
          <p class="subtitle">Manage competitor stores you want to track</p>
        </div>
        <button class="btn btn-primary" (click)="showForm = true; resetForm()">+ Add Competitor</button>
      </div>

      <!-- Competitor Cards -->
      <div class="grid">
        <div class="comp-card" *ngFor="let c of competitors">
          <div class="comp-header">
            <div class="comp-icon">🏪</div>
            <div>
              <h3>{{ c.name }}</h3>
              <a [href]="c.base_url" target="_blank" class="comp-url">{{ c.base_url }}</a>
            </div>
          </div>
          <div class="comp-footer">
            <span class="badge" [ngClass]="c.is_active ? 'active' : 'inactive'">
              {{ c.is_active ? 'Active' : 'Inactive' }}
            </span>
            <div class="comp-actions">
              <button class="btn-icon" (click)="editCompetitor(c)" title="Edit">✏️</button>
              <button class="btn-icon danger" (click)="deleteCompetitor(c)" title="Deactivate">🗑️</button>
            </div>
          </div>
        </div>
        <div class="comp-card empty-card" *ngIf="competitors.length === 0">
          <p>No competitors added yet. Click "Add Competitor" to get started.</p>
        </div>
      </div>

      <!-- Add/Edit Modal -->
      <div class="modal-overlay" *ngIf="showForm" (click)="showForm = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingId ? 'Edit Competitor' : 'Add Competitor' }}</h2>
            <button class="modal-close" (click)="showForm = false">×</button>
          </div>
          <div class="modal-body">
            <form (ngSubmit)="saveCompetitor()">
              <div class="form-group">
                <label>Name</label>
                <input type="text" [(ngModel)]="formData.name" name="name" placeholder="e.g. Daraz BD" required />
              </div>
              <div class="form-group">
                <label>Base URL</label>
                <input type="url" [(ngModel)]="formData.base_url" name="base_url" placeholder="https://www.daraz.com.bd" required />
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
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }

    .comp-card {
      background: rgba(26, 26, 62, 0.6); border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px; padding: 20px; transition: transform 0.2s, box-shadow 0.2s;
    }
    .comp-card:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3); }
    .empty-card { display: flex; align-items: center; justify-content: center; }
    .empty-card p { color: #6b6b8d; font-size: 14px; }

    .comp-header { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 16px; }
    .comp-icon { font-size: 32px; }
    h3 { font-size: 16px; font-weight: 600; color: #e0e0f0; margin: 0 0 4px; }
    .comp-url { color: #667eea; font-size: 13px; text-decoration: none; word-break: break-all; }
    .comp-url:hover { text-decoration: underline; }

    .comp-footer { display: flex; justify-content: space-between; align-items: center; }
    .comp-actions { display: flex; gap: 8px; }
    .btn-icon {
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: rgba(255, 255, 255, 0.04); cursor: pointer; font-size: 14px;
      transition: background 0.2s;
    }
    .btn-icon:hover { background: rgba(255, 255, 255, 0.1); }
    .btn-icon.danger:hover { background: rgba(239, 68, 68, 0.2); }

    .badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .badge.active { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    .badge.inactive { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
    .modal { width: 480px; max-width: 90vw; background: #1a1a3e; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
    .modal-header h2 { font-size: 18px; color: #e0e0f0; margin: 0; font-weight: 600; }
    .modal-close { background: none; border: none; color: #6b6b8d; font-size: 24px; cursor: pointer; }
    .modal-body { padding: 24px; }

    .form-group { margin-bottom: 18px; }
    label { display: block; color: #8b8bae; font-size: 13px; font-weight: 500; margin-bottom: 8px; }
    input[type="text"], input[type="url"] {
      width: 100%; padding: 10px 14px; background: rgba(15, 15, 35, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px;
      color: #e0e0f0; font-size: 14px; outline: none; box-sizing: border-box;
    }
    input:focus { border-color: #667eea; }
    input::placeholder { color: #4a4a6a; }

    .checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    input[type="checkbox"] { accent-color: #667eea; }

    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
  `],
})
export class CompetitorsComponent implements OnInit {
  competitors: any[] = [];
  showForm = false;
  editingId: number | null = null;
  saving = false;
  formData = { name: '', base_url: '', is_active: true };

  constructor(private api: ApiService) {}

  ngOnInit() { this.loadCompetitors(); }

  loadCompetitors() {
    this.api.getCompetitors(true).subscribe((data) => (this.competitors = data));
  }

  resetForm() {
    this.editingId = null;
    this.formData = { name: '', base_url: '', is_active: true };
  }

  editCompetitor(c: any) {
    this.editingId = c.id;
    this.formData = { name: c.name, base_url: c.base_url, is_active: c.is_active };
    this.showForm = true;
  }

  saveCompetitor() {
    this.saving = true;
    const obs = this.editingId
      ? this.api.updateCompetitor(this.editingId, this.formData)
      : this.api.createCompetitor(this.formData);

    obs.subscribe({
      next: () => {
        this.showForm = false;
        this.saving = false;
        this.loadCompetitors();
      },
      error: () => { this.saving = false; },
    });
  }

  deleteCompetitor(c: any) {
    if (confirm(`Deactivate competitor "${c.name}"?`)) {
      this.api.deleteCompetitor(c.id).subscribe(() => this.loadCompetitors());
    }
  }
}
