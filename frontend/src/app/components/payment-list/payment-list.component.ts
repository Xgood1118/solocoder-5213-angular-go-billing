import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { PaymentService } from '../../services/payment.service';
import { AuthService } from '../../services/auth.service';
import { Payment } from '../../models/models';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-payment-list',
  template: `
    <div class="page-header">
      <h2 class="page-title">还款记录</h2>
      <div>
        <button mat-raised-button color="primary" *ngIf="authService.isFinance()" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon> 登记还款
        </button>
      </div>
    </div>

    <div class="filter-bar">
      <mat-form-field appearance="outline">
        <mat-label>客户ID</mat-label>
        <input matInput [(ngModel)]="filterCustomerId" (keyup.enter)="loadPayments()">
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>还款方式</mat-label>
        <mat-select [(ngModel)]="filterMethod" (selectionChange)="loadPayments()">
          <mat-option value="">全部</mat-option>
          <mat-option value="bank_transfer">银行转账</mat-option>
          <mat-option value="alipay">支付宝</mat-option>
          <mat-option value="wechat">微信</mat-option>
          <mat-option value="cash">现金</mat-option>
          <mat-option value="corporate">对公汇款</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>开始日期</mat-label>
        <input matInput [matDatepicker]="startPicker" [(ngModel)]="filterStartDate" (dateChange)="loadPayments()">
        <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
        <mat-datepicker #startPicker></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>结束日期</mat-label>
        <input matInput [matDatepicker]="endPicker" [(ngModel)]="filterEndDate" (dateChange)="loadPayments()">
        <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
        <mat-datepicker #endPicker></mat-datepicker>
      </mat-form-field>

      <button mat-button (click)="loadPayments()">
        <mat-icon>search</mat-icon> 查询
      </button>

      <button mat-button (click)="resetFilters()">
        <mat-icon>refresh</mat-icon> 重置
      </button>
    </div>

    <div class="table-container mat-elevation-z2">
      <div *ngIf="loading" class="loading-shade">
        <mat-spinner diameter="40"></mat-spinner>
      </div>

      <table mat-table [dataSource]="dataSource" matSort>
        <ng-container matColumnDef="id">
          <th mat-header-cell *matHeaderCellDef>还款ID</th>
          <td mat-cell *matCellDef="let element">{{ element.id }}</td>
        </ng-container>

        <ng-container matColumnDef="customerId">
          <th mat-header-cell *matHeaderCellDef>客户ID</th>
          <td mat-cell *matCellDef="let element">{{ element.customerId }}</td>
        </ng-container>

        <ng-container matColumnDef="paymentTime">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>还款时间</th>
          <td mat-cell *matCellDef="let element">{{ element.paymentTime | date: 'yyyy-MM-dd HH:mm' }}</td>
        </ng-container>

        <ng-container matColumnDef="amount">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>金额</th>
          <td mat-cell *matCellDef="let element" style="color: #4caf50;">
            {{ element.amount | fenToYuan }} 元
          </td>
        </ng-container>

        <ng-container matColumnDef="method">
          <th mat-header-cell *matHeaderCellDef>还款方式</th>
          <td mat-cell *matCellDef="let element">{{ getMethodName(element.method) }}</td>
        </ng-container>

        <ng-container matColumnDef="transactionNo">
          <th mat-header-cell *matHeaderCellDef>流水号</th>
          <td mat-cell *matCellDef="let element">{{ element.transactionNo }}</td>
        </ng-container>

        <ng-container matColumnDef="billIds">
          <th mat-header-cell *matHeaderCellDef>关联账单</th>
          <td mat-cell *matCellDef="let element">
            {{ element.billIds?.length || 0 }} 笔
          </td>
        </ng-container>

        <ng-container matColumnDef="operatorName">
          <th mat-header-cell *matHeaderCellDef>操作人</th>
          <td mat-cell *matCellDef="let element">{{ element.operatorName }}</td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>操作</th>
          <td mat-cell *matCellDef="let element">
            <button mat-icon-button (click)="viewDetail(element)" matTooltip="查看详情">
              <mat-icon>visibility</mat-icon>
            </button>
            <button mat-icon-button *ngIf="authService.isAdmin()" (click)="deletePayment(element)" matTooltip="删除" color="warn">
              <mat-icon>delete</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>

      <mat-paginator 
        [length]="total" 
        [pageSize]="pageSize" 
        [pageIndex]="pageIndex"
        (page)="onPageChange($event)"
        [pageSizeOptions]="[10, 20, 50, 100]">
      </mat-paginator>
    </div>
  `,
  styles: []
})
export class PaymentListComponent implements OnInit {
  displayedColumns: string[] = ['id', 'customerId', 'paymentTime', 'amount', 'method', 'transactionNo', 'billIds', 'operatorName', 'actions'];
  dataSource = new MatTableDataSource<Payment>([]);
  total = 0;
  pageIndex = 0;
  pageSize = 20;
  loading = false;

  filterCustomerId = '';
  filterMethod = '';
  filterStartDate: Date | null = null;
  filterEndDate: Date | null = null;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private paymentService: PaymentService,
    public authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPayments();
  }

  loadPayments(): void {
    this.loading = true;
    this.paymentService.getPayments({
      page: this.pageIndex + 1,
      pageSize: this.pageSize,
      customerId: this.filterCustomerId,
      method: this.filterMethod,
      startDate: this.filterStartDate ? this.formatDate(this.filterStartDate) : undefined,
      endDate: this.filterEndDate ? this.formatDate(this.filterEndDate) : undefined
    }).subscribe({
      next: (result) => {
        this.dataSource.data = result.list;
        this.total = result.total;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadPayments();
  }

  resetFilters(): void {
    this.filterCustomerId = '';
    this.filterMethod = '';
    this.filterStartDate = null;
    this.filterEndDate = null;
    this.pageIndex = 0;
    this.loadPayments();
  }

  getMethodName(method: string): string {
    const map: Record<string, string> = {
      'bank_transfer': '银行转账',
      'alipay': '支付宝',
      'wechat': '微信',
      'cash': '现金',
      'corporate': '对公汇款'
    };
    return map[method] || method;
  }

  viewDetail(payment: Payment): void {
    this.snackBar.open(`还款详情：${payment.id}`, '关闭', { duration: 2000 });
  }

  deletePayment(payment: Payment): void {
    if (confirm(`确定要删除此还款记录吗？`)) {
      this.paymentService.deletePayment(payment.id).subscribe({
        next: () => {
          this.snackBar.open('删除成功', '关闭', { duration: 2000 });
          this.loadPayments();
        },
        error: (err) => {
          this.snackBar.open(err.error?.error || '删除失败', '关闭', { duration: 3000 });
        }
      });
    }
  }

  openCreateDialog(): void {
    this.snackBar.open('功能开发中，请在账单详情页登记还款', '关闭', { duration: 3000 });
  }
}
