import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardStats, CustomerDebt } from '../models/models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StatsService {

  constructor(private http: HttpClient) { }

  getDashboard(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${environment.apiUrl}/stats/dashboard`);
  }

  getOverview(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/stats/overview`);
  }

  getCustomerRanking(): Observable<CustomerDebt[]> {
    return this.http.get<CustomerDebt[]>(`${environment.apiUrl}/stats/customer-ranking`);
  }
}
