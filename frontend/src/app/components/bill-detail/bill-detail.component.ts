import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BillService } from '../../services/bill.service';
import { PaymentService } from '../../services/payment.service';
import { AuthService } from '../../services/auth.service';
import { CustomerService } from '../../services/customer.service';
import { Bill, Payment, Customer, BillItem } from '../../models/models';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-bill-detail',
  template: `
    <div *ngIf="loading" style="text-align: center; padding: 40px;">
      <mat-spinner></mat-spinner>
    </div>

    <div *ngIf="!loading && bill">
      <div class="page-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button mat-icon-button (click)="goBack()">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <h2 class="page-title">账单详情 - {{ bill.id }}</h2>
          <span class="status-badge" [ngClass]="'status-' + bill.status">
            {{ getStatusName(bill.status) }}
          </span>
          <span *ngIf="bill.isException" class="status-badge status-exception" style="margin-left: 4px;">
            对账异常
          </span>
        </div>
        <div>
          <button mat-button *ngIf="authService.isFinance() && bill.status === 'pending'" (click)="issueBill()">
            <mat-icon>check_circle</mat-icon> 出账
          </button>
          <button mat-button *ngIf="authService.isAdmin() && bill.status !== 'void' && bill.status !== 'paid'" 
                  (click)="voidBill()" color="warn">
            <mat-icon>cancel</mat-icon> 作废
          </button>
          <button mat-button *ngIf="authService.isAdmin() && bill.lateFee > 0 && !bill.lateFeeWaived" 
                  (click)="openWaiveDialog()">
            <mat-icon>money_off</mat-icon> 豁免滞纳金
          </button>
          <button mat-button *ngIf="authService.isFinance() && !bill.isException" (click)="openMarkExceptionDialog()">
            <mat-icon>error</mat-icon> 标记异常
          </button>
          <button mat-button *ngIf="authService.isFinance() && bill.isException" (click)="resolveException()">
            <mat-icon>check</mat-icon> 解除异常
          </button>
          <button mat-raised-button color="primary" *ngIf="authService.isFinance() && bill.unpaidAmount > 0 && bill.status !== 'void'" 
                  (click)="openPaymentDialog()" style="margin-left: 8px;">
            <mat-icon>payment</mat-icon> 登记还款
          </button>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-title">账单信息</div>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">账单ID</span>
            <span class="detail-value">{{ bill.id }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">客户ID</span>
            <span class="detail-value">
              <a href="javascript:void(0)" (click)="goToCustomer()" style="color: #3f51b5;">
                {{ bill.customerId }}
              </a>
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">客户名称</span>
            <span class="detail-value">{{ customer?.name }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">账期</span>
            <span class="detail-value">{{ bill.periodYear }}年{{ bill.periodMonth }}月</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">生成时间</span>
            <span class="detail-value">{{ bill.generatedAt | date: 'yyyy-MM-dd HH:mm' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">应还金额</span>
            <span class="detail-value">{{ bill.dueAmount | fenToYuan }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">已还金额</span>
            <span class="detail-value" style="color: #4caf50;">{{ bill.paidAmount | fenToYuan }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">未还金额</span>
            <span class="detail-value" [ngClass]="{'warning-red': bill.unpaidAmount > 0}">
              {{ bill.unpaidAmount | fenToYuan }} 元
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">滞纳金</span>
            <span class="detail-value" [ngClass]="{'warning-red': bill.lateFee > 0}">
              {{ bill.lateFee | fenToYuan }} 元
              <span *ngIf="bill.lateFeeWaived" style="color: #999; font-size: 12px;">(已豁免)</span>
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">逾期天数</span>
            <span class="detail-value" [ngClass]="{'warning-red': bill.lateDays > 0}">{{ bill.lateDays }} 天</span>
          </div>
        </div>

        <div *ngIf="bill.lateFeeWaived" style="margin-top: 12px; padding: 12px; background: #f5f5f5; border-radius: 4px;">
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">豁免原因：{{ bill.waiveReason }}</div>
          <div style="font-size: 12px; color: #666;">豁免操作：{{ bill.waivedBy }} / {{ bill.waivedAt | date: 'yyyy-MM-dd HH:mm' }}</div>
        </div>

        <div *ngIf="bill.isException" style="margin-top: 12px; padding: 12px; background: #fff8e1; border-radius: 4px;">
          <div style="font-size: 12px; color: #f57f17; margin-bottom: 4px;">异常描述：{{ bill.exceptionDesc }}</div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-title">账单明细</div>
        <table mat-table [dataSource]="bill.items" class="mat-elevation-z1" style="width: 100%;">
          <ng-container matColumnDef="feeSource">
            <th mat-header-cell *matHeaderCellDef>费用来源</th>
            <td mat-cell *matCellDef="let element">{{ element.feeSource }}</td>
          </ng-container>
          <ng-container matColumnDef="amount">
            <th mat-header-cell *matHeaderCellDef>金额</th>
            <td mat-cell *matCellDef="let element">{{ element.amount | fenToYuan }} 元</td>
          </ng-container>
          <ng-container matColumnDef="generatedAt">
            <th mat-header-cell *matHeaderCellDef>生成时间</th>
            <td mat-cell *matCellDef="let element">{{ element.generatedAt | date: 'yyyy-MM-dd' }}</td>
          </ng-container>
          <ng-container matColumnDef="businessOrder">
            <th mat-header-cell *matHeaderCellDef>业务单号</th>
            <td mat-cell *matCellDef="let element">{{ element.businessOrder }}</td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="itemColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: itemColumns;"></tr>
        </table>
      </div>

      <div class="detail-section">
        <div class="detail-title">还款记录</div>
        <div *ngIf="payments.length === 0" style="text-align: center; color: #999; padding: 40px;">
          暂无还款记录
        </div>
        <table *ngIf="payments.length > 0" mat-table [dataSource]="payments" class="mat-elevation-z1" style="width: 100%;">
          <ng-container matColumnDef="id">
            <th mat-header-cell *matHeaderCellDef>还款ID</th>
            <td mat-cell *matCellDef="let element">{{ element.id }}</td>
          </ng-container>
          <ng-container matColumnDef="paymentTime">
            <th mat-header-cell *matHeaderCellDef>还款时间</th>
            <td mat-cell *matCellDef="let element">{{ element.paymentTime | date: 'yyyy-MM-dd HH:mm' }}</td>
          </ng-container>
          <ng-container matColumnDef="amount">
            <th mat-header-cell *matHeaderCellDef>金额</th>
            <td mat-cell *matCellDef="let element">{{ element.amount | fenToYuan }} 元</td>
          </ng-container>
          <ng-container matColumnDef="method">
            <th mat-header-cell *matHeaderCellDef>方式</th>
            <td mat-cell *matCellDef="let element">{{ getMethodName(element.method) }}</td>
          </ng-container>
          <ng-container matColumnDef="transactionNo">
            <th mat-header-cell *matHeaderCellDef>流水号</th>
            <td mat-cell *matCellDef="let element">{{ element.transactionNo }}</td>
          </ng-container>
          <ng-container matColumnDef="operator">
            <th mat-header-cell *matHeaderCellDef>操作人</th>
            <td mat-cell *matCellDef="let element">{{ element.operatorName }}</td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="paymentColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: paymentColumns;"></tr>
        </table>
      </div>
    </div>
  `,
  styles: []
})
export class BillDetailComponent implements OnInit {
  bill: Bill | null = null;
  customer: Customer | null = null;
  payments: Payment[] = [];
  loading = true;
  itemColumns = ['feeSource', 'amount', 'generatedAt', 'businessOrder'];
  paymentColumns = ['id', 'paymentTime', 'amount', 'method', 'transactionNo', 'operator'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private billService: BillService,
    private paymentService: PaymentService,
    private customerService: CustomerService,
    public authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadBill(id);
    }
  }

  loadBill(id: string): void {
    this.loading = true;
    this.billService.getBill(id).subscribe({
      next: (bill) => {
        this.bill = bill;
        this.loadCustomer(bill.customerId);
        this.loadPayments(id);
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadCustomer(customerId: string): void {
    this.customerService.getCustomer(customerId).subscribe({
      next: (customer) => {
        this.customer = customer;
      }
    });
  }

  loadPayments(billId: string): void {
    this.billService.getBillPayments(billId).subscribe({
      next: (payments) => {
        this.payments = payments;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
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

  goBack(): void {
    this.router.navigate(['/bills']);
  }

  goToCustomer(): void {
    if (this.bill) {
      this.router.navigate(['/customers', this.bill.customerId]);
    }
  }

  issueBill(): void {
    if (!this.bill) return;
    if (confirm('确定要出账吗？')) {
      this.billService.issueBill(this.bill.id).subscribe({
        next: (bill) => {
          this.bill = bill;
          this.snackBar.open('出账成功', '关闭', { duration: 2000 });
        },
        error: (err) => {
          this.snackBar.open(err.error?.error || '操作失败', '关闭', { duration: 3000 });
        }
      });
    }
  }

  voidBill(): void {
    if (!this.bill) return;
    if (confirm('确定要作废此账单吗？')) {
      this.billService.voidBill(this.bill.id).subscribe({
        next: (bill) => {
          this.bill = bill;
          this.snackBar.open('作废成功', '关闭', { duration: 2000 });
        },
        error: (err) => {
          this.snackBar.open(err.error?.error || '操作失败', '关闭', { duration: 3000 });
        }
      });
    }
  }

  openWaiveDialog(): void {
    const dialogRef = this.dialog.open(WaiveLateFeeDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(reason => {
      if (reason && this.bill) {
        this.billService.waiveLateFee(this.bill.id, reason).subscribe({
          next: (bill) => {
            this.bill = bill;
            this.snackBar.open('豁免成功', '关闭', { duration: 2000 });
          },
          error: (err) => {
            this.snackBar.open(err.error?.error || '操作失败', '关闭', { duration: 3000 });
          }
        });
      }
    });
  }

  openMarkExceptionDialog(): void {
    const dialogRef = this.dialog.open(MarkExceptionDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(description => {
      if (description && this.bill) {
        this.billService.markException(this.bill.id, description).subscribe({
          next: (bill) => {
            this.bill = bill;
            this.snackBar.open('已标记异常', '关闭', { duration: 2000 });
          },
          error: (err) => {
            this.snackBar.open(err.error?.error || '操作失败', '关闭', { duration: 3000 });
          }
        });
      }
    });
  }

  resolveException(): void {
    if (!this.bill) return;
    if (confirm('确定要解除异常标记吗？')) {
      this.billService.resolveException(this.bill.id).subscribe({
        next: (bill) => {
          this.bill = bill;
          this.snackBar.open('已解除异常', '关闭', { duration: 2000 });
        },
        error: (err) => {
          this.snackBar.open(err.error?.error || '操作失败', '关闭', { duration: 3000 });
        }
      });
    }
  }

  openPaymentDialog(): void {
    if (!this.bill) return;
    
    const dialogRef = this.dialog.open(PaymentCreateDialogComponent, {
      width: '500px',
      data: { customerId: this.bill.customerId, billId: this.bill.id, unpaidAmount: this.bill.unpaidAmount + this.bill.lateFee }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && this.bill) {
        this.loadBill(this.bill.id);
        this.snackBar.open('还款登记成功', '关闭', { duration: 2000 });
      }
    });
  }
}

@Component({
  selector: 'app-waive-late-fee-dialog',
  template: `
    <h2 mat-dialog-title>豁免滞纳金</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" style="width: 100%;">
        <mat-label>豁免原因</mat-label>
        <mat-select [(ngModel)]="reason">
          <mat-option value="customer_complaint">客户投诉</mat-option>
          <mat-option value="system_error">系统错误</mat-option>
          <mat-option value="special_approval">特殊审批</mat-option>
          <mat-option value="other">其他</mat-option>
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">取消</button>
      <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="!reason">确认</button>
    </mat-dialog-actions>
  `
})
export class WaiveLateFeeDialogComponent {
  reason = '';

  constructor(public dialogRef: MatDialogRef<WaiveLateFeeDialogComponent>) {}

  onSubmit(): void {
    this.dialogRef.close(this.reason);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-mark-exception-dialog',
  template: `
    <h2 mat-dialog-title>标记对账异常</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" style="width: 100%;">
        <mat-label>异常描述</mat-label>
        <textarea matInput [(ngModel)]="description" rows="3"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">取消</button>
      <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="!description">确认</button>
    </mat-dialog-actions>
  `
})
export class MarkExceptionDialogComponent {
  description = '';

  constructor(public dialogRef: MatDialogRef<MarkExceptionDialogComponent>) {}

  onSubmit(): void {
    this.dialogRef.close(this.description);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-payment-create-dialog',
  template: `
    <h2 mat-dialog-title>登记还款</h2>
    <mat-dialog-content>
      <form [formGroup]="paymentForm" style="display: flex; flex-direction: column; gap: 12px; min-width: 400px;">
        <div style="color: #666; font-size: 14px; margin-bottom: 8px;">
          待还金额：{{ data.unpaidAmount | fenToYuan }} 元
        </div>
        
        <mat-form-field appearance="outline">
          <mat-label>还款金额(元)</mat-label>
          <input matInput type="number" formControlName="amount" step="0.01">
          <mat-error *ngIf="paymentForm.get('amount')?.hasError('required')">必填</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>还款方式</mat-label>
          <mat-select formControlName="method">
            <mat-option value="bank_transfer">银行转账</mat-option>
            <mat-option value="alipay">支付宝</mat-option>
            <mat-option value="wechat">微信</mat-option>
            <mat-option value="cash">现金</mat-option>
            <mat-option value="corporate">对公汇款</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>流水号</mat-label>
          <input matInput formControlName="transactionNo">
          <mat-error *ngIf="paymentForm.get('transactionNo')?.hasError('required')">必填</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>备注</mat-label>
          <input matInput formControlName="remark">
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">取消</button>
      <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="saving || paymentForm.invalid">
        {{ saving ? '保存中...' : '确认' }}
      </button>
    </mat-dialog-actions>
  `
})
export class PaymentCreateDialogComponent {
  paymentForm: FormGroup;
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<PaymentCreateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { customerId: string; billId: string; unpaidAmount: number },
    private fb: FormBuilder,
    private paymentService: PaymentService,
    private snackBar: MatSnackBar
  ) {
    this.paymentForm = this.fb.group({
      amount: [null, Validators.required],
      method: ['bank_transfer', Validators.required],
      transactionNo: ['', Validators.required],
      remark: ['']
    });
  }

  onSubmit(): void {
    if (this.paymentForm.invalid) return;

    this.saving = true;
    const formValue = this.paymentForm.value;
    const amountFen = Math.round((formValue.amount || 0) * 100);

    this.paymentService.createPayment({
      customerId: this.data.customerId,
      amount: amountFen,
      method: formValue.method,
      transactionNo: formValue.transactionNo,
      billIds: [this.data.billId],
      remark: formValue.remark
    }).subscribe({
      next: (result) => {
        this.saving = false;
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.saving = false;
        this.snackBar.open(err.error?.error || '操作失败', '关闭', { duration: 3000 });
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
