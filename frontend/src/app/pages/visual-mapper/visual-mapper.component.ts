import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../services/api.service';

interface ElementAttribute {
  name: string;
  value: string;
}

interface PriceSelection {
  selector: string;
  text: string;
  tagName: string;
  attributes: ElementAttribute[];
  innerHTML: string;
}

@Component({
  selector: 'app-visual-mapper',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <!-- Step 1: Setup Panel -->
      <div class="setup-panel" *ngIf="!iframeUrl">
        <div class="setup-card">
          <div class="setup-header">
            <span class="setup-icon">💰</span>
            <h1>Visual Price Mapper</h1>
            <p class="subtitle">Point and click on competitor price elements to create scraping rules</p>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Select Product</label>
              <select [(ngModel)]="selectedProductId">
                <option [ngValue]="null" disabled>Choose a product...</option>
                <option *ngFor="let p of products" [ngValue]="p.id">{{ p.name }} (₹{{ p.current_price }})</option>
              </select>
            </div>
            <div class="form-group">
              <label>Select Competitor</label>
              <select [(ngModel)]="selectedCompetitorId">
                <option [ngValue]="null" disabled>Choose a competitor...</option>
                <option *ngFor="let c of competitors" [ngValue]="c.id">{{ c.name }}</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Competitor Product URL</label>
            <div class="url-input-row">
              <input type="url" [(ngModel)]="competitorUrl" placeholder="https://competitor.com/product/example" />
              <button class="btn btn-primary" (click)="startMapping()" [disabled]="!canStart">
                🎯 Start Mapping
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Visual Mapping -->
      <div class="mapper-container" *ngIf="iframeUrl">
        <!-- Control Bar -->
        <div class="control-bar">
          <div class="control-left">
            <button class="btn-back" (click)="closeMappingModal()">← Back</button>
            <span class="mapping-title">
              <strong>{{ getProductName() }}</strong> → <strong>{{ getCompetitorName() }}</strong>
            </span>
          </div>
          <div class="control-center">
            <button class="mode-btn"
              [class.active]="currentMode === 'price'"
              [class.done]="priceSelection"
              (click)="setMode('price')">
              <span class="mode-icon">{{ priceSelection ? '✅' : '💰' }}</span>
              {{ priceSelection ? 'Re-select Price' : 'Select Target Element' }}
            </button>
          </div>
          <div class="control-right">
            <button class="btn btn-secondary" *ngIf="priceSelection" (click)="showExtractionModal = true">
              ⚙️ Configure Target
            </button>
          </div>
        </div>

        <!-- Main Content -->
        <div class="mapper-body">
          <!-- Iframe -->
          <div class="iframe-container">
            <div class="loading-overlay" *ngIf="iframeLoading">
              <div class="spinner"></div>
              <p>Loading competitor page...</p>
            </div>
            <iframe #mapperIframe [src]="iframeUrl" (load)="onIframeLoad()" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
          </div>
        </div>
      </div>

      <!-- Extraction Configuration Modal -->
      <div class="modal-overlay" *ngIf="showExtractionModal" (click)="closeExtractionModal()">
        <div class="config-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Extraction Configuration</h2>
            <button class="modal-close" (click)="closeExtractionModal()">×</button>
          </div>

          <div class="modal-body" *ngIf="priceSelection">
            <!-- Raw captured data -->
            <div class="field-card">
              <div class="field-header">
                <span class="field-label">📍 Target Element</span>
              </div>
              <div class="captured-tag">&lt;{{ priceSelection.tagName.toLowerCase() }}&gt;</div>
              <div class="captured-text">{{ priceSelection.text }}</div>
              <div class="captured-selector">
                <code>{{ priceSelection.selector }}</code>
              </div>
            </div>

            <!-- Extraction Mode -->
            <div class="config-section">
              <div class="section-header">
                <h4>Extraction Source</h4>
                <p class="config-hint">Select where the price value should be extracted from</p>
              </div>

              <div class="mode-cards">
                <!-- Text Content Card -->
                <div class="mode-card" 
                  [class.active]="extractionMode === 'text'"
                  (click)="extractionMode = 'text'; onExtractionChange()">
                  <div class="card-icon">📝</div>
                  <div class="card-content">
                    <div class="card-title">Text Content</div>
                    <div class="card-desc">{{ priceSelection.text }}</div>
                  </div>
                  <div class="card-check" *ngIf="extractionMode === 'text'">✓</div>
                </div>

                <!-- Attribute Cards -->
                <div class="mode-card" 
                  *ngFor="let attr of numericAttributes"
                  [class.active]="extractionMode === 'attribute' && selectedAttribute === attr.name"
                  (click)="extractionMode = 'attribute'; selectedAttribute = attr.name; onExtractionChange()">
                  <div class="card-icon">🏷️</div>
                  <div class="card-content">
                    <div class="card-title">Attr: {{ attr.name }}</div>
                    <div class="card-desc">{{ attr.value }}</div>
                  </div>
                  <div class="card-check" *ngIf="extractionMode === 'attribute' && selectedAttribute === attr.name">✓</div>
                </div>
              </div>

              <!-- Manual attribute if no numeric ones detected -->
              <div class="attr-manual" *ngIf="extractionMode === 'attribute' && numericAttributes.length === 0">
                <label>Attribute name:</label>
                <select [(ngModel)]="selectedAttribute" (change)="onExtractionChange()">
                  <option *ngFor="let a of priceSelection.attributes" [value]="a.name">{{ a.name }} = "{{ a.value }}"</option>
                </select>
              </div>
            </div>

            <!-- Characters to Remove -->
            <div class="config-section" *ngIf="extractionMode === 'text'">
              <h4>Remove Characters (Pricing)</h4>
              <p class="config-hint">Click to toggle characters that should be stripped for clean numeric extraction</p>
              <div class="char-chips">
                <button *ngFor="let ch of detectedChars" class="chip"
                  [class.active]="removeChars.has(ch.char)"
                  (click)="toggleChar(ch.char)">
                  {{ ch.label }}
                </button>
              </div>
              <div class="custom-char-row">
                <input type="text" [(ngModel)]="customCharInput" placeholder="Add custom..." maxlength="10" />
                <button class="btn-xs add" (click)="addCustomChar()" *ngIf="customCharInput">+ Add</button>
              </div>
            </div>

            <!-- Live Preview -->
            <div class="preview-section">
              <h4>Validation Preview</h4>
              <div class="preview-row">
                <span class="preview-label">Raw value:</span>
                <span class="preview-raw">{{ rawValue }}</span>
              </div>
              <div class="preview-row final">
                <span class="preview-label">Cleaned result:</span>
                <span class="preview-value" [class.valid]="cleanedPrice" [class.invalid]="!cleanedPrice">
                  {{ cleanedPrice || 'Cannot parse number' }}
                </span>
              </div>
            </div>

            <!-- Save success -->
            <div class="save-success" *ngIf="savedSuccess">
              ✅ Mapping saved successfully!
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeExtractionModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveMapping()" [disabled]="!cleanedPrice || saving">
              {{ saving ? 'Saving...' : '💾 Confirm & Save Mapping' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { height: calc(100vh - 64px); display: flex; flex-direction: column; }

    /* ─── Setup ────────────────────────────── */
    .setup-panel { display: flex; align-items: center; justify-content: center; flex: 1; padding: 32px; }
    .setup-card {
      width: 680px; max-width: 100%; padding: 40px;
      background: rgba(26, 26, 62, 0.7); border: 1px solid rgba(255,255,255,0.06);
      border-radius: 20px; backdrop-filter: blur(10px);
    }
    .setup-header { text-align: center; margin-bottom: 32px; }
    .setup-icon { font-size: 48px; display: block; margin-bottom: 12px; }
    h1 { font-size: 28px; font-weight: 700; color: #e0e0f0; margin: 0 0 8px; }
    .subtitle { color: #6b6b8d; font-size: 14px; margin: 0; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { margin-bottom: 20px; }
    label { display: block; color: #8b8bae; font-size: 13px; font-weight: 500; margin-bottom: 8px; }
    input, select {
      width: 100%; padding: 12px 16px; background: rgba(15,15,35,0.6);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
      color: #e0e0f0; font-size: 14px; outline: none; box-sizing: border-box;
    }
    input:focus, select:focus { border-color: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.1); }
    input::placeholder { color: #4a4a6a; }
    select { appearance: auto; }
    .url-input-row { display: flex; gap: 12px; }
    .url-input-row input { flex: 1; }
    .btn { padding: 12px 24px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
    .btn-primary { background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff; box-shadow: 0 4px 15px rgba(34,197,94,0.3); }
    .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 25px rgba(34,197,94,0.4); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-secondary { background: rgba(255, 255, 255, 0.06); color: #8b8bae; border: 1px solid rgba(255, 255, 255, 0.08); }
    .btn-secondary:hover:not(:disabled) { background: rgba(255, 255, 255, 0.1); color: #e0e0f0; }

    /* ─── Mapper Container ─────────────────── */
    .mapper-container { display: flex; flex-direction: column; height: calc(100vh - 64px); }
    .control-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 20px; background: rgba(26,26,62,0.95);
      border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; gap: 16px;
    }
    .control-left { display: flex; align-items: center; gap: 16px; min-width: 0; }
    .control-center { display: flex; gap: 8px; }
    .control-right { display: flex; gap: 8px; }
    .btn-back {
      padding: 8px 16px; background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
      color: #8b8bae; font-size: 13px; cursor: pointer; transition: all 0.2s;
    }
    .btn-back:hover { background: rgba(255,255,255,0.1); color: #e0e0f0; }
    .mapping-title { color: #6b6b8d; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mapping-title strong { color: #c4c4e0; }

    .mode-btn {
      padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px;
      background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); color: #22c55e;
    }
    .mode-btn:hover { background: rgba(34,197,94,0.15); }
    .mode-btn.active {
      background: linear-gradient(135deg, rgba(34,197,94,0.25), rgba(22,163,74,0.25));
      border-color: #22c55e; color: #fff;
      box-shadow: 0 0 15px rgba(34,197,94,0.3);
      animation: glowPulse 2s ease-in-out infinite;
    }
    .mode-btn.done { border-color: rgba(255,255,255,0.2); color: #e0e0f0; background: rgba(255,255,255,0.05); }
    @keyframes glowPulse {
      0%, 100% { box-shadow: 0 0 12px rgba(34,197,94,0.2); }
      50% { box-shadow: 0 0 24px rgba(34,197,94,0.4); }
    }

    /* ─── Body ─────────────────────────────── */
    .mapper-body { display: flex; flex: 1; overflow: hidden; }
    .iframe-container {
      flex: 1; position: relative; background: #fff;
    }
    iframe { width: 100%; height: 100%; border: none; }
    .loading-overlay {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 16px;
      background: rgba(15,15,35,0.9); z-index: 10;
    }
    .spinner {
      width: 40px; height: 40px; border-radius: 50%;
      border: 3px solid rgba(34,197,94,0.2); border-top-color: #22c55e;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-overlay p { color: #6b6b8d; font-size: 14px; }

    /* ─── Modal ────────────────────────────── */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7);
      display: flex; align-items: center; justify-content: center; z-index: 1000000;
      backdrop-filter: blur(4px);
    }
    .config-modal {
      width: 520px; max-width: 90vw; max-height: 90vh; overflow-y: auto;
      background: #1a1a3e; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .modal-header h2 { font-size: 16px; color: #e0e0f0; margin: 0; font-weight: 600; }
    .modal-close { background: none; border: none; color: #6b6b8d; font-size: 24px; cursor: pointer; transition: color 0.1s; }
    .modal-close:hover { color: #e0e0f0; }
    .modal-body { padding: 20px 24px; }
    .modal-footer {
      padding: 16px 24px; border-top: 1px solid rgba(255, 255, 255, 0.06);
      display: flex; justify-content: flex-end; gap: 12px; background: rgba(15,15,35,0.4);
    }

    h4 { font-size: 12px; color: #6b6b8d; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px; font-weight: 600; }

    .field-card {
      background: rgba(15,15,35,0.4); border: 1px solid rgba(34,197,94,0.15);
      border-radius: 12px; padding: 14px; margin-bottom: 16px;
    }
    .field-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .field-label { font-size: 13px; font-weight: 600; color: #c4c4e0; }
    .btn-xs {
      padding: 3px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;
      background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #ef4444;
      transition: all 0.2s;
    }
    .btn-xs.add { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.2); color: #22c55e; }

    .captured-tag { font-size: 11px; color: #667eea; font-family: 'JetBrains Mono', monospace; margin-bottom: 6px; }
    .captured-text {
      padding: 8px 12px; background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.15);
      border-radius: 8px; color: #22c55e; font-size: 13px; font-weight: 500;
      margin-bottom: 8px; word-break: break-word; line-height: 1.4;
    }
    .captured-selector code { background: rgba(0,0,0,0.2); padding: 2px 4px; border-radius: 4px; color: #888; font-size: 11px; }

    .config-section { margin-bottom: 20px; padding: 18px; background: rgba(15,15,35,0.4); border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); }
    .section-header { margin-bottom: 12px; }
    .config-hint { color: #6b6b8d; font-size: 11px; margin: 4px 0 0; }

    .mode-cards { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .mode-card {
      display: flex; align-items: center; gap: 14px; padding: 14px 18px;
      background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative; overflow: hidden;
    }
    .mode-card:hover { background: rgba(255, 255, 255, 0.05); border-color: rgba(34, 197, 94, 0.3); transform: translateY(-1px); }
    .mode-card.active {
      background: rgba(34, 197, 94, 0.08); border-color: #22c55e;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.15);
    }
    .card-icon {
      width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
      background: rgba(255, 255, 255, 0.05); border-radius: 10px; font-size: 20px;
    }
    .active .card-icon { background: rgba(34, 197, 94, 0.15); }
    .card-content { flex: 1; min-width: 0; }
    .card-title { font-size: 14px; font-weight: 600; color: #e0e0f0; margin-bottom: 2px; }
    .card-desc {
      font-size: 12px; color: #6b6b8d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      font-family: 'JetBrains Mono', monospace;
    }
    .active .card-desc { color: #22c55e; }
    .card-check {
      width: 20px; height: 20px; background: #22c55e; color: #fff;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: bold;
    }
 .radio-content { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .radio-content strong { font-size: 13px; color: #c4c4e0; }
    .radio-desc {
      font-size: 11px; color: #6b6b8d; word-break: break-all;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 350px;
    }

    .attr-manual { margin-top: 10px; }
    .attr-manual select { font-size: 12px; padding: 8px; }

    /* ─── Char chips ───────────────────────── */
    .char-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .chip {
      padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 500;
      cursor: pointer; transition: all 0.15s; font-family: 'JetBrains Mono', monospace;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #6b6b8d;
    }
    .chip:hover { border-color: rgba(34,197,94,0.3); color: #c4c4e0; }
    .chip.active { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.3); color: #22c55e; }
    .custom-char-row { display: flex; gap: 6px; }
    .custom-char-row input { flex: 1; padding: 6px 10px; font-size: 12px; border-radius: 6px; }

    /* ─── Preview ──────────────────────────── */
    .preview-section {
      padding: 14px; border-radius: 12px;
      background: rgba(15,15,35,0.4); border: 1px solid rgba(255,255,255,0.04);
    }
    .preview-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; }
    .preview-row.final { border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px; margin-top: 6px; }
    .preview-label { font-size: 12px; color: #6b6b8d; }
    .preview-raw { font-size: 12px; color: #8b8bae; font-family: 'JetBrains Mono', monospace; word-break: break-all; max-width: 250px; text-align: right; }
    .preview-value { font-size: 20px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
    .preview-value.valid { color: #22c55e; }
    .preview-value.invalid { color: #ef4444; font-size: 12px; font-weight: 400; }

    .save-success {
      margin-top: 16px; padding: 12px 16px; background: rgba(34,197,94,0.1);
      border: 1px solid rgba(34,197,94,0.2); border-radius: 10px;
      color: #22c55e; font-size: 14px; font-weight: 500; text-align: center;
    }
  `],
})
export class VisualMapperComponent implements OnInit, OnDestroy {
  @ViewChild('mapperIframe') iframeRef!: ElementRef<HTMLIFrameElement>;

  private api = inject(ApiService);
  private sanitizer = inject(DomSanitizer);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Setup form
  products: any[] = [];
  competitors: any[] = [];
  selectedProductId: number | null = null;
  selectedCompetitorId: number | null = null;
  competitorUrl = '';

  // Mapping state
  iframeUrl: SafeResourceUrl | null = null;
  iframeLoading = true;
  currentMode: string | null = null;
  priceSelection: PriceSelection | null = null;
  showExtractionModal = false;

  // Extraction config
  extractionMode: 'text' | 'attribute' = 'text';
  selectedAttribute = '';
  numericAttributes: ElementAttribute[] = [];
  detectedChars: { char: string; label: string }[] = [];
  removeChars: Set<string> = new Set();
  customCharInput = '';

  // Preview
  rawValue = '';
  cleanedPrice = '';

  // Save
  saving = false;
  savedSuccess = false;
  existingMappingId: number | null = null;

  private messageListener: ((e: MessageEvent) => void) | null = null;

  get canStart(): boolean {
    return !!this.selectedProductId && !!this.selectedCompetitorId && !!this.competitorUrl;
  }

  ngOnInit() {
    this.loadDropdowns();
    this.setupMessageListener();

    this.route.queryParams.subscribe((params) => {
      if (params['product_id']) this.selectedProductId = +params['product_id'];
      if (params['competitor_id']) this.selectedCompetitorId = +params['competitor_id'];
      if (params['url']) this.competitorUrl = params['url'];
    });
  }

  ngOnDestroy() {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
    }
  }

  loadDropdowns() {
    this.api.getProducts({ limit: 500 }).subscribe((data) => (this.products = data.products));
    this.api.getCompetitors().subscribe((data) => (this.competitors = data));
  }

  startMapping() {
    if (!this.canStart) return;
    const proxyUrl = this.api.getProxyPageUrl(this.competitorUrl);
    this.iframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(proxyUrl);
    this.iframeLoading = true;
    this.priceSelection = null;
    this.currentMode = null;
    this.savedSuccess = false;
    this.showExtractionModal = false;
    this.extractionMode = 'text';
    this.removeChars = new Set();

    // Check existing mapping
    this.api.getCompetitorProducts({
      product_id: this.selectedProductId,
      competitor_id: this.selectedCompetitorId,
      include_inactive: true,
    }).subscribe((mappings) => {
      if (mappings.length > 0) {
        this.existingMappingId = mappings[0].id;
        const strategy = mappings[0].strategy_json;
        if (strategy) {
          if (strategy.price_attribute && strategy.price_attribute !== 'textContent') {
            this.extractionMode = 'attribute';
            this.selectedAttribute = strategy.price_attribute;
          }
          if (strategy.remove_chars) {
            this.removeChars = new Set(strategy.remove_chars);
          }
        }
      }
    });
  }

  closeMappingModal() {
    this.iframeUrl = null;
    this.currentMode = null;
  }

  onIframeLoad() {
    this.iframeLoading = false;
  }

  setMode(mode: string | null) {
    if (this.currentMode === mode) {
      // Toggle off
      this.currentMode = null;
    } else {
      this.currentMode = mode;
      this.priceSelection = null; // Clear previous state to force new selection mapping
    }
    this.sendToIframe({ type: 'sc-set-mode', mode: this.currentMode });
  }

  closeExtractionModal() {
    this.showExtractionModal = false;
  }

  getProductName(): string {
    return this.products.find((x) => x.id === this.selectedProductId)?.name || '';
  }

  getCompetitorName(): string {
    return this.competitors.find((x) => x.id === this.selectedCompetitorId)?.name || '';
  }

  // ─── Extraction Logic ─────────────────────────────────────

  onExtractionChange() {
    this.updatePreview();
  }

  toggleChar(char: string) {
    if (this.removeChars.has(char)) {
      this.removeChars.delete(char);
    } else {
      this.removeChars.add(char);
    }
    this.updatePreview();
  }

  addCustomChar() {
    if (this.customCharInput) {
      for (const ch of this.customCharInput) {
        this.removeChars.add(ch);
        if (!this.detectedChars.find(d => d.char === ch)) {
          this.detectedChars.push({ char: ch, label: ch });
        }
      }
      this.customCharInput = '';
      this.updatePreview();
    }
  }

  private analyzeElement(sel: PriceSelection) {
    // Find attributes that look numeric (potential price sources)
    this.numericAttributes = sel.attributes.filter(a => {
      const val = a.value.trim();
      return /^\d[\d,.\s]*$/.test(val) && a.name !== 'class' && a.name !== 'style';
    });

    // Auto-select attribute mode if a numeric attribute exists
    if (this.numericAttributes.length > 0) {
      this.selectedAttribute = this.numericAttributes[0].name;
    }

    // Detect non-numeric characters in text content for the chip strip
    this.detectedChars = [];
    const text = sel.text;
    const nonNumeric = new Set<string>();

    for (const ch of text) {
      if (!/[\d.,]/.test(ch)) {
        nonNumeric.add(ch);
      }
    }

    // Build labeled char chips
    const labelMap: { [key: string]: string } = {
      '৳': '৳ (Taka)',
      '$': '$ (Dollar)',
      '€': '€ (Euro)',
      '£': '£ (Pound)',
      '¥': '¥ (Yen)',
      '₹': '₹ (Rupee)',
      ' ': 'space',
      '\u00a0': 'nbsp',
    };

    for (const ch of nonNumeric) {
      if (ch === '\n' || ch === '\r' || ch === '\t') continue;
      this.detectedChars.push({
        char: ch,
        label: labelMap[ch] || (ch.trim() === '' ? 'whitespace' : ch),
      });
    }

    // Also add common ones if present in text
    const commonCurrency = ['৳', 'BDT', 'Tk', '$', '€', '£', '₹'];
    for (const curr of commonCurrency) {
      if (text.includes(curr) && !this.detectedChars.find(d => d.char === curr)) {
        this.detectedChars.push({
          char: curr,
          label: labelMap[curr] || curr,
        });
      }
    }

    // Auto-enable removal for currency symbols and whitespace
    for (const d of this.detectedChars) {
      if (d.char !== ',' && d.char !== '.') {
        this.removeChars.add(d.char);
      }
    }

    this.updatePreview();
  }

  private updatePreview() {
    if (!this.priceSelection) {
      this.rawValue = '';
      this.cleanedPrice = '';
      return;
    }

    // Determine raw value
    if (this.extractionMode === 'attribute' && this.selectedAttribute) {
      const attr = this.priceSelection.attributes.find(a => a.name === this.selectedAttribute);
      this.rawValue = attr?.value || '';
    } else {
      this.rawValue = this.priceSelection.text;
    }

    // Clean the value
    let cleaned = this.rawValue;

    if (this.extractionMode === 'text') {
      for (const ch of this.removeChars) {
        cleaned = cleaned.split(ch).join('');
      }
    }

    // Remove commas if they look like thousand separators
    const commaCount = (cleaned.match(/,/g) || []).length;
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (commaCount > 0 && dotCount > 0) {
      cleaned = cleaned.replace(/,/g, '');
    } else if (commaCount === 1 && dotCount === 0) {
      const afterComma = cleaned.split(',')[1];
      if (afterComma && afterComma.length <= 2) {
        cleaned = cleaned.replace(',', '.');
      } else {
        cleaned = cleaned.replace(',', '');
      }
    } else if (commaCount > 0) {
      cleaned = cleaned.replace(/,/g, '');
    }

    // Strip remaining non-numeric except . and -
    cleaned = cleaned.replace(/[^\d.\-]/g, '').trim();

    // Validate as number
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 0) {
      this.cleanedPrice = num.toFixed(2);
    } else {
      this.cleanedPrice = '';
    }
  }

  getStrategyJson(): any {
    if (!this.priceSelection) return {};
    const strategy: any = {
      price_selector: this.priceSelection.selector,
      wait_for: this.priceSelection.selector,
    };
    if (this.extractionMode === 'attribute' && this.selectedAttribute) {
      strategy.price_attribute = this.selectedAttribute;
    } else {
      strategy.price_attribute = 'textContent';
    }
    if (this.removeChars.size > 0 && this.extractionMode === 'text') {
      strategy.remove_chars = Array.from(this.removeChars);
    }
    return strategy;
  }

  saveMapping() {
    if (!this.priceSelection || !this.cleanedPrice) return;
    this.saving = true;
    this.savedSuccess = false;

    const payload: any = {
      url: this.competitorUrl,
      strategy_json: this.getStrategyJson(),
    };

    if (this.existingMappingId) {
      this.api.updateCompetitorProduct(this.existingMappingId, payload).subscribe({
        next: () => { 
          this.saving = false; 
          this.savedSuccess = true;
          setTimeout(() => this.showExtractionModal = false, 1500);
        },
        error: () => { this.saving = false; },
      });
    } else {
      payload.product_id = this.selectedProductId;
      payload.competitor_id = this.selectedCompetitorId;
      this.api.createCompetitorProduct(payload).subscribe({
        next: (result) => {
          this.saving = false;
          this.savedSuccess = true;
          this.existingMappingId = result.id;
          setTimeout(() => this.showExtractionModal = false, 1500);
        },
        error: () => { this.saving = false; },
      });
    }
  }

  // ─── Iframe Communication ──────────────────────────────────

  private sendToIframe(data: any) {
    try {
      const iframe = this.iframeRef?.nativeElement;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(data, '*');
      }
    } catch (e) {
      console.warn('Failed to send message to iframe:', e);
    }
  }

  private setupMessageListener() {
    this.messageListener = (event: MessageEvent) => {
      const data = event.data;
      if (!data || !data.type) return;

      if (data.type === 'sc-element-selected') {
        this.priceSelection = {
          selector: data.selector,
          text: data.text,
          tagName: data.tagName,
          attributes: data.attributes || [],
          innerHTML: data.innerHTML || '',
        };
        this.currentMode = null; // Turn off selection mode
        this.analyzeElement(this.priceSelection);
        this.showExtractionModal = true; // POP UP THE MODAL
        this.cdr.detectChanges();
      }

      if (data.type === 'sc-ready') {
        if (this.currentMode) {
          this.sendToIframe({ type: 'sc-set-mode', mode: this.currentMode });
        }
      }
    };
    window.addEventListener('message', this.messageListener);
  }
}
