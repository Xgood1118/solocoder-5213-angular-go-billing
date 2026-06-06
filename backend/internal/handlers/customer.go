package handlers

import (
	"bytes"
	"encoding/csv"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tealeg/xlsx"
	"billing-system/internal/middleware"
	"billing-system/internal/models"
	"billing-system/internal/store"
	"billing-system/internal/utils"
)

type CustomerHandler struct{}

func NewCustomerHandler() *CustomerHandler {
	return &CustomerHandler{}
}

func (h *CustomerHandler) List(c *gin.Context) {
	customerType := c.Query("type")
	sortBy := c.Query("sortBy")
	sortOrder := c.DefaultQuery("sortOrder", "asc")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	keyword := c.Query("keyword")

	_, _, userRole, _ := middleware.GetCurrentUser(c)
	userID := c.GetString(string(middleware.UserIDKey))

	customers := store.Store.GetAllCustomers()
	var filtered []*models.Customer

	for _, c := range customers {
		if customerType != "" && string(c.Type) != customerType {
			continue
		}
		if keyword != "" && !strings.Contains(strings.ToLower(c.Name), strings.ToLower(keyword)) &&
			!strings.Contains(strings.ToLower(c.Contact), strings.ToLower(keyword)) {
			continue
		}
		if userRole == models.RoleSales && c.SalesRepID != userID {
			continue
		}
		filtered = append(filtered, c)
	}

	if sortBy != "" {
		sort.Slice(filtered, func(i, j int) bool {
			less := false
			switch sortBy {
			case "name":
				less = filtered[i].Name < filtered[j].Name
			case "creditLimit":
				less = filtered[i].CreditLimit < filtered[j].CreditLimit
			case "registeredAt":
				less = filtered[i].RegisteredAt.Before(filtered[j].RegisteredAt)
			case "type":
				less = filtered[i].Type < filtered[j].Type
			default:
				less = filtered[i].ID < filtered[j].ID
			}
			if sortOrder == "desc" {
				return !less
			}
			return less
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

func (h *CustomerHandler) Get(c *gin.Context) {
	id := c.Param("id")
	customer, exists := store.Store.GetCustomerByID(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	_, _, userRole, _ := middleware.GetCurrentUser(c)
	userID := c.GetString(string(middleware.UserIDKey))
	if userRole == models.RoleSales && customer.SalesRepID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}

	middleware.LogAction(c, "customer", id, "view", nil, customer)

	c.JSON(http.StatusOK, customer)
}

func (h *CustomerHandler) Create(c *gin.Context) {
	var customer models.Customer
	if err := c.ShouldBindJSON(&customer); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	store.Store.LockWrite()
	defer store.Store.UnlockWrite()

	customer.ID = utils.GenerateID("C")
	now := time.Now()
	customer.CreatedAt = now
	customer.UpdatedAt = now
	if customer.RegisteredAt.IsZero() {
		customer.RegisteredAt = now
	}

	store.Store.Customers.Store(customer.ID, &customer)

	middleware.LogAction(c, "customer", customer.ID, "create", nil, customer)

	c.JSON(http.StatusCreated, customer)
}

func (h *CustomerHandler) Update(c *gin.Context) {
	id := c.Param("id")
	existing, exists := store.Store.GetCustomerByID(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	before := *existing

	var updated models.Customer
	if err := c.ShouldBindJSON(&updated); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	store.Store.LockWrite()
	defer store.Store.UnlockWrite()

	updated.ID = id
	updated.CreatedAt = existing.CreatedAt
	updated.UpdatedAt = time.Now()

	store.Store.Customers.Store(id, &updated)

	middleware.LogAction(c, "customer", id, "update", before, updated)

	c.JSON(http.StatusOK, updated)
}

func (h *CustomerHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	existing, exists := store.Store.GetCustomerByID(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	store.Store.LockWrite()
	defer store.Store.UnlockWrite()

	store.Store.Customers.Delete(id)

	middleware.LogAction(c, "customer", id, "delete", existing, nil)

	c.JSON(http.StatusOK, gin.H{"message": "Customer deleted successfully"})
}

func (h *CustomerHandler) GetCustomerDebt(c *gin.Context) {
	id := c.Param("id")
	_, exists := store.Store.GetCustomerByID(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	bills := store.Store.GetBillsByCustomerID(id)
	totalDebt := int64(0)
	totalLateFee := int64(0)
	overdueCount := 0

	for _, bill := range bills {
		if bill.Status != models.BillStatusPaid && bill.Status != models.BillStatusVoid {
			totalDebt += bill.UnpaidAmount
			totalLateFee += bill.LateFee
		}
		if bill.Status == models.BillStatusOverdue {
			overdueCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"customerId":    id,
		"totalDebt":     totalDebt,
		"totalLateFee":  totalLateFee,
		"overdueCount":  overdueCount,
		"billCount":     len(bills),
	})
}

func (h *CustomerHandler) GetConsumptionTrend(c *gin.Context) {
	id := c.Param("id")
	_, exists := store.Store.GetCustomerByID(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	bills := store.Store.GetBillsByCustomerID(id)

	type MonthData struct {
		Year       int   `json:"year"`
		Month      int   `json:"month"`
		TotalAmount int64 `json:"totalAmount"`
		PaidAmount  int64 `json:"paidAmount"`
	}

	var trend []MonthData
	billMap := make(map[string]*MonthData)

	for _, bill := range bills {
		key := strconv.Itoa(bill.PeriodYear) + "-" + strconv.Itoa(bill.PeriodMonth)
		if _, ok := billMap[key]; !ok {
			billMap[key] = &MonthData{
				Year:        bill.PeriodYear,
				Month:       bill.PeriodMonth,
				TotalAmount: 0,
				PaidAmount:  0,
			}
		}
		billMap[key].TotalAmount += bill.DueAmount
		billMap[key].PaidAmount += bill.PaidAmount
	}

	for _, v := range billMap {
		trend = append(trend, *v)
	}

	sort.Slice(trend, func(i, j int) bool {
		if trend[i].Year == trend[j].Year {
			return trend[i].Month < trend[j].Month
		}
		return trend[i].Year < trend[j].Year
	})

	if len(trend) > 12 {
		trend = trend[len(trend)-12:]
	}

	c.JSON(http.StatusOK, trend)
}

func (h *CustomerHandler) ExportExcel(c *gin.Context) {
	customers := store.Store.GetAllCustomers()

	file := xlsx.NewFile()
	sheet, err := file.AddSheet("客户名册")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	headers := []string{"客户ID", "客户名称", "客户类型", "联系人", "邮箱", "电话", "地址", "注册时间", "信用额度(元)"}
	headerRow := sheet.AddRow()
	for _, h := range headers {
		cell := headerRow.AddCell()
		cell.Value = h
		cell.GetStyle().Font.Bold = true
	}

	for _, customer := range customers {
		row := sheet.AddRow()
		row.AddCell().Value = customer.ID
		row.AddCell().Value = customer.Name
		typeName := "个人"
		if customer.Type == models.CustomerTypeEnterprise {
			typeName = "企业"
		}
		row.AddCell().Value = typeName
		row.AddCell().Value = customer.Contact
		row.AddCell().Value = customer.Email
		row.AddCell().Value = customer.Phone
		row.AddCell().Value = customer.Address
		row.AddCell().Value = customer.RegisteredAt.Format("2006-01-02")
		row.AddCell().Value = utils.FenToYuan(customer.CreditLimit)
	}

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename=customers.xlsx")

	var buf bytes.Buffer
	err = file.Write(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
}

func (h *CustomerHandler) BatchImport(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get file"})
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read CSV"})
		return
	}

	if len(records) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CSV file is empty"})
		return
	}

	store.Store.LockWrite()
	defer store.Store.UnlockWrite()

	imported := 0
	skipped := 0
	var skipReasons []string

	for i, record := range records {
		if i == 0 {
			continue
		}
		if len(record) < 8 {
			skipped++
			skipReasons = append(skipReasons, "第"+strconv.Itoa(i+1)+"行：字段不足")
			continue
		}

		name := record[0]
		customerType := record[1]
		contact := record[2]
		email := record[3]
		phone := record[4]
		address := record[5]
		creditLimitStr := record[6]
		salesRepID := record[7]

		if name == "" {
			skipped++
			skipReasons = append(skipReasons, "第"+strconv.Itoa(i+1)+"行：客户名称为空")
			continue
		}

		emailExists := false
		store.Store.Customers.Range(func(key, value interface{}) bool {
			cust := value.(*models.Customer)
			if cust.Email == email && email != "" {
				emailExists = true
				return false
			}
			return true
		})

		if emailExists {
			skipped++
			skipReasons = append(skipReasons, "第"+strconv.Itoa(i+1)+"行：邮箱已存在 - "+email)
			continue
		}

		creditLimit, _ := utils.YuanToFen(creditLimitStr)

		custType := models.CustomerTypeIndividual
		if customerType == "企业" || customerType == "enterprise" {
			custType = models.CustomerTypeEnterprise
		}

		customer := &models.Customer{
			ID:           utils.GenerateID("C"),
			Name:         name,
			Type:         custType,
			Contact:      contact,
			Email:        email,
			Phone:        phone,
			Address:      address,
			CreditLimit:  creditLimit,
			SalesRepID:   salesRepID,
			RegisteredAt: time.Now(),
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}

		store.Store.Customers.Store(customer.ID, customer)
		imported++
	}

	middleware.LogAction(c, "customer", "batch", "batch_import", nil, gin.H{
		"imported": imported,
		"skipped":  skipped,
	})

	c.JSON(http.StatusOK, gin.H{
		"imported":    imported,
		"skipped":     skipped,
		"skipReasons": skipReasons,
	})
}
