import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { User } from './models/models';

@Component({
  selector: 'app-root',
  template: `
    <div *ngIf="!currentUser" class="login-container">
      <router-outlet></router-outlet>
    </div>
    <div *ngIf="currentUser">
      <mat-toolbar color="primary">
        <span>计费对账平台</span>
        <span style="flex: 1 1 auto;"></span>
        <button mat-button routerLink="/dashboard" routerLinkActive="active">
          <mat-icon>dashboard</mat-icon> 仪表盘
        </button>
        <button mat-button routerLink="/customers" routerLinkActive="active">
          <mat-icon>people</mat-icon> 客户管理
        </button>
        <button mat-button routerLink="/bills" routerLinkActive="active">
          <mat-icon>receipt</mat-icon> 账单管理
        </button>
        <button mat-button routerLink="/payments" routerLinkActive="active">
          <mat-icon>payment</mat-icon> 还款记录
        </button>
        <button mat-button *ngIf="authService.isAdmin()" routerLink="/audit-logs" routerLinkActive="active">
          <mat-icon>history</mat-icon> 操作日志
        </button>
        <span style="flex: 1 1 auto;"></span>
        <span style="margin-right: 16px;">{{ currentUser.name }} ({{ getRoleName(currentUser.role) }})</span>
        <button mat-icon-button (click)="logout()">
          <mat-icon>logout</mat-icon>
        </button>
      </mat-toolbar>
      <div class="container">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    .active {
      background: rgba(255,255,255,0.2);
    }
  `]
})
export class AppComponent {
  currentUser: User | null = null;

  constructor(public authService: AuthService, private router: Router) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  getRoleName(role: string): string {
    const roleMap: Record<string, string> = {
      'admin': '管理员',
      'finance': '财务',
      'support': '客服',
      'sales': '销售',
      'customer': '客户'
    };
    return roleMap[role] || role;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
