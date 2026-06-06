package handlers

import (
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"billing-system/internal/models"
	"billing-system/internal/store"
)

type AuditLogHandler struct{}

func NewAuditLogHandler() *AuditLogHandler {
	return &AuditLogHandler{}
}

func (h *AuditLogHandler) List(c *gin.Context) {
	actorID := c.Query("actorId")
	action := c.Query("action")
	resourceType := c.Query("resourceType")
	resourceID := c.Query("resourceId")
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	logs := store.Store.GetAllAuditLogs()
	var filtered []*models.AuditLog

	for _, log := range logs {
		if actorID != "" && log.ActorID != actorID {
			continue
		}
		if action != "" && log.Action != action {
			continue
		}
		if resourceType != "" && log.ResourceType != resourceType {
			continue
		}
		if resourceID != "" && log.ResourceID != resourceID {
			continue
		}
		if startDate != "" {
			start, _ := time.Parse("2006-01-02", startDate)
			if log.Timestamp.Before(start) {
				continue
			}
		}
		if endDate != "" {
			end, _ := time.Parse("2006-01-02", endDate)
			end = end.Add(24 * time.Hour)
			if log.Timestamp.After(end) {
				continue
			}
		}
		filtered = append(filtered, log)
	}

	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].Timestamp.After(filtered[j].Timestamp)
	})

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

func (h *AuditLogHandler) Get(c *gin.Context) {
	id := c.Param("id")
	val, ok := store.Store.AuditLogs.Load(id)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Audit log not found"})
		return
	}
	c.JSON(http.StatusOK, val.(*models.AuditLog))
}
