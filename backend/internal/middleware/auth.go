package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"billing-system/pkg/auth"
	"billing-system/internal/models"
)

type contextKey string

const (
	UserIDKey   contextKey = "userID"
	UsernameKey contextKey = "username"
	UserRoleKey contextKey = "userRole"
	UserNameKey contextKey = "userName"
)

func JWTAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header format is invalid"})
			c.Abort()
			return
		}

		claims, err := auth.ParseToken(parts[1])
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		c.Set(string(UserIDKey), claims.UserID)
		c.Set(string(UsernameKey), claims.Username)
		c.Set(string(UserRoleKey), claims.Role)
		c.Set(string(UserNameKey), claims.Name)

		c.Next()
	}
}

func RBACMiddleware(allowedRoles ...models.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get(string(UserRoleKey))
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User role not found"})
			c.Abort()
			return
		}

		role := userRole.(models.UserRole)
		allowed := false
		for _, r := range allowedRoles {
			if r == role {
				allowed = true
				break
			}
		}

		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
			c.Abort()
			return
		}

		c.Next()
	}
}

func GetCurrentUser(c *gin.Context) (string, string, models.UserRole, string) {
	userID, _ := c.Get(string(UserIDKey))
	username, _ := c.Get(string(UsernameKey))
	userRole, _ := c.Get(string(UserRoleKey))
	userName, _ := c.Get(string(UserNameKey))

	return userID.(string), username.(string), userRole.(models.UserRole), userName.(string)
}
