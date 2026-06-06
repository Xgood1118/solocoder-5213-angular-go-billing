import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CustomerService } from '../../services/customer.service';
import { BillService } from '../../services/bill.service';
import { AuthService } from '../../services/auth.service';
import { Customer, Bill, ConsumptionTrend, CustomerDebt } from '../../models/models';
import { MatDialog } from '@angular/material/dialog';
import { CustomerEditDialogComponent } from '../customer-edit-dialog/customer-edit-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-customer-detail',
  template: `
    <div *ngIf="loading" style="text-align: center; padding: 40px;">
      <mat-spinner></mat-spinner>
    </div>

    <div *ngIf="!loading && customer">
      <div class="page-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button mat-icon-button (click)="goBack()">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <h2 class="page-title">{{ customer.name }}</h2>
          <span class="status-badge" [ngClass]="customer.type === 'enterprise' ? 'status-issued' : 'status-partial'">
            {{ customer.type === 'enterprise' ? '企业' : '个人' }}
          </span>
          <span *ngIf="debtInfo?.overCredit" class="status-badge status-overdue">超信用额度</span>
        </div>
        <div>
          <button mat-button *ngIf="authService.isFinance()" (click)="editCustomer()">
            <mat-icon>edit</mat-icon> 编辑
          </button>
          <button mat-button (click)="exportStatement()">
            <mat-icon>download</mat-icon> 导出对账单
          </button>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-title">基本信息</div>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">客户ID</span>
            <span class="detail-value">{{ customer.id }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">客户名称</span>
            <span class="detail-value">{{ customer.name }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">联系人</span>
            <span class="detail-value">{{ customer.contact }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">联系电话</span>
            <span class="detail-value">{{ customer.phone }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">邮箱</span>
            <span class="detail-value">{{ customer.email }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">身份证号</span>
            <span class="detail-value">{{ customer.idCard }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">银行卡号</span>
            <span class="detail-value">{{ customer.bankCard }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">地址</span>
            <span class="detail-value">{{ customer.address }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">注册时间</span>
            <span class="detail-value">{{ customer.registeredAt | date: 'yyyy-MM-dd' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">信用额度</span>
            <span class="detail-value">{{ customer.creditLimit | fenToYuan }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">销售代表ID</span>
            <span class="detail-value">{{ customer.salesRepId }}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-title">欠费概览</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
          <div class="stat-card">
            <div class="stat-value" [ngClass]="{'warning-red': debtInfo?.totalDebt > customer.creditLimit}">
              {{ debtInfo?.totalDebt | fenToYuan }}
            </div>
            <div class="stat-label">总欠费(元)</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ debtInfo?.totalLateFee | fenToYuan }}</div>
            <div class="stat-label">滞纳金(元)</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ debtInfo?.billCount }}</div>
            <div class="stat-label">账单总数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" [ngClass]="{'warning-red': debtInfo?.overdueCount > 0}">
              {{ debtInfo?.overdueCount }}
            </div>
            <div class="stat-label">逾期账单</div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-title">消费趋势（近12个月）</div>
        <div class="chart-container">
          <svg class="chart-canvas" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid meet" *ngIf="trendData.length > 0">
            <g stroke="#e0e0e0" stroke-width="1">
              <line x1="50" y1="20" x2="50" y2="260" />
              <line x1="50" y1="260" x2="780" y2="260" />
              <line *ngFor="let i of [1,2,3,4]" [attr.x1]="50" [attr.y1]="20 + (240/5)*i" [attr.x2]="780" [attr.y2]="20 + (240/5)*i" stroke-dasharray="4" />
            </g>
            <g fill="#999" font-size="11">
              <text *ngFor="let item of trendData; let i = index" 
                    [attr.x]="50 + (730 / (trendData.length || 1)) * i + 30" 
                    [attr.y]="280" text-anchor="middle">
                {{ item.month }}月
              </text>
            </g>
            <polyline [attr.points]="totalPoints" fill="none" stroke="#3f51b5" stroke-width="2" />
            <polyline [attr.points]="paidPoints" fill="none" stroke="#4caf50" stroke-width="2" />
            <circle *ngFor="let p of totalPointArray" [attr.cx]="p.x" [attr.cy]="p.y" r="3" fill="#3f51b5" />
            <circle *ngFor="let p of paidPointArray" [attr.cx]="p.x" [attr.cy]="p.y" r="3" fill="#4caf50" />
            <g font-size="12">
              <rect x="600" y="20" width="12" height="12" fill="#3f51b5" />
              <text x="620" y="30" fill="#666">账单金额</text>
              <rect x="600" y="40" width="12" height="12" fill="#4caf50" />
              <text x="620" y="50" fill="#666">已还金额</text>
            </g>
          </svg>
          <div *ngIf="trendData.length === 0" style="text-align: center; color: #999; padding: 60px;">
            暂无数据
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-title">最近账单</div>
        <table mat-table [dataSource]="recentBills" class="mat-elevation-z1" style="width: 100%;">
          <ng-container matColumnDef="id">
            <th mat-header-cell *matHeaderCellDef>账单ID</th>
            <td mat-cell *matCellDef="let element">{{ element.id }}</td>
          </ng-container>
          <ng-container matColumnDef="period">
            <th mat-header-cell *matHeaderCellDef>账期</th>
            <td mat-cell *matCellDef="let element">{{ element.periodYear }}年{{ element.periodMonth }}月</td>
          </ng-container>
          <ng-container matColumnDef="dueAmount">
            <th mat-header-cell *matHeaderCellDef>应还金额</th>
            <td mat-cell *matCellDef="let element">{{ element.dueAmount | fenToYuan }} 元</td>
          </ng-container>
          <ng-container matColumnDef="unpaidAmount">
            <th mat-header-cell *matHeaderCellDef>未还金额</th>
            <td mat-cell *matCellDef="let element" [ngClass]="{'warning-red': element.unpaidAmount > 0}">
              {{ element.unpaidAmount | fenToYuan }} 元
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>状态</th>
            <td mat-cell *matCellDef="let element">
              <span class="status-badge" [ngClass]="'status-' + element.status">
                {{ getStatusName(element.status) }}
              </span>
              <span *ngIf="element.isException" class="status-badge status-exception" style="margin-left: 4px;">异常</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="action">
            <th mat-header-cell *matHeaderCellDef>操作</th>
            <td mat-cell *matCellDef="let element">
              <button mat-button (click)="goToBill(element.id)">查看</button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="billColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: billColumns;"></tr>
        </table>
      </div>
    </div>
  `,
  styles: []
})
export class CustomerDetailComponent implements OnInit {
  customer: Customer | null = null;
  debtInfo: CustomerDebt | null = null;
  recentBills: Bill[] = [];
  trendData: ConsumptionTrend[] = [];
  loading = true;
  billColumns = ['id', 'period', 'dueAmount', 'unpaidAmount', 'status', 'action'];
  
  totalPoints = '';
  paidPoints = '';
  totalPointArray: { x: number; y: number }[] = [];
  paidPointArray: { x: number; y: number }[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private customerService: CustomerService,
    private billService: BillService,
    public authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadCustomer(id);
    }
  }

  loadCustomer(id: string): void {
    this.loading = true;
    
    this.customerService.getCustomer(id).subscribe({
      next: (customer) => {
        this.customer = customer;
        this.loadDebt(id);
        this.loadTrend(id);
        this.loadBills(id);
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadDebt(id: string): void {
    this.customerService.getCustomerDebt(id).subscribe({
      next: (debt) => {
        this.debtInfo = {
          ...debt,
          overCredit: debt.totalDebt > (this.customer?.creditLimit || 0)
        } as CustomerDebt;
      }
    });
  }

  loadTrend(id: string): void {
    this.customerService.getConsumptionTrend(id).subscribe({
      next: (trend) => {
        this.trendData = trend;
        this.calculateChartPoints();
      }
    });
  }

  loadBills(id: string): void {
    this.billService.getBills({ customerId: id, pageSize: 5, sortBy: 'generatedAt', sortOrder: 'desc' }).subscribe({
      next: (result) => {
        this.recentBills = result.list;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  calculateChartPoints(): void {
    if (!this.trendData?.length) return;

    const maxAmount = Math.max(...this.trendData.map(s => Math.max(s.totalAmount, s.paidAmount))) || 1;
    const count = this.trendData.length;
    const chartWidth = 730;
    const chartHeight = 240;
    const startX = 50;
    const startY = 20;

    this.totalPointArray = this.trendData.map((s, i) => ({
      x: startX + (chartWidth / (count - 1 || 1)) * i,
      y: startY + chartHeight - (s.totalAmount / maxAmount) * chartHeight
    }));

    this.paidPointArray = this.trendData.map((s, i) => ({
      x: startX + (chartWidth / (count - 1 || 1)) * i,
      y: startY + chartHeight - (s.paidAmount / maxAmount) * chartHeight
    }));

    this.totalPoints = this.totalPointArray.map(p => `${p.x},${p.y}`).join(' ');
    this.paidPoints = this.paidPointArray.map(p => `${p.x},${p.y}`).join(' ');
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

  goBack(): void {
    this.router.navigate(['/customers']);
  }

  goToBill(billId: string): void {
    this.router.navigate(['/bills', billId]);
  }

  editCustomer(): void {
    if (!this.customer) return;
    
    const dialogRef = this.dialog.open(CustomerEditDialogComponent, {
      width: '600px',
      data: { customer: this.customer, isEdit: true }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.customer = result;
        this.snackBar.open('保存成功', '关闭', { duration: 2000 });
      }
    });
  }

  exportStatement(): void {
    if (!this.customer) return;
    
    this.billService.exportStatement(this.customer.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `statement_${this.customer!.id}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.snackBar.open('导出失败', '关闭', { duration: 3000 });
      }
    });
  }
}
