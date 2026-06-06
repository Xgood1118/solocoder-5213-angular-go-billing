package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"billing-system/internal/handlers"
	"billing-system/internal/middleware"
	"billing-system/internal/models"
	"billing-system/internal/scheduler"
	"billing-system/internal/store"
)

func main() {
	store.InitStore()
	scheduler.StartDailyReconciliation()

	r := gin.Default()

	r.Use(CORS())

	authHandler := handlers.NewAuthHandler()
	customerHandler := handlers.NewCustomerHandler()
	billHandler := handlers.NewBillHandler()
	paymentHandler := handlers.NewPaymentHandler()
	statsHandler := handlers.NewStatsHandler()
	auditLogHandler := handlers.NewAuditLogHandler()

	r.POST("/api/v1/auth/login", authHandler.Login)

	api := r.Group("/api/v1")
	api.Use(middleware.JWTAuthMiddleware())
	{
		api.GET("/auth/me", authHandler.GetCurrentUser)

		customers := api.Group("/customers")
		{
			customers.GET("", customerHandler.List)
			customers.GET("/:id", customerHandler.Get)
			customers.GET("/:id/debt", customerHandler.GetCustomerDebt)
			customers.GET("/:id/trend", customerHandler.GetConsumptionTrend)
			customers.GET("/export/excel", middleware.RBACMiddleware(models.RoleAdmin, models.RoleFinance), customerHandler.ExportExcel)

			customers.POST("", middleware.RBACMiddleware(models.RoleAdmin, models.RoleFinance), middleware.AuditLogMiddleware("customer"), customerHandler.Create)
			customers.POST("/batch-import", middleware.RBACMiddleware(models.RoleAdmin), customerHandler.BatchImport)
			customers.PUT("/:id", middleware.RBACMiddleware(models.RoleAdmin, models.RoleFinance), middleware.AuditLogMiddleware("customer"), customerHandler.Update)
			customers.DELETE("/:id", middleware.RBACMiddleware(models.RoleAdmin), middleware.AuditLogMiddleware("customer"), customerHandler.Delete)
		}

		bills := api.Group("/bills")
		{
			bills.GET("", billHandler.List)
			bills.GET("/:id", billHandler.Get)
			bills.GET("/export/columns", billHandler.GetExportColumns)
			bills.GET("/export/csv", middleware.RBACMiddleware(models.RoleAdmin, models.RoleFinance), billHandler.ExportCSV)
			bills.GET("/export/statement", middleware.RBACMiddleware(models.RoleAdmin, models.RoleFinance), billHandler.ExportStatement)

			bills.POST("", middleware.RBACMiddleware(models.RoleAdmin, models.RoleFinance), middleware.AuditLogMiddleware("bill"), billHandler.Create)
			bills.PUT("/:id", middleware.RBACMiddleware(models.RoleAdmin, models.RoleFinance), middleware.AuditLogMiddleware("bill"), billHandler.Update)
			bills.DELETE("/:id", middleware.RBACMiddleware(models.RoleAdmin), middleware.AuditLogMiddleware("bill"), billHandler.Delete)

			bills.POST("/:id/void", middleware.RBACMiddleware(models.RoleAdmin, models.RoleFinance), middleware.AuditLogMiddleware("bill"), billHandler.Void)
			bills.POST("/:id/issue", middleware.RBACMiddleware(models.RoleAdmin, models.RoleFinance), middleware.AuditLogMiddleware("bill"), billHandler.Issue)
			bills.POST("/:id/waive-late-fee", middleware.RBACMiddleware(models.RoleAdmin), middleware.AuditLogMiddleware("bill"), billHandler.WaiveLateFee)
			bills.POST("/:id/mark-exception", middleware.RBACMiddleware(models.RoleAdmin, models.RoleFinance), middleware.AuditLogMiddleware("bill"), billHandler.MarkException)
			bills.POST("/:id/resolve-exception", middleware.RBACMiddleware(models.RoleAdmin, models.RoleFinance), middleware.AuditLogMiddleware("bill"), billHandler.ResolveException)
		}

		payments := api.Group("/payments")
		{
			payments.GET("", paymentHandler.List)
			payments.GET("/:id", paymentHandler.Get)
			payments.GET("/bill/:billId", paymentHandler.GetByBill)

			payments.POST("", middleware.RBACMiddleware(models.RoleAdmin, models.RoleFinance), middleware.AuditLogMiddleware("payment"), paymentHandler.Create)
			payments.DELETE("/:id", middleware.RBACMiddleware(models.RoleAdmin), middleware.AuditLogMiddleware("payment"), paymentHandler.Delete)
		}

		stats := api.Group("/stats")
		{
			stats.GET("/dashboard", statsHandler.Dashboard)
			stats.GET("/overview", statsHandler.Overview)
			stats.GET("/customer-ranking", statsHandler.CustomerRanking)
		}

		auditLogs := api.Group("/audit-logs")
		auditLogs.Use(middleware.RBACMiddleware(models.RoleAdmin))
		{
			auditLogs.GET("", auditLogHandler.List)
			auditLogs.GET("/:id", auditLogHandler.Get)
		}
	}

	log.Println("服务器启动在 :8081")
	r.Run(":8113")
}

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
