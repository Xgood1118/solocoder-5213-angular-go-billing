import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { CustomerService } from '../../services/customer.service';
import { AuthService } from '../../services/auth.service';
import { Customer } from '../../models/models';
import { CustomerEditDialogComponent } from '../customer-edit-dialog/customer-edit-dialog.component';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-customer-list',
  template: `
    <div class="page-header">
      <h2 class="page-title">客户管理</h2>
      <div>
        <button mat-raised-button color="primary" *ngIf="authService.isFinance()" (click)="openImportDialog()" style="margin-right: 8px;">
          <mat-icon>upload</mat-icon> 批量导入
        </button>
        <input type="file" #importFile accept=".csv" style="display: none;" (change)="onFileSelected($event)">
        <button mat-raised-button (click)="exportExcel()" style="margin-right: 8px;">
          <mat-icon>download</mat-icon> 导出Excel
        </button>
        <button mat-raised-button color="primary" *ngIf="authService.isFinance()" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon> 新增客户
        </button>
      </div>
    </div>

    <div class="filter-bar">
      <mat-form-field appearance="outline">
        <mat-label>客户类型</mat-label>
        <mat-select [(ngModel)]="filterType" (selectionChange)="loadCustomers()">
          <mat-option value="">全部</mat-option>
          <mat-option value="individual">个人</mat-option>
          <mat-option value="enterprise">企业</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>搜索</mat-label>
        <input matInput [(ngModel)]="keyword" (keyup.enter)="loadCustomers()" placeholder="客户名称/联系人">
      </mat-form-field>

      <button mat-button (click)="loadCustomers()">
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
          <th mat-header-cell *matHeaderCellDef mat-sort-header>客户ID</th>
          <td mat-cell *matCellDef="let element">{{ element.id }}</td>
        </ng-container>

        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>客户名称</th>
          <td mat-cell *matCellDef="let element">
            <a href="javascript:void(0)" (click)="goToDetail(element.id)" style="color: #3f51b5;">
              {{ element.name }}
            </a>
          </td>
        </ng-container>

        <ng-container matColumnDef="type">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>客户类型</th>
          <td mat-cell *matCellDef="let element">
            {{ element.type === 'enterprise' ? '企业' : '个人' }}
          </td>
        </ng-container>

        <ng-container matColumnDef="contact">
          <th mat-header-cell *matHeaderCellDef>联系人</th>
          <td mat-cell *matCellDef="let element">{{ element.contact }}</td>
        </ng-container>

        <ng-container matColumnDef="phone">
          <th mat-header-cell *matHeaderCellDef>联系电话</th>
          <td mat-cell *matCellDef="let element">{{ element.phone | maskPhone }}</td>
        </ng-container>

        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>邮箱</th>
          <td mat-cell *matCellDef="let element">{{ element.email }}</td>
        </ng-container>

        <ng-container matColumnDef="creditLimit">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>信用额度</th>
          <td mat-cell *matCellDef="let element">{{ element.creditLimit | fenToYuan }} 元</td>
        </ng-container>

        <ng-container matColumnDef="registeredAt">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>注册时间</th>
          <td mat-cell *matCellDef="let element">{{ element.registeredAt | date: 'yyyy-MM-dd' }}</td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>操作</th>
          <td mat-cell *matCellDef="let element">
            <button mat-icon-button (click)="goToDetail(element.id)" matTooltip="查看详情">
              <mat-icon>visibility</mat-icon>
            </button>
            <button mat-icon-button *ngIf="authService.isFinance()" (click)="openEditDialog(element)" matTooltip="编辑">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button *ngIf="authService.isAdmin()" (click)="deleteCustomer(element)" matTooltip="删除" color="warn">
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
export class CustomerListComponent implements OnInit {
  displayedColumns: string[] = ['id', 'name', 'type', 'contact', 'phone', 'email', 'creditLimit', 'registeredAt', 'actions'];
  dataSource = new MatTableDataSource<Customer>([]);
  total = 0;
  pageIndex = 0;
  pageSize = 20;
  loading = false;

  filterType = '';
  keyword = '';
  sortBy = '';
  sortOrder = '';

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private customerService: CustomerService,
    public authService: AuthService,
    private dialog: MatDialog,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.loading = true;
    this.customerService.getCustomers({
      page: this.pageIndex + 1,
      pageSize: this.pageSize,
      type: this.filterType,
      keyword: this.keyword,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder
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

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadCustomers();
  }

  resetFilters(): void {
    this.filterType = '';
    this.keyword = '';
    this.pageIndex = 0;
    this.loadCustomers();
  }

  goToDetail(id: string): void {
    this.router.navigate(['/customers', id]);
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(CustomerEditDialogComponent, {
      width: '600px',
      data: { customer: null, isEdit: false }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadCustomers();
      }
    });
  }

  openEditDialog(customer: Customer): void {
    const dialogRef = this.dialog.open(CustomerEditDialogComponent, {
      width: '600px',
      data: { customer, isEdit: true }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadCustomers();
      }
    });
  }

  deleteCustomer(customer: Customer): void {
    if (confirm(`确定要删除客户 "${customer.name}" 吗？`)) {
      this.customerService.deleteCustomer(customer.id).subscribe({
        next: () => {
          this.snackBar.open('删除成功', '关闭', { duration: 2000 });
          this.loadCustomers();
        },
        error: (err) => {
          this.snackBar.open(err.error?.error || '删除失败', '关闭', { duration: 3000 });
        }
      });
    }
  }

  exportExcel(): void {
    this.customerService.exportExcel().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'customers.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.snackBar.open('导出失败', '关闭', { duration: 3000 });
      }
    });
  }

  openImportDialog(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        this.importFile(file);
      }
    };
    input.click();
  }

  importFile(file: File): void {
    this.customerService.batchImport(file).subscribe({
      next: (result) => {
        this.snackBar.open(`导入成功 ${result.imported} 条，跳过 ${result.skipped} 条`, '关闭', { duration: 3000 });
        this.loadCustomers();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || '导入失败', '关闭', { duration: 3000 });
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.importFile(input.files[0]);
    }
  }
}
