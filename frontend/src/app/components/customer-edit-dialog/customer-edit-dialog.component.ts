import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomerService } from '../../services/customer.service';
import { Customer } from '../../models/models';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-customer-edit-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.isEdit ? '编辑客户' : '新增客户' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="customerForm" class="dialog-form" style="display: flex; flex-direction: column; gap: 16px; min-width: 500px;">
        <div style="display: flex; gap: 16px;">
          <mat-form-field appearance="outline" style="flex: 1;">
            <mat-label>客户名称</mat-label>
            <input matInput formControlName="name" required>
            <mat-error *ngIf="customerForm.get('name')?.hasError('required')">必填</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" style="flex: 1;">
            <mat-label>客户类型</mat-label>
            <mat-select formControlName="type">
              <mat-option value="individual">个人</mat-option>
              <mat-option value="enterprise">企业</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div style="display: flex; gap: 16px;">
          <mat-form-field appearance="outline" style="flex: 1;">
            <mat-label>联系人</mat-label>
            <input matInput formControlName="contact">
          </mat-form-field>

          <mat-form-field appearance="outline" style="flex: 1;">
            <mat-label>联系电话</mat-label>
            <input matInput formControlName="phone">
          </mat-form-field>
        </div>

        <div style="display: flex; gap: 16px;">
          <mat-form-field appearance="outline" style="flex: 1;">
            <mat-label>邮箱</mat-label>
            <input matInput formControlName="email">
          </mat-form-field>

          <mat-form-field appearance="outline" style="flex: 1;">
            <mat-label>身份证号</mat-label>
            <input matInput formControlName="idCard">
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>地址</mat-label>
          <input matInput formControlName="address">
        </mat-form-field>

        <div style="display: flex; gap: 16px;">
          <mat-form-field appearance="outline" style="flex: 1;">
            <mat-label>信用额度(元)</mat-label>
            <input matInput type="number" formControlName="creditLimit">
          </mat-form-field>

          <mat-form-field appearance="outline" style="flex: 1;">
            <mat-label>销售代表ID</mat-label>
            <input matInput formControlName="salesRepId">
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">取消</button>
      <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="saving">
        {{ saving ? '保存中...' : '保存' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: []
})
export class CustomerEditDialogComponent {
  customerForm: FormGroup;
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<CustomerEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { customer: Customer | null; isEdit: boolean },
    private fb: FormBuilder,
    private customerService: CustomerService,
    private snackBar: MatSnackBar
  ) {
    const cust = data.customer || {} as Customer;
    this.customerForm = this.fb.group({
      name: [cust.name || '', Validators.required],
      type: [cust.type || 'individual'],
      contact: [cust.contact || ''],
      phone: [cust.phone || ''],
      email: [cust.email || ''],
      idCard: [cust.idCard || ''],
      bankCard: [cust.bankCard || ''],
      address: [cust.address || ''],
      creditLimit: [cust.creditLimit ? cust.creditLimit / 100 : 0],
      salesRepId: [cust.salesRepId || '']
    });
  }

  onSubmit(): void {
    if (this.customerForm.invalid) {
      return;
    }

    this.saving = true;
    const formValue = { ...this.customerForm.value };
    formValue.creditLimit = Math.round((formValue.creditLimit || 0) * 100);

    const request = this.data.isEdit
      ? this.customerService.updateCustomer(this.data.customer!.id, formValue)
      : this.customerService.createCustomer(formValue);

    request.subscribe({
      next: (result) => {
        this.saving = false;
        this.snackBar.open('保存成功', '关闭', { duration: 2000 });
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.saving = false;
        this.snackBar.open(err.error?.error || '保存失败', '关闭', { duration: 3000 });
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
