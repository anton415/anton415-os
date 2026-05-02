package auth

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/smtp"
	"strings"
)

type SMTPSenderConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
}

type SMTPSender struct {
	config SMTPSenderConfig
}

func NewSMTPSender(config SMTPSenderConfig) *SMTPSender {
	return &SMTPSender{config: config}
}

func (sender *SMTPSender) SendMagicLink(ctx context.Context, email string, link string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(sender.config.Host) == "" ||
		strings.TrimSpace(sender.config.Port) == "" ||
		strings.TrimSpace(sender.config.From) == "" {
		return ErrEmailDeliveryDisabled
	}

	address := net.JoinHostPort(sender.config.Host, sender.config.Port)
	var auth smtp.Auth
	if sender.config.Username != "" || sender.config.Password != "" {
		auth = smtp.PlainAuth("", sender.config.Username, sender.config.Password, sender.config.Host)
	}

	message := strings.Join([]string{
		"From: " + sender.config.From,
		"To: " + email,
		"Subject: Your anton415 Hub Todo login link",
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		"Open this link to sign in to your personal Todo:",
		"",
		link,
		"",
		"If you did not request this, ignore this email.",
	}, "\r\n")

	if err := smtp.SendMail(address, auth, sender.config.From, []string{email}, []byte(message)); err != nil {
		if errors.Is(ctx.Err(), context.Canceled) {
			return ctx.Err()
		}
		return fmt.Errorf("send magic link: %w", err)
	}
	return nil
}
