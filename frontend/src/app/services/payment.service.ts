import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Payment, PaginationResult } from '../models/models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {

  constructor(private http: HttpClient) { }

  getPayments(params?: {
    page?: number;
    pageSize?: number;
    customerId?: string;
    method?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Observable<PaginationResult<Payment>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if ((params as any)[key] !== undefined && (params as any)[key] !== null && (params as any)[key] !== '') {
          httpParams = httpParams.set(key, (params as any)[key]);
        }
      });
    }
    return this.http.get<PaginationResult<Payment>>(`${environment.apiUrl}/payments`, { params: httpParams });
  }

  getPayment(id: string): Observable<Payment> {
    return this.http.get<Payment>(`${environment.apiUrl}/payments/${id}`);
  }

  createPayment(payment: any): Observable<Payment> {
    return this.http.post<Payment>(`${environment.apiUrl}/payments`, payment);
  }

  deletePayment(id: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/payments/${id}`);
  }
}
