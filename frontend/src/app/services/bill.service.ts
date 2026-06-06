import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Bill, PaginationResult, BillExportColumn, Payment } from '../models/models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BillService {

  constructor(private http: HttpClient) { }

  getBills(params?: {
    page?: number;
    pageSize?: number;
    customerId?: string;
    status?: string;
    periodYear?: number;
    periodMonth?: number;
    sortBy?: string;
    sortOrder?: string;
    isException?: string;
  }): Observable<PaginationResult<Bill>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if ((params as any)[key] !== undefined && (params as any)[key] !== null && (params as any)[key] !== '') {
          httpParams = httpParams.set(key, (params as any)[key]);
        }
      });
    }
    return this.http.get<PaginationResult<Bill>>(`${environment.apiUrl}/bills`, { params: httpParams });
  }

  getBill(id: string): Observable<Bill> {
    return this.http.get<Bill>(`${environment.apiUrl}/bills/${id}`);
  }

  createBill(bill: Partial<Bill>): Observable<Bill> {
    return this.http.post<Bill>(`${environment.apiUrl}/bills`, bill);
  }

  updateBill(id: string, bill: Partial<Bill>): Observable<Bill> {
    return this.http.put<Bill>(`${environment.apiUrl}/bills/${id}`, bill);
  }

  deleteBill(id: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/bills/${id}`);
  }

  voidBill(id: string): Observable<Bill> {
    return this.http.post<Bill>(`${environment.apiUrl}/bills/${id}/void`, {});
  }

  issueBill(id: string): Observable<Bill> {
    return this.http.post<Bill>(`${environment.apiUrl}/bills/${id}/issue`, {});
  }

  waiveLateFee(id: string, reason: string): Observable<Bill> {
    return this.http.post<Bill>(`${environment.apiUrl}/bills/${id}/waive-late-fee`, { reason });
  }

  markException(id: string, description: string): Observable<Bill> {
    return this.http.post<Bill>(`${environment.apiUrl}/bills/${id}/mark-exception`, { description });
  }

  resolveException(id: string): Observable<Bill> {
    return this.http.post<Bill>(`${environment.apiUrl}/bills/${id}/resolve-exception`, {});
  }

  getExportColumns(): Observable<BillExportColumn[]> {
    return this.http.get<BillExportColumn[]>(`${environment.apiUrl}/bills/export/columns`);
  }

  exportCSV(params?: {
    periodYear?: number;
    periodMonth?: number;
    customerId?: string;
    columns?: string;
  }): Observable<Blob> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if ((params as any)[key] !== undefined && (params as any)[key] !== null && (params as any)[key] !== '') {
          httpParams = httpParams.set(key, (params as any)[key]);
        }
      });
    }
    return this.http.get(`${environment.apiUrl}/bills/export/csv`, { 
      params: httpParams,
      responseType: 'blob' 
    });
  }

  exportStatement(customerId?: string): Observable<Blob> {
    let httpParams = new HttpParams();
    if (customerId) {
      httpParams = httpParams.set('customerId', customerId);
    }
    return this.http.get(`${environment.apiUrl}/bills/export/statement`, { 
      params: httpParams,
      responseType: 'blob' 
    });
  }

  getBillPayments(billId: string): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${environment.apiUrl}/payments/bill/${billId}`);
  }
}
