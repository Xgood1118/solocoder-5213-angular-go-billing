import { Component, OnInit } from '@angular/core';
import { StatsService } from '../../services/stats.service';
import { DashboardStats } from '../../models/models';

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="page-header">
      <h2 class="page-title">数据概览</h2>
    </div>

    <div *ngIf="loading" style="text-align: center; padding: 40px;">
      <mat-spinner></mat-spinner>
    </div>

    <div *ngIf="!loading && stats">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalCustomers }}</div>
          <div class="stat-label">客户总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalBills }}</div>
          <div class="stat-label">账单总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalUnpaidAmount | fenToYuan }}</div>
          <div class="stat-label">待收金额(元)</div>
        </div>
        <div class="stat-card" [ngClass]="{'warning-red': stats.overdueCount > 0}">
          <div class="stat-value">{{ stats.overdueCount }}</div>
          <div class="stat-label">逾期账单</div>
        </div>
        <div class="stat-card" [ngClass]="{'warning-red': stats.exceptionCount > 0}">
          <div class="stat-value">{{ stats.exceptionCount }}</div>
          <div class="stat-label">异常账单</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalLateFee | fenToYuan }}</div>
          <div class="stat-label">累计滞纳金(元)</div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-title">月度收支趋势</div>
        <div class="chart-container">
          <svg class="chart-canvas" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid meet">
            <g stroke="#e0e0e0" stroke-width="1">
              <line x1="50" y1="20" x2="50" y2="260" />
              <line x1="50" y1="260" x2="780" y2="260" />
              <line *ngFor="let i of [1,2,3,4]" [attr.x1]="50" [attr.y1]="20 + (240/5)*i" [attr.x2]="780" [attr.y2]="20 + (240/5)*i" stroke-dasharray="4" />
            </g>
            <g fill="#999" font-size="12">
              <text *ngFor="let stat of stats.monthlyStats; let i = index" 
                    [attr.x]="50 + (730 / (stats.monthlyStats.length || 1)) * i + 30" 
                    [attr.y]="285" text-anchor="middle">
                {{ stat.month }}月
              </text>
            </g>
            <polyline *ngIf="duePoints" [attr.points]="duePoints" fill="none" stroke="#3f51b5" stroke-width="2" />
            <polyline *ngIf="paidPoints" [attr.points]="paidPoints" fill="none" stroke="#4caf50" stroke-width="2" />
            <circle *ngFor="let p of duePointArray" [attr.cx]="p.x" [attr.cy]="p.y" r="3" fill="#3f51b5" />
            <circle *ngFor="let p of paidPointArray" [attr.cx]="p.x" [attr.cy]="p.y" r="3" fill="#4caf50" />
            <g font-size="12">
              <rect x="600" y="20" width="12" height="12" fill="#3f51b5" />
              <text x="620" y="30" fill="#666">应收金额</text>
              <rect x="600" y="40" width="12" height="12" fill="#4caf50" />
              <text x="620" y="50" fill="#666">已收金额</text>
            </g>
          </svg>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-title">欠费客户排行 (Top 10)</div>
        <table mat-table [dataSource]="ranking" class="mat-elevation-z1" style="width: 100%;">
          <ng-container matColumnDef="rank">
            <th mat-header-cell *matHeaderCellDef>排名</th>
            <td mat-cell *matCellDef="let element; let i = index">
              <span [style.color]="i < 3 ? '#f44336' : '#666'" [style.font-weight]="i < 3 ? 'bold' : 'normal'">{{ i + 1 }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="customerName">
            <th mat-header-cell *matHeaderCellDef>客户名称</th>
            <td mat-cell *matCellDef="let element">{{ element.customerName }}</td>
          </ng-container>
          <ng-container matColumnDef="totalDebt">
            <th mat-header-cell *matHeaderCellDef>欠费金额</th>
            <td mat-cell *matCellDef="let element" [ngClass]="{'warning-red': element.overCredit}">
              {{ element.totalDebt | fenToYuan }} 元
            </td>
          </ng-container>
          <ng-container matColumnDef="overCredit">
            <th mat-header-cell *matHeaderCellDef>状态</th>
            <td mat-cell *matCellDef="let element">
              <span *ngIf="element.overCredit" class="status-badge status-overdue">超信用额度</span>
              <span *ngIf="!element.overCredit" class="status-badge status-issued">正常</span>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="rankingColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: rankingColumns;"></tr>
        </table>
      </div>
    </div>
  `,
  styles: []
})
export class DashboardComponent implements OnInit {
  stats: DashboardStats | null = null;
  loading = true;
  ranking: any[] = [];
  rankingColumns = ['rank', 'customerName', 'totalDebt', 'overCredit'];
  
  duePoints = '';
  paidPoints = '';
  duePointArray: { x: number; y: number }[] = [];
  paidPointArray: { x: number; y: number }[] = [];

  constructor(private statsService: StatsService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.statsService.getDashboard().subscribe({
      next: (data) => {
        this.stats = data;
        this.calculateChartPoints();
        this.loadRanking();
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadRanking(): void {
    this.statsService.getCustomerRanking().subscribe({
      next: (data) => {
        this.ranking = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  calculateChartPoints(): void {
    if (!this.stats?.monthlyStats?.length) {
      return;
    }

    const maxAmount = Math.max(...this.stats.monthlyStats.map(s => Math.max(s.dueAmount, s.paidAmount))) || 1;
    const count = this.stats.monthlyStats.length;
    const chartWidth = 730;
    const chartHeight = 240;
    const startX = 50;
    const startY = 20;

    this.duePointArray = this.stats.monthlyStats.map((s, i) => ({
      x: startX + (chartWidth / (count - 1 || 1)) * i,
      y: startY + chartHeight - (s.dueAmount / maxAmount) * chartHeight
    }));

    this.paidPointArray = this.stats.monthlyStats.map((s, i) => ({
      x: startX + (chartWidth / (count - 1 || 1)) * i,
      y: startY + chartHeight - (s.paidAmount / maxAmount) * chartHeight
    }));

    this.duePoints = this.duePointArray.map(p => `${p.x},${p.y}`).join(' ');
    this.paidPoints = this.paidPointArray.map(p => `${p.x},${p.y}`).join(' ');
  }
}
