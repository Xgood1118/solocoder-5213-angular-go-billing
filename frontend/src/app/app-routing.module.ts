import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { CustomerListComponent } from './components/customer-list/customer-list.component';
import { CustomerDetailComponent } from './components/customer-detail/customer-detail.component';
import { BillListComponent } from './components/bill-list/bill-list.component';
import { BillDetailComponent } from './components/bill-detail/bill-detail.component';
import { PaymentListComponent } from './components/payment-list/payment-list.component';
import { AuditLogListComponent } from './components/audit-log-list/audit-log-list.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { 
    path: '', 
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'customers', component: CustomerListComponent },
      { path: 'customers/:id', component: CustomerDetailComponent },
      { path: 'bills', component: BillListComponent },
      { path: 'bills/:id', component: BillDetailComponent },
      { path: 'payments', component: PaymentListComponent },
      { 
        path: 'audit-logs', 
        component: AuditLogListComponent,
        data: { roles: ['admin'] }
      }
    ]
  },
  { path: '**', redirectTo: '/dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
