import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/station-list/station-list.component').then(m => m.StationListComponent)
  },
  {
    path: 'add',
    loadComponent: () => import('./components/station-form/station-form.component').then(m => m.StationFormComponent)
  },
  {
    path: 'station/:name',
    loadComponent: () => import('./components/station-detail/station-detail.component').then(m => m.StationDetailComponent)
  },
  {
    path: 'edit/:name',
    loadComponent: () => import('./components/station-form/station-form.component').then(m => m.StationFormComponent)
  }
];