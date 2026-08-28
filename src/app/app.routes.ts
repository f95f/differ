import { Routes } from '@angular/router';
import { Differ } from './differ/differ';
import { Home } from './home/home';
import { Indenter } from './indenter/indenter';

export const routes: Routes = [
  {
    path: '',
    component: Home,
  },
  {
    path: 'differ',
    component: Differ,
  },
  {
    path: 'indenter',
    component: Indenter,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
