package store

import (
	"sync"
	"time"

	"billing-system/internal/models"
	"billing-system/internal/utils"
)

type DataStore struct {
	Customers     sync.Map
	Bills         sync.Map
	Payments      sync.Map
	Users         sync.Map
	AuditLogs     sync.Map
	Exceptions    sync.Map
	TransactionNos sync.Map

	writeMutex sync.RWMutex
}

var Store = &DataStore{}

func InitStore() {
	initUsers()
	initDemoData()
}

func initUsers() {
	users := []*models.User{
		{ID: "U001", Username: "admin", Password: "admin123", Name: "系统管理员", Role: models.RoleAdmin, Email: "admin@billing.com"},
		{ID: "U002", Username: "finance01", Password: "finance123", Name: "财务小王", Role: models.RoleFinance, Email: "finance01@billing.com"},
		{ID: "U003", Username: "support01", Password: "support123", Name: "客服小李", Role: models.RoleSupport, Email: "support01@billing.com"},
		{ID: "U004", Username: "sales01", Password: "sales123", Name: "销售小张", Role: models.RoleSales, Email: "sales01@billing.com"},
	}

	for _, u := range users {
		Store.Users.Store(u.ID, u)
	}
}

func initDemoData() {
	now := time.Now()

	customers := []*models.Customer{
		{
			ID: "C001", Name: "张三科技有限公司", Type: models.CustomerTypeEnterprise,
			Contact: "张三", Email: "zhangsan@example.com", Phone: "13800138001",
			IDCard: "110101199001011234", BankCard: "6222021234567890123",
			Address: "北京市朝阳区xxx路xxx号", RegisteredAt: now.AddDate(-1, 0, 0),
			CreditLimit: 1000000, SalesRepID: "U004",
			CreatedAt: now.AddDate(-1, 0, 0), UpdatedAt: now.AddDate(-1, 0, 0),
		},
		{
			ID: "C002", Name: "李四", Type: models.CustomerTypeIndividual,
			Contact: "李四", Email: "lisi@example.com", Phone: "13900139002",
			IDCard: "310101199203045678", BankCard: "6228481234567890456",
			Address: "上海市浦东新区xxx路xxx号", RegisteredAt: now.AddDate(-2, 0, 0),
			CreditLimit: 500000, SalesRepID: "U004",
			CreatedAt: now.AddDate(-2, 0, 0), UpdatedAt: now.AddDate(-2, 0, 0),
		},
		{
			ID: "C003", Name: "王五贸易有限公司", Type: models.CustomerTypeEnterprise,
			Contact: "王五", Email: "wangwu@example.com", Phone: "13700137003",
			IDCard: "440101198805069012", BankCard: "6217001234567890789",
			Address: "广州市天河区xxx路xxx号", RegisteredAt: now.AddDate(-6, 0, 0),
			CreditLimit: 2000000, SalesRepID: "U004",
			CreatedAt: now.AddDate(-6, 0, 0), UpdatedAt: now.AddDate(-6, 0, 0),
		},
	}

	for _, c := range customers {
		Store.Customers.Store(c.ID, c)
	}

	GenerateDemoBills()
}

func GenerateDemoBills() {
	now := time.Now()
	currentYear := now.Year()
	currentMonth := int(now.Month())

	customerIDs := []string{"C001", "C002", "C003"}
	feeSources := []string{"套餐月租", "超额流量费", "增值服务费", "一次性设备费"}

	for _, cid := range customerIDs {
		for i := 0; i < 6; i++ {
			year := currentYear
			month := currentMonth - i
			if month <= 0 {
				month += 12
				year--
			}

			billID := utils.GenerateID("B")
			dueAmount := int64(50000 + i*10000)
			paidAmount := int64(0)
			status := models.BillStatusIssued

			if i >= 3 {
				paidAmount = dueAmount
				status = models.BillStatusPaid
			} else if i == 2 {
				paidAmount = dueAmount / 2
				status = models.BillStatusPartial
			}

			items := make([]models.BillItem, 0)
			totalAmount := int64(0)
			for j, source := range feeSources {
				itemAmount := int64(10000 + j*5000 + i*2000)
				items = append(items, models.BillItem{
					ID:            utils.GenerateID("I"),
					BillID:        billID,
					FeeSource:     source,
					Amount:        itemAmount,
					GeneratedAt:   time.Date(year, time.Month(month), 1+j, 0, 0, 0, 0, time.Local),
					BusinessOrder: utils.GenerateID("O"),
				})
				totalAmount += itemAmount
			}

			bill := &models.Bill{
				ID:           billID,
				CustomerID:   cid,
				PeriodYear:   year,
				PeriodMonth:  month,
				GeneratedAt:  time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.Local),
				DueAmount:    totalAmount,
				PaidAmount:   paidAmount,
				UnpaidAmount: totalAmount - paidAmount,
				LateFee:      0,
				LateDays:     0,
				Status:       status,
				Items:        items,
				PaymentIDs:   []string{},
				IsException:  false,
				CreatedAt:    time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.Local),
				UpdatedAt:    time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.Local),
			}

			Store.Bills.Store(billID, bill)
		}
	}
}

func (s *DataStore) GetAllCustomers() []*models.Customer {
	var result []*models.Customer
	s.Customers.Range(func(key, value interface{}) bool {
		customer := value.(*models.Customer)
		result = append(result, customer)
		return true
	})
	return result
}

func (s *DataStore) GetAllBills() []*models.Bill {
	var result []*models.Bill
	s.Bills.Range(func(key, value interface{}) bool {
		bill := value.(*models.Bill)
		result = append(result, bill)
		return true
	})
	return result
}

func (s *DataStore) GetAllPayments() []*models.Payment {
	var result []*models.Payment
	s.Payments.Range(func(key, value interface{}) bool {
		payment := value.(*models.Payment)
		result = append(result, payment)
		return true
	})
	return result
}

func (s *DataStore) GetAllAuditLogs() []*models.AuditLog {
	var result []*models.AuditLog
	s.AuditLogs.Range(func(key, value interface{}) bool {
		log := value.(*models.AuditLog)
		result = append(result, log)
		return true
	})
	return result
}

func (s *DataStore) GetCustomerByID(id string) (*models.Customer, bool) {
	val, ok := s.Customers.Load(id)
	if !ok {
		return nil, false
	}
	return val.(*models.Customer), true
}

func (s *DataStore) GetBillByID(id string) (*models.Bill, bool) {
	val, ok := s.Bills.Load(id)
	if !ok {
		return nil, false
	}
	return val.(*models.Bill), true
}

func (s *DataStore) GetPaymentByID(id string) (*models.Payment, bool) {
	val, ok := s.Payments.Load(id)
	if !ok {
		return nil, false
	}
	return val.(*models.Payment), true
}

func (s *DataStore) GetUserByID(id string) (*models.User, bool) {
	val, ok := s.Users.Load(id)
	if !ok {
		return nil, false
	}
	return val.(*models.User), true
}

func (s *DataStore) GetUserByUsername(username string) (*models.User, bool) {
	var found *models.User
	s.Users.Range(func(key, value interface{}) bool {
		user := value.(*models.User)
		if user.Username == username {
			found = user
			return false
		}
		return true
	})
	return found, found != nil
}

func (s *DataStore) GetBillsByCustomerID(customerID string) []*models.Bill {
	var result []*models.Bill
	s.Bills.Range(func(key, value interface{}) bool {
		bill := value.(*models.Bill)
		if bill.CustomerID == customerID {
			result = append(result, bill)
		}
		return true
	})
	return result
}

func (s *DataStore) GetPaymentsByCustomerID(customerID string) []*models.Payment {
	var result []*models.Payment
	s.Payments.Range(func(key, value interface{}) bool {
		payment := value.(*models.Payment)
		if payment.CustomerID == customerID {
			result = append(result, payment)
		}
		return true
	})
	return result
}

func (s *DataStore) TransactionNoExists(transactionNo string) bool {
	_, ok := s.TransactionNos.Load(transactionNo)
	return ok
}

func (s *DataStore) AddAuditLog(log *models.AuditLog) {
	s.AuditLogs.Store(log.ID, log)
}

func (s *DataStore) LockWrite() {
	s.writeMutex.Lock()
}

func (s *DataStore) UnlockWrite() {
	s.writeMutex.Unlock()
}

func (s *DataStore) RLock() {
	s.writeMutex.RLock()
}

func (s *DataStore) RUnlock() {
	s.writeMutex.RUnlock()
}
