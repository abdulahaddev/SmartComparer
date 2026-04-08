import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ─── Products ──────────────────────────────────────────
  getProducts(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.apiUrl}/products`, { params: httpParams });
  }

  getProduct(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/products/${id}`);
  }

  getProductPriceHistory(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/products/${id}/price-history`);
  }

  syncProducts(): Observable<any> {
    return this.http.post(`${this.apiUrl}/products/sync`, {});
  }

  // ─── Competitors ───────────────────────────────────────
  getCompetitors(includeInactive = false): Observable<any> {
    return this.http.get(`${this.apiUrl}/competitors`, {
      params: { include_inactive: includeInactive },
    });
  }

  createCompetitor(data: { name: string; base_url: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/competitors`, data);
  }

  updateCompetitor(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/competitors/${id}`, data);
  }

  deleteCompetitor(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/competitors/${id}`);
  }

  // ─── Competitor Products ───────────────────────────────
  getCompetitorProducts(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get(`${this.apiUrl}/competitor-products`, { params: httpParams });
  }

  createCompetitorProduct(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/competitor-products`, data);
  }

  updateCompetitorProduct(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/competitor-products/${id}`, data);
  }

  deleteCompetitorProduct(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/competitor-products/${id}`);
  }

  // ─── Scraping ──────────────────────────────────────────
  triggerScrape(): Observable<any> {
    return this.http.post(`${this.apiUrl}/scrape/run`, {});
  }

  getScrapeRuns(): Observable<any> {
    return this.http.get(`${this.apiUrl}/scrape/runs`);
  }

  getScrapeRun(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/scrape/runs/${id}`);
  }

  getScrapeRunLogs(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/scrape/runs/${id}/logs`);
  }

  // ─── Dashboard ─────────────────────────────────────────
  getDashboardSummary(): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard/summary`);
  }

  getPriceComparison(): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard/price-comparison`);
  }

  // ─── Proxy ─────────────────────────────────────────────
  getProxyPageUrl(url: string): string {
    const token = localStorage.getItem('sc_token');
    return `${this.apiUrl}/proxy/page?url=${encodeURIComponent(url)}&token=${token}`;
  }
}
