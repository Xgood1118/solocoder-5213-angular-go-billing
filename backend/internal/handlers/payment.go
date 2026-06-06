package handlers

import (
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"billing-system/internal/middleware"
	"billing-system/internal/models"
	"billing-system/internal/store"
	"billing-system/internal/utils"
)

type PaymentHandler struct{}

func NewPaymentHandler() *PaymentHandler {
	return &PaymentHandler{}
}

func (h *PaymentHandler) List(c *gin.Context) {
	customerID := c.Query("customerId")
	method := c.Query("method")
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	sortBy := c.Query("sortBy")
	sortOrder := c.DefaultQuery("sortOrder", "desc")

	_, _, userRole, _ := middleware.GetCurrentUser(c)
	userID := c.GetString(string(middleware.UserIDKey))

	payments := store.Store.GetAllPayments()
	var filtered []*models.Payment

	for _, payment := range payments {
		if customerID != "" && payment.CustomerID != customerID {
			continue
		}
		if method != "" && string(payment.Method) != method {
			continue
		}
		if startDate != "" {
			start, _ := time.Parse("2006-01-02", startDate)
			if payment.PaymentTime.Before(start) {
				continue
			}
		}
		if endDate != "" {
			end, _ := time.Parse("2006-01-02", endDate)
			end = end.Add(24 * time.Hour)
			if payment.PaymentTime.After(end) {
				continue
			}
		}

		if userRole == models.RoleSales {
			customer, exists := store.Store.GetCustomerByID(payment.CustomerID)
			if !exists || customer.SalesRepID != userID {
				continue
			}
		}

		filtered = append(filtered, payment)
	}

	if sortBy != "" {
		sort.Slice(filtered, func(i, j int) bool {
			less := false
			switch sortBy {
			case "amount":
				less = filtered[i].Amount < filtered[j].Amount
			case "paymentTime":
				less = filtered[i].PaymentTime.Before(filtered[j].PaymentTime)
			default:
				less = filtered[i].CreatedAt.Before(filtered[j].CreatedAt)
			}
			if sortOrder == "desc" {
				return !less
			}
			return less
		})
	} else {
		sort.Slice(filtered, func(i, j int) bool {
			return filtered[i].PaymentTime.After(filtered[j].PaymentTime)
		})
	}

	total := len(filtered)
	start := (page - 1) * pageSize
	end := start + pageSize
	if start >= total {
		start = total
	}
	if end > total {
		end = total
	}

	result := filtered[start:end]

	c.JSON(http.StatusOK, models.PaginationResult{
		Total:    int64(total),
		Page:     page,
		PageSize: pageSize,
		List:     result,
	})
}

func (h *PaymentHandler) Get(c *gin.Context) {
	id := c.Param("id")
	payment, exists := store.Store.GetPaymentByID(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}

	_, _, userRole, _ := middleware.GetCurrentUser(c)
	userID := c.GetString(string(middleware.UserIDKey))
	if userRole == models.RoleSales {
		customer, custExists := store.Store.GetCustomerByID(payment.CustomerID)
		if !custExists || customer.SalesRepID != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
			return
		}
	}

	middleware.LogAction(c, "payment", id, "view", nil, payment)

	c.JSON(http.StatusOK, payment)
}

type CreatePaymentRequest struct {
	CustomerID    string              `json:"customerId" binding:"required"`
	PaymentTime   string              `json:"paymentTime"`
	Amount        int64               `json:"amount" binding:"required,min=1"`
	Method        models.PaymentMethod `json:"method" binding:"required"`
	TransactionNo string              `json:"transactionNo" binding:"required"`
	BillIDs       []string            `json:"billIds"`
	AllocationType string             `json:"allocationType"`
	BillOrder     []string            `json:"billOrder"`
	Remark        string              `json:"remark"`
}

func (h *PaymentHandler) Create(c *gin.Context) {
	var req CreatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	store.Store.LockWrite()
	defer store.Store.UnlockWrite()

	if store.Store.TransactionNoExists(req.TransactionNo) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "流水号已存在，不能重复入账"})
		return
	}

	_, exists := store.Store.GetCustomerByID(req.CustomerID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	var bills []*models.Bill
	if len(req.BillIDs) > 0 {
		for _, bid := range req.BillIDs {
			bill, ok := store.Store.GetBillByID(bid)
			if !ok {
				c.JSON(http.StatusNotFound, gin.H{"error": "Bill not found: " + bid})
				return
			}
			if bill.CustomerID != req.CustomerID {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Bill " + bid + " 不属于该客户"})
				return
			}
			if bill.Status == models.BillStatusPaid || bill.Status == models.BillStatusVoid {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Bill " + bid + " 已结清或已作废"})
				return
			}
			bills = append(bills, bill)
		}
	} else {
		allBills := store.Store.GetBillsByCustomerID(req.CustomerID)
		for _, bill := range allBills {
			if bill.Status != models.BillStatusPaid && bill.Status != models.BillStatusVoid && bill.UnpaidAmount > 0 {
				bills = append(bills, bill)
			}
		}
		sort.Slice(bills, func(i, j int) bool {
			return bills[i].GeneratedAt.Before(bills[j].GeneratedAt)
		})
	}

	if len(bills) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "没有可还款的账单"})
		return
	}

	totalUnpaid := int64(0)
	for _, bill := range bills {
		totalUnpaid += bill.UnpaidAmount + bill.LateFee
	}

	if req.Amount > totalUnpaid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "还款金额大于待还总额"})
		return
	}

	paymentTime := time.Now()
	if req.PaymentTime != "" {
		parsed, err := time.Parse("2006-01-02 15:04:05", req.PaymentTime)
		if err == nil {
			paymentTime = parsed
		}
	}

	userID, _, _, userName := middleware.GetCurrentUser(c)

	allocation := make(map[string]int64)
	remainingAmount := req.Amount

	if req.AllocationType == "order" && len(req.BillOrder) > 0 {
		for _, billID := range req.BillOrder {
			if remainingAmount <= 0 {
				break
			}
			for _, bill := range bills {
				if bill.ID == billID {
					unpaid := bill.UnpaidAmount + bill.LateFee
					alloc := remainingAmount
					if alloc > unpaid {
						alloc = unpaid
					}
					allocation[bill.ID] = alloc
					remainingAmount -= alloc
					break
				}
			}
		}
	} else {
		totalUnpaidForRatio := int64(0)
		for _, bill := range bills {
			totalUnpaidForRatio += bill.UnpaidAmount + bill.LateFee
		}

		for _, bill := range bills {
			if remainingAmount <= 0 {
				break
			}
			unpaid := bill.UnpaidAmount + bill.LateFee
			var alloc int64
			if totalUnpaidForRatio > 0 {
				alloc = (unpaid * req.Amount) / totalUnpaidForRatio
			}
			if alloc > unpaid {
				alloc = unpaid
			}
			if alloc > remainingAmount {
				alloc = remainingAmount
			}
			allocation[bill.ID] = alloc
			remainingAmount -= alloc
		}

		if remainingAmount > 0 {
			for _, bill := range bills {
				unpaid := bill.UnpaidAmount + bill.LateFee
				alreadyAlloc := allocation[bill.ID]
				canAdd := unpaid - alreadyAlloc
				if canAdd > 0 {
					addAmount := remainingAmount
					if addAmount > canAdd {
						addAmount = canAdd
					}
					allocation[bill.ID] += addAmount
					remainingAmount -= addAmount
					if remainingAmount <= 0 {
						break
					}
				}
			}
		}
	}

	var billIDs []string
	for _, bill := range bills {
		billIDs = append(billIDs, bill.ID)
	}

	paymentID := utils.GenerateID("P")
	payment := &models.Payment{
		ID:              paymentID,
		CustomerID:      req.CustomerID,
		PaymentTime:     paymentTime,
		Amount:          req.Amount,
		Method:          req.Method,
		TransactionNo:   req.TransactionNo,
		BillIDs:         billIDs,
		BillAllocations: allocation,
		OperatorID:      userID,
		OperatorName:    userName,
		Remark:          req.Remark,
		CreatedAt:       time.Now(),
	}

	store.Store.Payments.Store(paymentID, payment)
	store.Store.TransactionNos.Store(req.TransactionNo, paymentID)

	for _, bill := range bills {
		allocAmount, ok := allocation[bill.ID]
		if !ok || allocAmount <= 0 {
			continue
		}

		if bill.LateFee > 0 {
			if allocAmount >= bill.LateFee {
				allocAmount -= bill.LateFee
				bill.LateFee = 0
			} else {
				bill.LateFee -= allocAmount
				allocAmount = 0
			}
		}

		if allocAmount > 0 {
			bill.PaidAmount += allocAmount
			bill.UnpaidAmount = bill.DueAmount - bill.PaidAmount
			if bill.UnpaidAmount < 0 {
				bill.UnpaidAmount = 0
			}
		}

		bill.PaymentIDs = append(bill.PaymentIDs, paymentID)

		if bill.UnpaidAmount == 0 && bill.LateFee == 0 {
			bill.Status = models.BillStatusPaid
		} else if bill.PaidAmount > 0 {
			bill.Status = models.BillStatusPartial
		}

		bill.UpdatedAt = time.Now()
		store.Store.Bills.Store(bill.ID, bill)
	}

	middleware.LogAction(c, "payment", paymentID, "create", nil, payment)

	c.JSON(http.StatusCreated, payment)
}

func (h *PaymentHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	payment, exists := store.Store.GetPaymentByID(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}

	store.Store.LockWrite()
	defer store.Store.UnlockWrite()

	for _, billID := range payment.BillIDs {
		bill, ok := store.Store.GetBillByID(billID)
		if !ok {
			continue
		}

		allocAmount, ok := payment.BillAllocations[billID]
		if ok && allocAmount > 0 {
			bill.PaidAmount -= allocAmount
			if bill.PaidAmount < 0 {
				bill.PaidAmount = 0
			}
			bill.UnpaidAmount = bill.DueAmount - bill.PaidAmount

			newPaymentIDs := make([]string, 0)
			for _, pid := range bill.PaymentIDs {
				if pid != id {
					newPaymentIDs = append(newPaymentIDs, pid)
				}
			}
			bill.PaymentIDs = newPaymentIDs

			if bill.PaidAmount == 0 {
				if bill.LateDays >= 30 {
					bill.Status = models.BillStatusOverdue
				} else {
					bill.Status = models.BillStatusIssued
				}
			} else {
				bill.Status = models.BillStatusPartial
			}

			bill.UpdatedAt = time.Now()
			store.Store.Bills.Store(bill.ID, bill)
		}
	}

	store.Store.Payments.Delete(id)
	store.Store.TransactionNos.Delete(payment.TransactionNo)

	middleware.LogAction(c, "payment", id, "delete", payment, nil)

	c.JSON(http.StatusOK, gin.H{"message": "Payment deleted successfully"})
}

func (h *PaymentHandler) GetByBill(c *gin.Context) {
	billID := c.Param("billId")
	bill, exists := store.Store.GetBillByID(billID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill not found"})
		return
	}

	var payments []*models.Payment
	for _, pid := range bill.PaymentIDs {
		payment, ok := store.Store.GetPaymentByID(pid)
		if ok {
			payments = append(payments, payment)
		}
	}

	sort.Slice(payments, func(i, j int) bool {
		return payments[i].PaymentTime.Before(payments[j].PaymentTime)
	})

	c.JSON(http.StatusOK, payments)
}
