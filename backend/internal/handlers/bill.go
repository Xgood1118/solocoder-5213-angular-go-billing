package handlers

import (
	"encoding/csv"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"billing-system/internal/middleware"
	"billing-system/internal/models"
	"billing-system/internal/store"
	"billing-system/internal/utils"
)

type BillHandler struct{}

func NewBillHandler() *BillHandler {
	return &BillHandler{}
}

func (h *BillHandler) List(c *gin.Context) {
	customerID := c.Query("customerId")
	status := c.Query("status")
	periodYear, _ := strconv.Atoi(c.Query("periodYear"))
	periodMonth, _ := strconv.Atoi(c.Query("periodMonth"))
	sortBy := c.Query("sortBy")
	sortOrder := c.DefaultQuery("sortOrder", "desc")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	isException := c.Query("isException")

	_, _, userRole, _ := middleware.GetCurrentUser(c)
	userID := c.GetString(string(middleware.UserIDKey))

	bills := store.Store.GetAllBills()
	var filtered []*models.Bill

	for _, bill := range bills {
		if customerID != "" && bill.CustomerID != customerID {
			continue
		}
		if status != "" && string(bill.Status) != status {
			continue
		}
		if periodYear > 0 && bill.PeriodYear != periodYear {
			continue
		}
		if periodMonth > 0 && bill.PeriodMonth != periodMonth {
			continue
		}
		if isException != "" {
			exceptionBool := isException == "true"
			if bill.IsException != exceptionBool {
				continue
			}
		}

		if userRole == models.RoleSales {
			customer, exists := store.Store.GetCustomerByID(bill.CustomerID)
			if !exists || customer.SalesRepID != userID {
				continue
			}
		}

		filtered = append(filtered, bill)
	}

	if sortBy != "" {
		sort.Slice(filtered, func(i, j int) bool {
			less := false
			switch sortBy {
			case "dueAmount":
				less = filtered[i].DueAmount < filtered[j].DueAmount
			case "unpaidAmount":
				less = filtered[i].UnpaidAmount < filtered[j].UnpaidAmount
			case "generatedAt":
				less = filtered[i].GeneratedAt.Before(filtered[j].GeneratedAt)
			case "status":
				less = filtered[i].Status < filtered[j].Status
			default:
				less = filtered[i].GeneratedAt.After(filtered[j].GeneratedAt)
			}
			if sortOrder == "desc" {
				return !less
			}
			return less
		})
	} else {
		sort.Slice(filtered, func(i, j int) bool {
			return filtered[i].GeneratedAt.After(filtered[j].GeneratedAt)
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

func (h *BillHandler) Get(c *gin.Context) {
	id := c.Param("id")
	bill, exists := store.Store.GetBillByID(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill not found"})
		return
	}

	_, _, userRole, _ := middleware.GetCurrentUser(c)
	userID := c.GetString(string(middleware.UserIDKey))
	if userRole == models.RoleSales {
		customer, custExists := store.Store.GetCustomerByID(bill.CustomerID)
		if !custExists || customer.SalesRepID != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
			return
		}
	}

	middleware.LogAction(c, "bill", id, "view", nil, bill)

	c.JSON(http.StatusOK, bill)
}

func (h *BillHandler) Create(c *gin.Context) {
	var bill models.Bill
	if err := c.ShouldBindJSON(&bill); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	store.Store.LockWrite()
	defer store.Store.UnlockWrite()

	bill.ID = utils.GenerateID("B")
	now := time.Now()
	bill.CreatedAt = now
	bill.UpdatedAt = now
	if bill.GeneratedAt.IsZero() {
		bill.GeneratedAt = now
	}
	if bill.Status == "" {
		bill.Status = models.BillStatusPending
	}
	if bill.Items == nil {
		bill.Items = []models.BillItem{}
	}

	totalDue := int64(0)
	for i := range bill.Items {
		bill.Items[i].ID = utils.GenerateID("I")
		bill.Items[i].BillID = bill.ID
		totalDue += bill.Items[i].Amount
	}
	bill.DueAmount = totalDue
	bill.UnpaidAmount = totalDue - bill.PaidAmount

	store.Store.Bills.Store(bill.ID, &bill)

	middleware.LogAction(c, "bill", bill.ID, "create", nil, bill)

	c.JSON(http.StatusCreated, bill)
}

func (h *BillHandler) Update(c *gin.Context) {
	id := c.Param("id")
	existing, exists := store.Store.GetBillByID(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill not found"})
		return
	}

	before := *existing

	var updated models.Bill
	if err := c.ShouldBindJSON(&updated); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	store.Store.LockWrite()
	defer store.Store.UnlockWrite()

	updated.ID = id
	updated.CreatedAt = existing.CreatedAt
	updated.UpdatedAt = time.Now()
	updated.UnpaidAmount = updated.DueAmount - updated.PaidAmount

	store.Store.Bills.Store(id, &updated)

	middleware.LogAction(c, "bill", id, "update", before, updated)

	c.JSON(http.StatusOK, updated)
}

func (h *BillHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	existing, exists := store.Store.GetBillByID(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill not found"})
		return
	}

	store.Store.LockWrite()
	defer store.Store.UnlockWrite()

	store.Store.Bills.Delete(id)

	middleware.LogAction(c, "bill", id, "delete", existing, nil)

	c.JSON(http.StatusOK, gin.H{"message": "Bill deleted successfully"})
}

func (h *BillHandler) Void(c *gin.Context) {
	id := c.Param("id")
	bill, exists := store.Store.GetBillByID(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill not found"})
		return
	}

	before := *bill

	store.Store.LockWrite()
	defer store.Store.UnlockWrite()

	bill.Status = models.BillStatusVoid
	bill.UpdatedAt = time.Now()

	store.Store.Bills.Store(id, bill)

	middleware.LogAction(c, "bill", id, "void", before, bill)

	c.JSON(http.StatusOK, bill)
}

func (h *BillHandler) Issue(c *gin.Context) {
	id := c.Param("id")
	bill, exists := store.Store.GetBillByID(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill not found"})
		return
	}

	before := *bill

	store.Store.LockWrite()
	defer store.Store.UnlockWrite()

	bill.Status = models.BillStatusIssued
	bill.UpdatedAt = time.Now()

	store.Store.Bills.Store(id, bill)

	middleware.LogAction(c, "bill", id, "issue", before, bill)

	c.JSON(http.StatusOK, bill)
}

func (h *BillHandler) WaiveLateFee(c *gin.Context) {
	id := c.Param("id")
	bill, exists := store.Store.GetBillByID(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill not found"})
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	before := *bill

	userID, _, _, userName := middleware.GetCurrentUser(c)

	store.Store.LockWrite()
	defer store.Store.UnlockWrite()

	now := time.Now()
	bill.LateFeeWaived = true
	bill.WaiveReason = req.Reason
	bill.WaivedBy = userID + " - " + userName
	bill.WaivedAt = &now
	bill.LateFee = 0
	bill.UpdatedAt = now

	store.Store.Bills.Store(id, bill)

	middleware.LogAction(c, "bill", id, "waive_late_fee", before, bill)

	c.JSON(http.StatusOK, bill)
}

func (h *BillHandler) MarkException(c *gin.Context) {
	id := c.Param("id")
	bill, exists := store.Store.GetBillByID(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill not found"})
		return
	}

	var req struct {
		Description string `json:"description" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	before := *bill

	store.Store.LockWrite()
	defer store.Store.UnlockWrite()

	bill.IsException = true
	bill.ExceptionDesc = req.Description
	bill.UpdatedAt = time.Now()

	exception := &models.ReconciliationException{
		ID:          utils.GenerateID("E"),
		BillID:      bill.ID,
		CustomerID:  bill.CustomerID,
		Type:        "amount_mismatch",
		Description: req.Description,
		Status:      "pending",
		CreatedAt:   time.Now(),
	}
	store.Store.Exceptions.Store(exception.ID, exception)

	store.Store.Bills.Store(id, bill)

	middleware.LogAction(c, "bill", id, "mark_exception", before, bill)

	c.JSON(http.StatusOK, bill)
}

func (h *BillHandler) ResolveException(c *gin.Context) {
	id := c.Param("id")
	bill, exists := store.Store.GetBillByID(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill not found"})
		return
	}

	before := *bill

	store.Store.LockWrite()
	defer store.Store.UnlockWrite()

	now := time.Now()
	bill.IsException = false
	bill.ExceptionDesc = ""
	bill.UpdatedAt = now

	userID, _, _, userName := middleware.GetCurrentUser(c)

	var resolvedException *models.ReconciliationException
	store.Store.Exceptions.Range(func(key, value interface{}) bool {
		exc := value.(*models.ReconciliationException)
		if exc.BillID == id && exc.Status == "pending" {
			exc.Status = "resolved"
			exc.HandledBy = userID + " - " + userName
			exc.HandledAt = &now
			resolvedException = exc
			return false
		}
		return true
	})

	if resolvedException != nil {
		store.Store.Exceptions.Store(resolvedException.ID, resolvedException)
	}

	store.Store.Bills.Store(id, bill)

	middleware.LogAction(c, "bill", id, "resolve_exception", before, bill)

	c.JSON(http.StatusOK, bill)
}

func (h *BillHandler) GetExportColumns(c *gin.Context) {
	columns := []models.BillExportColumn{
		{Key: "id", Label: "账单ID", Selected: true},
		{Key: "customerId", Label: "客户ID", Selected: true},
		{Key: "customerName", Label: "客户名称", Selected: true},
		{Key: "period", Label: "账期", Selected: true},
		{Key: "generatedAt", Label: "生成时间", Selected: true},
		{Key: "dueAmount", Label: "应还金额", Selected: true},
		{Key: "paidAmount", Label: "已还金额", Selected: true},
		{Key: "unpaidAmount", Label: "未还金额", Selected: true},
		{Key: "lateFee", Label: "滞纳金", Selected: true},
		{Key: "lateDays", Label: "逾期天数", Selected: false},
		{Key: "status", Label: "状态", Selected: true},
		{Key: "feeSource", Label: "费用来源", Selected: false},
		{Key: "itemAmount", Label: "明细金额", Selected: false},
		{Key: "businessOrder", Label: "业务单号", Selected: false},
	}
	c.JSON(http.StatusOK, columns)
}

func (h *BillHandler) ExportCSV(c *gin.Context) {
	periodYear, _ := strconv.Atoi(c.Query("periodYear"))
	periodMonth, _ := strconv.Atoi(c.Query("periodMonth"))
	customerID := c.Query("customerId")

	var selectedCols []string
	colsParam := c.Query("columns")
	if colsParam != "" {
		selectedCols = strings.Split(colsParam, ",")
	}

	bills := store.Store.GetAllBills()
	var filtered []*models.Bill

	for _, bill := range bills {
		if periodYear > 0 && bill.PeriodYear != periodYear {
			continue
		}
		if periodMonth > 0 && bill.PeriodMonth != periodMonth {
			continue
		}
		if customerID != "" && bill.CustomerID != customerID {
			continue
		}
		filtered = append(filtered, bill)
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=bills.csv")
	c.Writer.Write([]byte("\xEF\xBB\xBF"))

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	headers := []string{"账单ID", "客户ID", "客户名称", "账期", "生成时间", "应还金额(元)", "已还金额(元)", "未还金额(元)", "滞纳金(元)", "状态", "费用来源", "明细金额(元)", "业务单号"}
	if len(selectedCols) > 0 {
		headers = filterHeaders(headers, selectedCols)
	}
	writer.Write(headers)

	for _, bill := range filtered {
		customer, _ := store.Store.GetCustomerByID(bill.CustomerID)
		customerName := ""
		if customer != nil {
			customerName = customer.Name
		}
		period := strconv.Itoa(bill.PeriodYear) + "-" + strconv.Itoa(bill.PeriodMonth)

		statusName := getBillStatusName(bill.Status)

		baseRow := []string{
			bill.ID,
			bill.CustomerID,
			customerName,
			period,
			bill.GeneratedAt.Format("2006-01-02"),
			utils.FenToYuan(bill.DueAmount),
			utils.FenToYuan(bill.PaidAmount),
			utils.FenToYuan(bill.UnpaidAmount),
			utils.FenToYuan(bill.LateFee),
			statusName,
		}

		if len(bill.Items) == 0 {
			row := append(baseRow, "", "", "")
			if len(selectedCols) > 0 {
				row = filterRow(row, selectedCols)
			}
			writer.Write(row)
		} else {
			for _, item := range bill.Items {
				row := append(baseRow, item.FeeSource, utils.FenToYuan(item.Amount), item.BusinessOrder)
				if len(selectedCols) > 0 {
					row = filterRow(row, selectedCols)
				}
				writer.Write(row)
			}
		}
	}
}

func filterHeaders(headers []string, selectedCols []string) []string {
	colMap := map[string]int{
		"id":            0,
		"customerId":    1,
		"customerName":  2,
		"period":        3,
		"generatedAt":   4,
		"dueAmount":     5,
		"paidAmount":    6,
		"unpaidAmount":  7,
		"lateFee":       8,
		"status":        9,
		"feeSource":     10,
		"itemAmount":    11,
		"businessOrder": 12,
	}

	var result []string
	for _, col := range selectedCols {
		if idx, ok := colMap[col]; ok {
			result = append(result, headers[idx])
		}
	}
	return result
}

func filterRow(row []string, selectedCols []string) []string {
	colMap := map[string]int{
		"id":            0,
		"customerId":    1,
		"customerName":  2,
		"period":        3,
		"generatedAt":   4,
		"dueAmount":     5,
		"paidAmount":    6,
		"unpaidAmount":  7,
		"lateFee":       8,
		"status":        9,
		"feeSource":     10,
		"itemAmount":    11,
		"businessOrder": 12,
	}

	var result []string
	for _, col := range selectedCols {
		if idx, ok := colMap[col]; ok && idx < len(row) {
			result = append(result, row[idx])
		}
	}
	return result
}

func getBillStatusName(status models.BillStatus) string {
	switch status {
	case models.BillStatusPending:
		return "待出账"
	case models.BillStatusIssued:
		return "已出账"
	case models.BillStatusPartial:
		return "部分还款"
	case models.BillStatusPaid:
		return "已结清"
	case models.BillStatusOverdue:
		return "逾期"
	case models.BillStatusVoid:
		return "作废"
	default:
		return string(status)
	}
}

func (h *BillHandler) ExportStatement(c *gin.Context) {
	customerID := c.Query("customerId")

	var customers []*models.Customer
	if customerID != "" {
		cust, exists := store.Store.GetCustomerByID(customerID)
		if exists {
			customers = append(customers, cust)
		}
	} else {
		customers = store.Store.GetAllCustomers()
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=statement.csv")
	c.Writer.Write([]byte("\xEF\xBB\xBF"))

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	writer.Write([]string{"客户ID", "客户名称", "客户类型", "应收总额(元)", "已收总额(元)", "应收余额(元)", "滞纳金(元)", "账单数量", "逾期账单数"})

	for _, customer := range customers {
		bills := store.Store.GetBillsByCustomerID(customer.ID)
		totalDue := int64(0)
		totalPaid := int64(0)
		totalLateFee := int64(0)
		billCount := 0
		overdueCount := 0

		for _, bill := range bills {
			if bill.Status == models.BillStatusVoid {
				continue
			}
			totalDue += bill.DueAmount
			totalPaid += bill.PaidAmount
			totalLateFee += bill.LateFee
			billCount++
			if bill.Status == models.BillStatusOverdue {
				overdueCount++
			}
		}

		typeName := "个人"
		if customer.Type == models.CustomerTypeEnterprise {
			typeName = "企业"
		}

		writer.Write([]string{
			customer.ID,
			customer.Name,
			typeName,
			utils.FenToYuan(totalDue),
			utils.FenToYuan(totalPaid),
			utils.FenToYuan(totalDue - totalPaid),
			utils.FenToYuan(totalLateFee),
			strconv.Itoa(billCount),
			strconv.Itoa(overdueCount),
		})
	}
}
