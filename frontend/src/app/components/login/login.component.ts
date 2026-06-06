import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <h2 class="login-title">计费对账平台</h2>
        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
          <mat-form-field appearance="fill">
            <mat-label>用户名</mat-label>
            <input matInput formControlName="username" required>
            <mat-error *ngIf="loginForm.get('username')?.hasError('required')">
              请输入用户名
            </mat-error>
          </mat-form-field>
          
          <mat-form-field appearance="fill">
            <mat-label>密码</mat-label>
            <input matInput type="password" formControlName="password" required>
            <mat-error *ngIf="loginForm.get('password')?.hasError('required')">
              请输入密码
            </mat-error>
          </mat-form-field>

          <div *ngIf="errorMsg" class="error-msg" style="color: #f44336; font-size: 14px; margin-bottom: 16px;">
            {{ errorMsg }}
          </div>

          <button mat-raised-button color="primary" type="submit" [disabled]="loading">
            <mat-spinner *ngIf="loading" diameter="20" style="display: inline-block; vertical-align: middle;"></mat-spinner>
            <span *ngIf="!loading">登录</span>
          </button>
        </form>

        <div style="margin-top: 16px; font-size: 12px; color: #999;">
          <p>测试账号：</p>
          <p>管理员：admin / admin123</p>
          <p>财务：finance01 / finance123</p>
          <p>客服：support01 / support123</p>
          <p>销售：sales01 / sales123</p>
        </div>
      </mat-card>
    </div>
  `,
  styles: []
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  errorMsg = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    this.errorMsg = '';

    const { username, password } = this.loginForm.value;
    
    this.authService.login(username, password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.error || '登录失败，请检查用户名和密码';
      }
    });
  }
}
