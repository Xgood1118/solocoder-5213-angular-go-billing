import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { BillService } from '../../services/bill.service';
import { AuthService } from '../../services/auth.service';
import { Bill, BillExportColumn } from '../../models/models';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-bill-list',
  template: `
    <div class="page-header">
      <h2 class="page-title">账单管理</h2>
      <div>
        <button mat-raised-button (click)="openExportDialog()" style="margin-right: 8px;">
          <mat-icon>download</mat-icon> 导出CSV
        </button>
        <button mat-raised-button (click)="exportStatement()" style="margin-right: 8px;">
          <mat-icon>description</mat-icon> 对账单
        </button>
        <button mat-raised-button color="primary" *ngIf="authService.isFinance()" (click)="createBill()">
          <mat-icon>add</mat-icon> 新增账单
        </button>
      </div>
    </div>

    <div class="filter-bar">
      <mat-form-field appearance="outline">
        <mat-label>客户ID</mat-label>
        <input matInput [(ngModel)]="filterCustomerId" (keyup.enter)="loadBills()">
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>状态</mat-label>
        <mat-select [(ngModel)]="filterStatus" (selectionChange)="loadBills()">
          <mat-option value="">全部</mat-option>
          <mat-option value="pending">待出账</mat-option>
          <mat-option value="issued">已出账</mat-option>
          <mat-option value="partial">部分还款</mat-option>
          <mat-option value="paid">已结清</mat-option>
          <mat-option value="overdue">逾期</mat-option>
          <mat-option value="void">作废</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>年份</mat-label>
        <mat-select [(ngModel)]="filterYear" (selectionChange)="loadBills()">
          <mat-option value="">全部</mat-option>
          <mat-option *ngFor="let y of years" [value]="y">{{ y }}年</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>月份</mat-label>
        <mat-select [(ngModel)]="filterMonth" (selectionChange)="loadBills()">
          <mat-option value="">全部</mat-option>
          <mat-option *ngFor="let m of months" [value]="m">{{ m }}月</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>异常状态</mat-label>
        <mat-select [(ngModel)]="filterException" (selectionChange)="loadBills()">
          <mat-option value="">全部</mat-option>
          <mat-option value="true">异常</mat-option>
          <mat-option value="false">正常</mat-option>
        </mat-select>
      </mat-form-field>

      <button mat-button (click)="loadBills()">
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
          <th mat-header-cell *matHeaderCellDef>账单ID</th>
          <td mat-cell *matCellDef="let element">{{ element.id }}</td>
        </ng-container>

        <ng-container matColumnDef="customerId">
          <th mat-header-cell *matHeaderCellDef>客户ID</th>
          <td mat-cell *matCellDef="let element">{{ element.customerId }}</td>
        </ng-container>

        <ng-container matColumnDef="period">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>账期</th>
          <td mat-cell *matCellDef="let element">{{ element.periodYear }}年{{ element.periodMonth }}月</td>
        </ng-container>

        <ng-container matColumnDef="dueAmount">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>应还金额</th>
          <td mat-cell *matCellDef="let element">{{ element.dueAmount | fenToYuan }} 元</td>
        </ng-container>

        <ng-container matColumnDef="paidAmount">
          <th mat-header-cell *matHeaderCellDef>已还金额</th>
          <td mat-cell *matCellDef="let element">{{ element.paidAmount | fenToYuan }} 元</td>
        </ng-container>

        <ng-container matColumnDef="unpaidAmount">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>未还金额</th>
          <td mat-cell *matCellDef="let element" [ngClass]="{'warning-red': element.unpaidAmount > 0}">
            {{ element.unpaidAmount | fenToYuan }} 元
          </td>
        </ng-container>

        <ng-container matColumnDef="lateFee">
          <th mat-header-cell *matHeaderCellDef>滞纳金</th>
          <td mat-cell *matCellDef="let element" [ngClass]="{'warning-red': element.lateFee > 0}">
            {{ element.lateFee | fenToYuan }} 元
          </td>
        </ng-container>

        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>状态</th>
          <td mat-cell *matCellDef="let element">
            <span class="status-badge" [ngClass]="'status-' + element.status">
              {{ getStatusName(element.status) }}
            </span>
            <span *ngIf="element.isException" class="status-badge status-exception" style="margin-left: 4px;">异常</span>
          </td>
        </ng-container>

        <ng-container matColumnDef="generatedAt">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>生成时间</th>
          <td mat-cell *matCellDef="let element">{{ element.generatedAt | date: 'yyyy-MM-dd' }}</td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>操作</th>
          <td mat-cell *matCellDef="let element">
            <button mat-icon-button (click)="goToDetail(element.id)" matTooltip="查看详情">
              <mat-icon>visibility</mat-icon>
            </button>
            <button mat-icon-button *ngIf="authService.isFinance() && element.status === 'pending'" 
                    (click)="issueBill(element)" matTooltip="出账">
              <mat-icon>check_circle</mat-icon>
            </button>
            <button mat-icon-button *ngIf="authService.isAdmin() && element.status !== 'void' && element.status !== 'paid'" 
                    (click)="voidBill(element)" matTooltip="作废" color="warn">
              <mat-icon>cancel</mat-icon>
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
export class BillListComponent implements OnInit {
  displayedColumns: string[] = ['id', 'customerId', 'period', 'dueAmount', 'paidAmount', 'unpaidAmount', 'lateFee', 'status', 'generatedAt', 'actions'];
  dataSource = new MatTableDataSource<Bill>([]);
  total = 0;
  pageIndex = 0;
  pageSize = 20;
  loading = false;

  filterCustomerId = '';
  filterStatus = '';
  filterYear = '';
  filterMonth = '';
  filterException = '';

  years = [2024, 2025, 2026];
  months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  exportColumns: BillExportColumn[] = [];

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private billService: BillService,
    public authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadBills();
    this.loadExportColumns();
  }

  loadBills(): void {
    this.loading = true;
    this.billService.getBills({
      page: this.pageIndex + 1,
      pageSize: this.pageSize,
      customerId: this.filterCustomerId,
      status: this.filterStatus,
      periodYear: this.filterYear ? +this.filterYear : undefined,
      periodMonth: this.filterMonth ? +this.filterMonth : undefined,
      isException: this.filterException || undefined
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

  loadExportColumns(): void {
    this.billService.getExportColumns().subscribe({
      next: (cols) => {
        this.exportColumns = cols;
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadBills();
  }

  resetFilters(): void {
    this.filterCustomerId = '';
    this.filterStatus = '';
    this.filterYear = '';
    this.filterMonth = '';
    this.filterException = '';
    this.pageIndex = 0;
    this.loadBills();
  }

  getStatusName(status: string): string {
    const map: Record<string, string> = {
      'pending': '待出账',
      'issued': '已出账',
      'partial': '部分还款',
      'paid': '已结清',
      'overdue': '逾期',
      'void': '作废'
    };
    return map[status] || status;
  }

  goToDetail(id: string): void {
    this.router.navigate(['/bills', id]);
  }

  createBill(): void {
    this.snackBar.open('功能开发中', '关闭', { duration: 2000 });
  }

  issueBill(bill: Bill): void {
    if (confirm('确定要出账吗？')) {
      this.billService.issueBill(bill.id).subscribe({
        next: () => {
          this.snackBar.open('出账成功', '关闭', { duration: 2000 });
          this.loadBills();
        },
        error: (err) => {
          this.snackBar.open(err.error?.error || '操作失败', '关闭', { duration: 3000 });
        }
      });
    }
  }

  voidBill(bill: Bill): void {
    if (confirm('确定要作废此账单吗？')) {
      this.billService.voidBill(bill.id).subscribe({
        next: () => {
          this.snackBar.open('作废成功', '关闭', { duration: 2000 });
          this.loadBills();
        },
        error: (err) => {
          this.snackBar.open(err.error?.error || '操作失败', '关闭', { duration: 3000 });
        }
      });
    }
  }

  openExportDialog(): void {
    const dialogRef = this.dialog.open(ExportBillDialogComponent, {
      width: '500px',
      data: { columns: [...this.exportColumns], year: this.filterYear, month: this.filterMonth }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.doExport(result);
      }
    });
  }

  doExport(data: any): void {
    const selectedKeys = data.columns.filter((c: BillExportColumn) => c.selected).map((c: BillExportColumn) => c.key);
    this.billService.exportCSV({
      periodYear: data.year ? +data.year : undefined,
      periodMonth: data.month ? +data.month : undefined,
      columns: selectedKeys.join(',')
    }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bills.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        this.snackBar.open('导出成功', '关闭', { duration: 2000 });
      },
      error: () => {
        this.snackBar.open('导出失败', '关闭', { duration: 3000 });
      }
    });
  }

  exportStatement(): void {
    this.billService.exportStatement().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'statement.csv';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.snackBar.open('导出失败', '关闭', { duration: 3000 });
      }
    });
  }
}

@Component({
  selector: 'app-export-bill-dialog',
  template: `
    <h2 mat-dialog-title>导出账单CSV</h2>
    <mat-dialog-content>
      <div style="margin-bottom: 16px;">
        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
          <mat-form-field appearance="outline" style="flex: 1;">
            <mat-label>年份</mat-label>
            <mat-select [(ngModel)]="exportYear">
              <mat-option value="">全部</mat-option>
              <mat-option *ngFor="let y of [2024, 2025, 2026]" [value]="y">{{ y }}年</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" style="flex: 1;">
            <mat-label>月份</mat-label>
            <mat-select [(ngModel)]="exportMonth">
              <mat-option value="">全部</mat-option>
              <mat-option *ngFor="let m of [1,2,3,4,5,6,7,8,9,10,11,12]" [value]="m">{{ m }}月</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </div>
      
      <div class="detail-title">选择导出列</div>
      <div style="max-height: 300px; overflow-y: auto;">
        <mat-checkbox *ngFor="let col of columns" [(ngModel)]="col.selected" style="display: block; margin-bottom: 8px;">
          {{ col.label }}
        </mat-checkbox>
      </div>
      
      <div style="margin-top: 16px; color: #f44336; font-size: 12px;">
        注意：导出内容包含敏感信息（身份证号、银行卡号等），请妥善保管。
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">取消</button>
      <button mat-raised-button color="primary" (click)="onSubmit()">导出</button>
    </mat-dialog-actions>
  `
})
export class ExportBillDialogComponent {
  columns: BillExportColumn[];
  exportYear = '';
  exportMonth = '';

  constructor(
    public dialogRef: MatDialogRef<ExportBillDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.columns = data.columns || [];
    this.exportYear = data.year || '';
    this.exportMonth = data.month || '';
  }

  onSubmit(): void {
    const hasSensitive = this.columns.some(c => c.selected && ['idCard', 'bankCard', 'phone', 'email'].includes(c.key));
    if (hasSensitive && !confirm('导出内容包含敏感信息，确定继续吗？')) {
      return;
    }
    this.dialogRef.close({
      columns: this.columns,
      year: this.exportYear,
      month: this.exportMonth
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
