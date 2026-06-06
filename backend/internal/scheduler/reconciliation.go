package scheduler

import (
	"log"
	"time"

	"billing-system/internal/models"
	"billing-system/internal/store"
	"billing-system/internal/utils"
)

func StartDailyReconciliation() {
	go func() {
		for {
			now := time.Now()
			next := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.Local)
			duration := next.Sub(now)

			log.Printf("下次对账任务将在 %v 后执行", duration)
			time.Sleep(duration)

			runDailyReconciliation()
		}
	}()
}

func runDailyReconciliation() {
	log.Println("开始执行每日对账任务...")

	store.Store.LockWrite()
	defer store.Store.UnlockWrite()

	bills := store.Store.GetAllBills()
	updatedCount := 0
	overdueCount := 0

	for _, bill := range bills {
		if bill.Status == models.BillStatusPaid || bill.Status == models.BillStatusVoid || bill.Status == models.BillStatusPending {
			continue
		}

		dueDate := utils.EndOfMonth(bill.PeriodYear, bill.PeriodMonth)
		today := time.Now()

		if today.Before(dueDate) {
			continue
		}

		lateDays := utils.DaysBetween(dueDate, today)
		if lateDays < 0 {
			lateDays = 0
		}

		bill.LateDays = lateDays

		if !bill.LateFeeWaived && bill.UnpaidAmount > 0 && lateDays > 0 {
			lateFee := utils.CalculateLateFee(bill.UnpaidAmount, lateDays)
			bill.LateFee = lateFee
		}

		if lateDays >= 30 && bill.Status != models.BillStatusOverdue && bill.Status != models.BillStatusPaid {
			bill.Status = models.BillStatusOverdue
			overdueCount++
		}

		bill.UpdatedAt = time.Now()
		store.Store.Bills.Store(bill.ID, bill)
		updatedCount++
	}

	log.Printf("每日对账任务完成：更新账单 %d 个，新增逾期 %d 个", updatedCount, overdueCount)
}

func TriggerReconciliationNow() {
	log.Println("手动触发对账任务...")
	go runDailyReconciliation()
}
