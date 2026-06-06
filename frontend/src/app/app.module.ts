import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AppRoutingModule } from './app-routing.module';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { AuthGuard } from './guards/auth.guard';

import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { CustomerListComponent } from './components/customer-list/customer-list.component';
import { CustomerDetailComponent } from './components/customer-detail/customer-detail.component';
import { CustomerEditDialogComponent } from './components/customer-edit-dialog/customer-edit-dialog.component';
import { BillListComponent, ExportBillDialogComponent } from './components/bill-list/bill-list.component';
import { BillDetailComponent, WaiveLateFeeDialogComponent, MarkExceptionDialogComponent, PaymentCreateDialogComponent } from './components/bill-detail/bill-detail.component';
import { PaymentListComponent } from './components/payment-list/payment-list.component';
import { AuditLogListComponent } from './components/audit-log-list/audit-log-list.component';

import { FenToYuanPipe } from './pipes/fen-to-yuan.pipe';
import { MaskPhonePipe } from './pipes/mask-phone.pipe';
import { MaskIDCardPipe } from './pipes/mask-idcard.pipe';
import { MaskBankCardPipe } from './pipes/mask-bank-card.pipe';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    DashboardComponent,
    CustomerListComponent,
    CustomerDetailComponent,
    CustomerEditDialogComponent,
    BillListComponent,
    ExportBillDialogComponent,
    BillDetailComponent,
    WaiveLateFeeDialogComponent,
    MarkExceptionDialogComponent,
    PaymentCreateDialogComponent,
    PaymentListComponent,
    AuditLogListComponent,
    FenToYuanPipe,
    MaskPhonePipe,
    MaskIDCardPipe,
    MaskBankCardPipe
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    CommonModule,
    AppRoutingModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatDialogModule,
    MatSnackBarModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    MatTooltipModule
  ],
  providers: [
    AuthGuard,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
