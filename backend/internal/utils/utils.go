package utils

import (
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"time"
)

func GenerateID(prefix string) string {
	now := time.Now()
	timestamp := now.Format("20060102150405")
	random := rand.Intn(10000)
	return fmt.Sprintf("%s%s%04d", prefix, timestamp, random)
}

func FenToYuan(fen int64) string {
	if fen == 0 {
		return "0.00"
	}
	sign := ""
	if fen < 0 {
		sign = "-"
		fen = -fen
	}
	yuan := fen / 100
	cents := fen % 100
	return fmt.Sprintf("%s%d.%02d", sign, yuan, cents)
}

func YuanToFen(yuanStr string) (int64, error) {
	yuanStr = strings.TrimSpace(yuanStr)
	if yuanStr == "" {
		return 0, nil
	}
	parts := strings.Split(yuanStr, ".")
	if len(parts) > 2 {
		return 0, fmt.Errorf("invalid amount format")
	}
	yuanPart := parts[0]
	var centPart string
	if len(parts) == 2 {
		centPart = parts[1]
		if len(centPart) > 2 {
			centPart = centPart[:2]
		}
	}
	yuan, err := strconv.ParseInt(yuanPart, 10, 64)
	if err != nil {
		return 0, err
	}
	cents := int64(0)
	if centPart != "" {
		cents, err = strconv.ParseInt(centPart, 10, 64)
		if err != nil {
			return 0, err
		}
		if len(centPart) == 1 {
			cents *= 10
		}
	}
	return yuan*100 + cents, nil
}

func CalculateLateFee(unpaidAmount int64, lateDays int) int64 {
	if unpaidAmount <= 0 || lateDays <= 0 {
		return 0
	}
	dailyRate := int64(5)
	fee := (unpaidAmount * dailyRate * int64(lateDays)) / 10000
	return fee
}

func MaskIDCard(idCard string) string {
	if len(idCard) < 10 {
		return idCard
	}
	return idCard[:6] + "********" + idCard[len(idCard)-4:]
}

func MaskPhone(phone string) string {
	if len(phone) < 11 {
		return phone
	}
	return phone[:3] + "****" + phone[len(phone)-4:]
}

func MaskBankCard(bankCard string) string {
	if len(bankCard) < 4 {
		return bankCard
	}
	return "**** **** **** " + bankCard[len(bankCard)-4:]
}

func MaskEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return email
	}
	username := parts[0]
	if len(username) <= 2 {
		return username + "***@" + parts[1]
	}
	return username[:2] + "***@" + parts[1]
}

func DaysBetween(a, b time.Time) int {
	a = time.Date(a.Year(), a.Month(), a.Day(), 0, 0, 0, 0, time.Local)
	b = time.Date(b.Year(), b.Month(), b.Day(), 0, 0, 0, 0, time.Local)
	duration := b.Sub(a)
	return int(duration.Hours() / 24)
}

func StartOfMonth(year, month int) time.Time {
	return time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.Local)
}

func EndOfMonth(year, month int) time.Time {
	firstDay := StartOfMonth(year, month)
	lastDay := firstDay.AddDate(0, 1, -1)
	return time.Date(lastDay.Year(), lastDay.Month(), lastDay.Day(), 23, 59, 59, 0, time.Local)
}
