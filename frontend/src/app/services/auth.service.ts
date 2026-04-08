import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

interface LoginResponse {
  access_token: string;
  token_type: string;
}

interface UserResponse {
  username: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiUrl;
  private tokenKey = 'sc_token';
  private usernameSubject = new BehaviorSubject<string | null>(null);

  username$ = this.usernameSubject.asObservable();

  constructor(private http: HttpClient) {
    const token = this.getToken();
    if (token) {
      this.loadUser();
    }
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/auth/login`, { username, password })
      .pipe(
        tap((res) => {
          localStorage.setItem(this.tokenKey, res.access_token);
          this.usernameSubject.next(username);
        })
      );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.usernameSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  private loadUser(): void {
    this.http.get<UserResponse>(`${this.apiUrl}/auth/me`).subscribe({
      next: (res) => this.usernameSubject.next(res.username),
      error: () => this.logout(),
    });
  }
}
