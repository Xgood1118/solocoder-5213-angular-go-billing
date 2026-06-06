package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"time"

	"github.com/gin-gonic/gin"
	"billing-system/internal/models"
	"billing-system/internal/store"
	"billing-system/internal/utils"
)

type responseBodyWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (r responseBodyWriter) Write(b []byte) (int, error) {
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}

func AuditLogMiddleware(resourceType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		method := c.Request.Method
		if method == "GET" || method == "OPTIONS" {
			c.Next()
			return
		}

		userID, _, userRole, userName := GetCurrentUser(c)
		action := getActionName(c.Request.Method, c.FullPath())

		var requestBody []byte
		if c.Request.Body != nil {
			requestBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		}

		w := &responseBodyWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer}
		c.Writer = w

		c.Next()

		status := c.Writer.Status()
		if status < 200 || status >= 300 {
			return
		}

		var before, after interface{}
		if len(requestBody) > 0 {
			json.Unmarshal(requestBody, &before)
		}
		responseBody := w.body.Bytes()
		if len(responseBody) > 0 {
			json.Unmarshal(responseBody, &after)
		}

		resourceID := c.Param("id")

		log := &models.AuditLog{
			ID:           utils.GenerateID("A"),
			ActorID:      userID,
			ActorRole:    userRole,
			ActorName:    userName,
			Action:       action,
			ResourceType: resourceType,
			ResourceID:   resourceID,
			Before:       before,
			After:        after,
			Timestamp:    time.Now(),
			IP:           c.ClientIP(),
		}

		store.Store.AddAuditLog(log)
	}
}

func getActionName(method, path string) string {
	methodMap := map[string]string{
		"POST":   "create",
		"PUT":    "update",
		"PATCH":  "update",
		"DELETE": "delete",
	}

	action, ok := methodMap[method]
	if !ok {
		action = method
	}

	return action
}

func LogAction(c *gin.Context, resourceType, resourceID, action string, before, after interface{}) {
	userID, _, userRole, userName := GetCurrentUser(c)

	log := &models.AuditLog{
		ID:           utils.GenerateID("A"),
		ActorID:      userID,
		ActorRole:    userRole,
		ActorName:    userName,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Before:       before,
		After:        after,
		Timestamp:    time.Now(),
		IP:           c.ClientIP(),
	}

	store.Store.AddAuditLog(log)
}
