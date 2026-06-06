package models

import "time"

type CustomerType string

const (
	CustomerTypeIndividual CustomerType = "individual"
	CustomerTypeEnterprise CustomerType = "enterprise"
)

type Customer struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Type        CustomerType `json:"type"`
	Contact     string       `json:"contact"`
	Email       string       `json:"email"`
	Phone       string       `json:"phone"`
	IDCard      string       `json:"idCard"`
	BankCard    string       `json:"bankCard"`
	Address     string       `json:"address"`
	RegisteredAt time.Time   `json:"registeredAt"`
	CreditLimit int64        `json:"creditLimit"`
	SalesRepID  string       `json:"salesRepId"`
	CreatedAt   time.Time    `json:"createdAt"`
	UpdatedAt   time.Time    `json:"updatedAt"`
}

type BillStatus string

const (
	BillStatusPending    BillStatus = "pending"
	BillStatusIssued     BillStatus = "issued"
	BillStatusPartial    BillStatus = "partial"
	BillStatusPaid       BillStatus = "paid"
	BillStatusOverdue    BillStatus = "overdue"
	BillStatusVoid       BillStatus = "void"
)

type BillItem struct {
	ID            string    `json:"id"`
	BillID        string    `json:"billId"`
	FeeSource     string    `json:"feeSource"`
	Amount        int64     `json:"amount"`
	GeneratedAt   time.Time `json:"generatedAt"`
	BusinessOrder string    `json:"businessOrder"`
}

type Bill struct {
	ID            string     `json:"id"`
	CustomerID    string     `json:"customerId"`
	PeriodYear    int        `json:"periodYear"`
	PeriodMonth   int        `json:"periodMonth"`
	GeneratedAt   time.Time  `json:"generatedAt"`
	DueAmount     int64      `json:"dueAmount"`
	PaidAmount    int64      `json:"paidAmount"`
	UnpaidAmount  int64      `json:"unpaidAmount"`
	LateFee       int64      `json:"lateFee"`
	LateDays      int        `json:"lateDays"`
	Status        BillStatus `json:"status"`
	Items         []BillItem `json:"items"`
	PaymentIDs    []string   `json:"paymentIds"`
	IsException   bool       `json:"isException"`
	ExceptionDesc string     `json:"exceptionDesc"`
	LateFeeWaived bool       `json:"lateFeeWaived"`
	WaiveReason   string     `json:"waiveReason"`
	WaivedBy      string     `json:"waivedBy"`
	WaivedAt      *time.Time `json:"waivedAt"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

type PaymentMethod string

const (
	PaymentMethodBankTransfer PaymentMethod = "bank_transfer"
	PaymentMethodAlipay       PaymentMethod = "alipay"
	PaymentMethodWechat       PaymentMethod = "wechat"
	PaymentMethodCash         PaymentMethod = "cash"
	PaymentMethodCorporate    PaymentMethod = "corporate"
)

type Payment struct {
	ID            string        `json:"id"`
	CustomerID    string        `json:"customerId"`
	PaymentTime   time.Time     `json:"paymentTime"`
	Amount        int64         `json:"amount"`
	Method        PaymentMethod `json:"method"`
	TransactionNo string        `json:"transactionNo"`
	BillIDs       []string      `json:"billIds"`
	BillAllocations map[string]int64 `json:"billAllocations"`
	OperatorID    string        `json:"operatorId"`
	OperatorName  string        `json:"operatorName"`
	Remark        string        `json:"remark"`
	CreatedAt     time.Time     `json:"createdAt"`
}

type UserRole string

const (
	RoleAdmin    UserRole = "admin"
	RoleFinance  UserRole = "finance"
	RoleSupport  UserRole = "support"
	RoleSales    UserRole = "sales"
	RoleCustomer UserRole = "customer"
)

type User struct {
	ID       string   `json:"id"`
	Username string   `json:"username"`
	Password string   `json:"-"`
	Name     string   `json:"name"`
	Role     UserRole `json:"role"`
	Email    string   `json:"email"`
}

type AuditLog struct {
	ID           string          `json:"id"`
	ActorID      string          `json:"actorId"`
	ActorRole    UserRole        `json:"actorRole"`
	ActorName    string          `json:"actorName"`
	Action       string          `json:"action"`
	ResourceType string          `json:"resourceType"`
	ResourceID   string          `json:"resourceId"`
	Before       interface{}     `json:"before"`
	After        interface{}     `json:"after"`
	Timestamp    time.Time       `json:"timestamp"`
	IP           string          `json:"ip"`
}

type ReconciliationException struct {
	ID          string    `json:"id"`
	BillID      string    `json:"billId"`
	CustomerID  string    `json:"customerId"`
	Type        string    `json:"type"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	HandledBy   string    `json:"handledBy"`
	HandledAt   *time.Time `json:"handledAt"`
	CreatedAt   time.Time `json:"createdAt"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  *User  `json:"user"`
}

type PaginationQuery struct {
	Page     int `form:"page,default=1"`
	PageSize int `form:"pageSize,default=20"`
}

type PaginationResult struct {
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
	List     interface{} `json:"list"`
}

type BillExportColumn struct {
	Key      string `json:"key"`
	Label    string `json:"label"`
	Selected bool   `json:"selected"`
}
