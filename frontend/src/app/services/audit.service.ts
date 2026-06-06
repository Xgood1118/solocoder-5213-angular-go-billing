import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuditLog, PaginationResult } from '../models/models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuditService {

  constructor(private http: HttpClient) { }

  getAuditLogs(params?: {
    page?: number;
    pageSize?: number;
    actorId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<PaginationResult<AuditLog>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if ((params as any)[key] !== undefined && (params as any)[key] !== null && (params as any)[key] !== '') {
          httpParams = httpParams.set(key, (params as any)[key]);
        }
      });
    }
    return this.http.get<PaginationResult<AuditLog>>(`${environment.apiUrl}/audit-logs`, { params: httpParams });
  }

  getAuditLog(id: string): Observable<AuditLog> {
    return this.http.get<AuditLog>(`${environment.apiUrl}/audit-logs/${id}`);
  }
}
