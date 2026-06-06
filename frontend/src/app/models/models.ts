export interface Customer {
  id: string;
  name: string;
  type: 'individual' | 'enterprise';
  contact: string;
  email: string;
  phone: string;
  idCard: string;
  bankCard: string;
  address: string;
  registeredAt: string;
  creditLimit: number;
  salesRepId: string;
  createdAt: string;
  updatedAt: string;
}

export type BillStatus = 'pending' | 'issued' | 'partial' | 'paid' | 'overdue' | 'void';

export interface BillItem {
  id: string;
  billId: string;
  feeSource: string;
  amount: number;
  generatedAt: string;
  businessOrder: string;
}

export interface Bill {
  id: string;
  customerId: string;
  periodYear: number;
  periodMonth: number;
  generatedAt: string;
  dueAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  lateFee: number;
  lateDays: number;
  status: BillStatus;
  items: BillItem[];
  paymentIds: string[];
  isException: boolean;
  exceptionDesc: string;
  lateFeeWaived: boolean;
  waiveReason: string;
  waivedBy: string;
  waivedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'bank_transfer' | 'alipay' | 'wechat' | 'cash' | 'corporate';

export interface Payment {
  id: string;
  customerId: string;
  paymentTime: string;
  amount: number;
  method: PaymentMethod;
  transactionNo: string;
  billIds: string[];
  billAllocations: Record<string, number>;
  operatorId: string;
  operatorName: string;
  remark: string;
  createdAt: string;
}

export type UserRole = 'admin' | 'finance' | 'support' | 'sales' | 'customer';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  email: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorRole: UserRole;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  before: any;
  after: any;
  timestamp: string;
  ip: string;
}

export interface PaginationResult<T> {
  total: number;
  page: number;
  pageSize: number;
  list: T[];
}

export interface DashboardStats {
  totalCustomers: number;
  totalBills: number;
  totalDueAmount: number;
  totalPaidAmount: number;
  totalUnpaidAmount: number;
  totalLateFee: number;
  overdueCount: number;
  exceptionCount: number;
  monthlyStats: MonthlyStat[];
}

export interface MonthlyStat {
  year: number;
  month: number;
  dueAmount: number;
  paidAmount: number;
  billCount: number;
}

export interface CustomerDebt {
  customerId: string;
  customerName: string;
  totalDebt: number;
  creditLimit: number;
  overCredit: boolean;
}

export interface ConsumptionTrend {
  year: number;
  month: number;
  totalAmount: number;
  paidAmount: number;
}

export interface BillExportColumn {
  key: string;
  label: string;
  selected: boolean;
}
