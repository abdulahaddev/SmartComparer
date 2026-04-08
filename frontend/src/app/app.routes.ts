import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { LayoutComponent } from './components/layout/layout.component';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ProductsComponent } from './pages/products/products.component';
import { CompetitorsComponent } from './pages/competitors/competitors.component';
import { MappingsComponent } from './pages/mappings/mappings.component';
import { ScrapeRunsComponent } from './pages/scrape-runs/scrape-runs.component';
import { VisualMapperComponent } from './pages/visual-mapper/visual-mapper.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'products', component: ProductsComponent },
      { path: 'competitors', component: CompetitorsComponent },
      { path: 'mappings', component: MappingsComponent },
      { path: 'visual-mapper', component: VisualMapperComponent },
      { path: 'scrape-runs', component: ScrapeRunsComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
