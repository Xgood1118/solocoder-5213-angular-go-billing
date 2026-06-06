import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Customer, PaginationResult, CustomerDebt, ConsumptionTrend } from '../models/models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {

  constructor(private http: HttpClient) { }

  getCustomers(params?: {
    page?: number;
    pageSize?: number;
    type?: string;
    sortBy?: string;
    sortOrder?: string;
    keyword?: string;
  }): Observable<PaginationResult<Customer>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if ((params as any)[key] !== undefined && (params as any)[key] !== null && (params as any)[key] !== '') {
          httpParams = httpParams.set(key, (params as any)[key]);
        }
      });
    }
    return this.http.get<PaginationResult<Customer>>(`${environment.apiUrl}/customers`, { params: httpParams });
  }

  getCustomer(id: string): Observable<Customer> {
    return this.http.get<Customer>(`${environment.apiUrl}/customers/${id}`);
  }

  getCustomerDebt(id: string): Observable<CustomerDebt> {
    return this.http.get<CustomerDebt>(`${environment.apiUrl}/customers/${id}/debt`);
  }

  getConsumptionTrend(id: string): Observable<ConsumptionTrend[]> {
    return this.http.get<ConsumptionTrend[]>(`${environment.apiUrl}/customers/${id}/trend`);
  }

  createCustomer(customer: Partial<Customer>): Observable<Customer> {
    return this.http.post<Customer>(`${environment.apiUrl}/customers`, customer);
  }

  updateCustomer(id: string, customer: Partial<Customer>): Observable<Customer> {
    return this.http.put<Customer>(`${environment.apiUrl}/customers/${id}`, customer);
  }

  deleteCustomer(id: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/customers/${id}`);
  }

  exportExcel(): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/customers/export/excel`, { responseType: 'blob' });
  }

  batchImport(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${environment.apiUrl}/customers/batch-import`, formData);
  }
}
