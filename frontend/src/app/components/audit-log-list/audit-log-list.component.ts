import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { AuditService } from '../../services/audit.service';
import { AuditLog } from '../../models/models';

@Component({
  selector: 'app-audit-log-list',
  template: `
    <div class="page-header">
      <h2 class="page-title">操作日志</h2>
    </div>

    <div class="filter-bar">
      <mat-form-field appearance="outline">
        <mat-label>操作人ID</mat-label>
        <input matInput [(ngModel)]="filterActorId" (keyup.enter)="loadLogs()">
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>操作类型</mat-label>
        <mat-select [(ngModel)]="filterAction" (selectionChange)="loadLogs()">
          <mat-option value="">全部</mat-option>
          <mat-option value="create">创建</mat-option>
          <mat-option value="update">更新</mat-option>
          <mat-option value="delete">删除</mat-option>
          <mat-option value="view">查看</mat-option>
          <mat-option value="void">作废</mat-option>
          <mat-option value="issue">出账</mat-option>
          <mat-option value="waive_late_fee">豁免滞纳金</mat-option>
          <mat-option value="mark_exception">标记异常</mat-option>
          <mat-option value="resolve_exception">解除异常</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>资源类型</mat-label>
        <mat-select [(ngModel)]="filterResourceType" (selectionChange)="loadLogs()">
          <mat-option value="">全部</mat-option>
          <mat-option value="customer">客户</mat-option>
          <mat-option value="bill">账单</mat-option>
          <mat-option value="payment">还款</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>开始日期</mat-label>
        <input matInput [matDatepicker]="startPicker" [(ngModel)]="filterStartDate" (dateChange)="loadLogs()">
        <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
        <mat-datepicker #startPicker></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>结束日期</mat-label>
        <input matInput [matDatepicker]="endPicker" [(ngModel)]="filterEndDate" (dateChange)="loadLogs()">
        <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
        <mat-datepicker #endPicker></mat-datepicker>
      </mat-form-field>

      <button mat-button (click)="loadLogs()">
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
        <ng-container matColumnDef="timestamp">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>操作时间</th>
          <td mat-cell *matCellDef="let element">{{ element.timestamp | date: 'yyyy-MM-dd HH:mm:ss' }}</td>
        </ng-container>

        <ng-container matColumnDef="actorName">
          <th mat-header-cell *matHeaderCellDef>操作人</th>
          <td mat-cell *matCellDef="let element">
            {{ element.actorName }} ({{ getRoleName(element.actorRole) }})
          </td>
        </ng-container>

        <ng-container matColumnDef="action">
          <th mat-header-cell *matHeaderCellDef>操作</th>
          <td mat-cell *matCellDef="let element">{{ getActionName(element.action) }}</td>
        </ng-container>

        <ng-container matColumnDef="resourceType">
          <th mat-header-cell *matHeaderCellDef>资源类型</th>
          <td mat-cell *matCellDef="let element">{{ getResourceName(element.resourceType) }}</td>
        </ng-container>

        <ng-container matColumnDef="resourceId">
          <th mat-header-cell *matHeaderCellDef>资源ID</th>
          <td mat-cell *matCellDef="let element">{{ element.resourceId || '-' }}</td>
        </ng-container>

        <ng-container matColumnDef="ip">
          <th mat-header-cell *matHeaderCellDef>IP地址</th>
          <td mat-cell *matCellDef="let element">{{ element.ip }}</td>
        </ng-container>

        <ng-container matColumnDef="detail">
          <th mat-header-cell *matHeaderCellDef>详情</th>
          <td mat-cell *matCellDef="let element">
            <button mat-button (click)="showDetail(element)">
              <mat-icon>visibility</mat-icon> 查看
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
export class AuditLogListComponent implements OnInit {
  displayedColumns: string[] = ['timestamp', 'actorName', 'action', 'resourceType', 'resourceId', 'ip', 'detail'];
  dataSource = new MatTableDataSource<AuditLog>([]);
  total = 0;
  pageIndex = 0;
  pageSize = 20;
  loading = false;

  filterActorId = '';
  filterAction = '';
  filterResourceType = '';
  filterStartDate: Date | null = null;
  filterEndDate: Date | null = null;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(private auditService: AuditService) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading = true;
    this.auditService.getAuditLogs({
      page: this.pageIndex + 1,
      pageSize: this.pageSize,
      actorId: this.filterActorId,
      action: this.filterAction,
      resourceType: this.filterResourceType,
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
    this.loadLogs();
  }

  resetFilters(): void {
    this.filterActorId = '';
    this.filterAction = '';
    this.filterResourceType = '';
    this.filterStartDate = null;
    this.filterEndDate = null;
    this.pageIndex = 0;
    this.loadLogs();
  }

  getRoleName(role: string): string {
    const map: Record<string, string> = {
      'admin': '管理员',
      'finance': '财务',
      'support': '客服',
      'sales': '销售',
      'customer': '客户'
    };
    return map[role] || role;
  }

  getActionName(action: string): string {
    const map: Record<string, string> = {
      'create': '创建',
      'update': '更新',
      'delete': '删除',
      'view': '查看',
      'void': '作废',
      'issue': '出账',
      'waive_late_fee': '豁免滞纳金',
      'mark_exception': '标记异常',
      'resolve_exception': '解除异常',
      'batch_import': '批量导入'
    };
    return map[action] || action;
  }

  getResourceName(type: string): string {
    const map: Record<string, string> = {
      'customer': '客户',
      'bill': '账单',
      'payment': '还款'
    };
    return map[type] || type;
  }

  showDetail(log: AuditLog): void {
    const detail = {
      before: log.before,
      after: log.after
    };
    alert(JSON.stringify(detail, null, 2));
  }
}
