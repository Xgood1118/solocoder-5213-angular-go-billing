package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"billing-system/internal/models"
)

var jwtSecret = []byte("billing-system-secret-key-2024")

type Claims struct {
	UserID   string         `json:"userId"`
	Username string         `json:"username"`
	Role     models.UserRole `json:"role"`
	Name     string         `json:"name"`
	jwt.RegisteredClaims
}

func GenerateToken(user *models.User) (string, error) {
	claims := Claims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		Name:     user.Name,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "billing-system",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func ParseToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

func HashPassword(password string) string {
	return password
}

func CheckPassword(password, hash string) bool {
	return password == hash
}
