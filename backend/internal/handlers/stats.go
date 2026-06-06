package handlers

import (
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"billing-system/internal/middleware"
	"billing-system/internal/models"
	"billing-system/internal/store"
)

type StatsHandler struct{}

func NewStatsHandler() *StatsHandler {
	return &StatsHandler{}
}

func (h *StatsHandler) Dashboard(c *gin.Context) {
	totalCustomers := int64(0)
	totalBills := int64(0)
	totalDueAmount := int64(0)
	totalPaidAmount := int64(0)
	totalUnpaidAmount := int64(0)
	totalLateFee := int64(0)
	overdueCount := int64(0)
	exceptionCount := int64(0)

	_, _, userRole, _ := middleware.GetCurrentUser(c)
	userID := c.GetString(string(middleware.UserIDKey))

	customers := store.Store.GetAllCustomers()
	for _, customer := range customers {
		if userRole == models.RoleSales && customer.SalesRepID != userID {
			continue
		}
		totalCustomers++
	}

	bills := store.Store.GetAllBills()
	for _, bill := range bills {
		if userRole == models.RoleSales {
			customer, exists := store.Store.GetCustomerByID(bill.CustomerID)
			if !exists || customer.SalesRepID != userID {
				continue
			}
		}

		if bill.Status == models.BillStatusVoid {
			continue
		}
		totalBills++
		totalDueAmount += bill.DueAmount
		totalPaidAmount += bill.PaidAmount
		totalUnpaidAmount += bill.UnpaidAmount
		totalLateFee += bill.LateFee
		if bill.Status == models.BillStatusOverdue {
			overdueCount++
		}
		if bill.IsException {
			exceptionCount++
		}
	}

	monthlyData := getMonthlyStats(userRole, userID)

	c.JSON(http.StatusOK, gin.H{
		"totalCustomers":    totalCustomers,
		"totalBills":        totalBills,
		"totalDueAmount":    totalDueAmount,
		"totalPaidAmount":   totalPaidAmount,
		"totalUnpaidAmount": totalUnpaidAmount,
		"totalLateFee":      totalLateFee,
		"overdueCount":      overdueCount,
		"exceptionCount":    exceptionCount,
		"monthlyStats":      monthlyData,
	})
}

type MonthlyStat struct {
	Year        int   `json:"year"`
	Month       int   `json:"month"`
	DueAmount   int64 `json:"dueAmount"`
	PaidAmount  int64 `json:"paidAmount"`
	BillCount   int   `json:"billCount"`
}

func getMonthlyStats(role models.UserRole, userID string) []MonthlyStat {
	bills := store.Store.GetAllBills()
	statsMap := make(map[string]*MonthlyStat)

	for _, bill := range bills {
		if role == models.RoleSales {
			customer, exists := store.Store.GetCustomerByID(bill.CustomerID)
			if !exists || customer.SalesRepID != userID {
				continue
			}
		}

		if bill.Status == models.BillStatusVoid {
			continue
		}

		key := string(rune(bill.PeriodYear)) + "-" + string(rune(bill.PeriodMonth))
		if _, ok := statsMap[key]; !ok {
			statsMap[key] = &MonthlyStat{
				Year:  bill.PeriodYear,
				Month: bill.PeriodMonth,
			}
		}
		statsMap[key].DueAmount += bill.DueAmount
		statsMap[key].PaidAmount += bill.PaidAmount
		statsMap[key].BillCount++
	}

	var stats []MonthlyStat
	for _, v := range statsMap {
		stats = append(stats, *v)
	}

	sort.Slice(stats, func(i, j int) bool {
		if stats[i].Year == stats[j].Year {
			return stats[i].Month < stats[j].Month
		}
		return stats[i].Year < stats[j].Year
	})

	if len(stats) > 12 {
		stats = stats[len(stats)-12:]
	}

	return stats
}

func (h *StatsHandler) CustomerRanking(c *gin.Context) {
	customers := store.Store.GetAllCustomers()

	type CustomerDebt struct {
		CustomerID   string `json:"customerId"`
		CustomerName string `json:"customerName"`
		TotalDebt    int64  `json:"totalDebt"`
		CreditLimit  int64  `json:"creditLimit"`
		OverCredit   bool   `json:"overCredit"`
	}

	var rankings []CustomerDebt

	for _, customer := range customers {
		bills := store.Store.GetBillsByCustomerID(customer.ID)
		totalDebt := int64(0)
		for _, bill := range bills {
			if bill.Status != models.BillStatusPaid && bill.Status != models.BillStatusVoid {
				totalDebt += bill.UnpaidAmount + bill.LateFee
			}
		}

		rankings = append(rankings, CustomerDebt{
			CustomerID:   customer.ID,
			CustomerName: customer.Name,
			TotalDebt:    totalDebt,
			CreditLimit:  customer.CreditLimit,
			OverCredit:   totalDebt > customer.CreditLimit,
		})
	}

	sort.Slice(rankings, func(i, j int) bool {
		return rankings[i].TotalDebt > rankings[j].TotalDebt
	})

	if len(rankings) > 10 {
		rankings = rankings[:10]
	}

	c.JSON(http.StatusOK, rankings)
}

func (h *StatsHandler) Overview(c *gin.Context) {
	customers := store.Store.GetAllCustomers()
	bills := store.Store.GetAllBills()
	payments := store.Store.GetAllPayments()

	enterpriseCount := 0
	individualCount := 0
	for _, c := range customers {
		if c.Type == models.CustomerTypeEnterprise {
			enterpriseCount++
		} else {
			individualCount++
		}
	}

	statusCounts := make(map[string]int)
	for _, b := range bills {
		statusCounts[string(b.Status)]++
	}

	todayPayments := int64(0)
	todayPaymentCount := 0
	today := time.Now().Format("2006-01-02")
	for _, p := range payments {
		if p.PaymentTime.Format("2006-01-02") == today {
			todayPayments += p.Amount
			todayPaymentCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"customerCount":      len(customers),
		"enterpriseCount":    enterpriseCount,
		"individualCount":    individualCount,
		"billCount":          len(bills),
		"paymentCount":       len(payments),
		"billStatusCounts":   statusCounts,
		"todayPayments":      todayPayments,
		"todayPaymentCount":  todayPaymentCount,
	})
}
