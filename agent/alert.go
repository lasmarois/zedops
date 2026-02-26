package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

const alertConfigFile = "alert-config.json"

// EmailColors holds the theme colors for personalized email templates.
type EmailColors struct {
	Bg      string `json:"bg"`
	Card    string `json:"card"`
	Border  string `json:"border"`
	Accent  string `json:"accent"`
	Text    string `json:"text"`
	Muted   string `json:"muted"`
	Success string `json:"success"`
	Error   string `json:"error"`
}

// AlertRecipient holds a recipient email and their personalized theme colors.
type AlertRecipient struct {
	Email  string      `json:"email"`
	Colors EmailColors `json:"colors"`
}

// DefaultEmailColors returns the Solar Flare theme colors (used as fallback).
func DefaultEmailColors() EmailColors {
	return EmailColors{
		Bg: "#080604", Card: "#121010", Border: "#2a1f17", Accent: "#f58b07",
		Text: "#e8e0d6", Muted: "#6b5d52", Success: "#22c55e", Error: "#ef4444",
	}
}

// AlertConfig holds the cached alert configuration received from the manager on auth.
// Stored on disk so it's available even when the manager is unreachable.
type AlertConfig struct {
	ResendApiKey    string           `json:"resendApiKey"`
	ResendFromEmail string           `json:"resendFromEmail"`
	AlertRecipients []AlertRecipient `json:"alertRecipients"`
}

// GetAlertConfigPath returns the path to the alert config file.
func GetAlertConfigPath() string {
	return filepath.Join(StateDir(), alertConfigFile)
}

// LoadAlertConfig loads the cached alert config from disk.
// Returns nil if the file doesn't exist (agent has never connected).
// Handles backward compatibility: old format had alertRecipients as []string.
func LoadAlertConfig() (*AlertConfig, error) {
	path := GetAlertConfigPath()

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to read alert config: %w", err)
	}

	// Try new format first
	var config AlertConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse alert config: %w", err)
	}

	// Check if we got the old string[] format — new format would have non-empty Email fields
	if len(config.AlertRecipients) == 0 {
		var legacy struct {
			ResendApiKey    string   `json:"resendApiKey"`
			ResendFromEmail string   `json:"resendFromEmail"`
			AlertRecipients []string `json:"alertRecipients"`
		}
		if err := json.Unmarshal(data, &legacy); err == nil && len(legacy.AlertRecipients) > 0 {
			defaults := DefaultEmailColors()
			config.ResendApiKey = legacy.ResendApiKey
			config.ResendFromEmail = legacy.ResendFromEmail
			config.AlertRecipients = make([]AlertRecipient, len(legacy.AlertRecipients))
			for i, email := range legacy.AlertRecipients {
				config.AlertRecipients[i] = AlertRecipient{Email: email, Colors: defaults}
			}
		}
	}

	return &config, nil
}

// SaveAlertConfig saves the alert config to disk.
func SaveAlertConfig(config *AlertConfig) error {
	if err := ensureStateDir(); err != nil {
		return err
	}

	path := GetAlertConfigPath()
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal alert config: %w", err)
	}

	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("failed to write alert config: %w", err)
	}

	return nil
}

// SendAlertEmail sends an offline alert email to all configured recipients via Resend API.
func (a *Agent) SendAlertEmail(reason string, failingSince time.Time) {
	if a.alertConfig == nil || a.alertConfig.ResendApiKey == "" || len(a.alertConfig.AlertRecipients) == 0 {
		return
	}

	elapsed := time.Since(failingSince).Round(time.Minute)
	subject := fmt.Sprintf(`[ZedOps] Agent "%s" cannot reach manager`, a.agentName)

	log.Printf("Sending offline alert email to %d recipient(s)...", len(a.alertConfig.AlertRecipients))

	for _, r := range a.alertConfig.AlertRecipients {
		c := r.Colors
		body := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background-color:%s;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:%s;">
  <table width="100%%%%" cellpadding="0" cellspacing="0" bgcolor="%s" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="100%%%%" cellpadding="0" cellspacing="0" bgcolor="%s" style="max-width:520px;border-radius:12px;border:1px solid %s;">
        <tr><td bgcolor="%s" style="padding:32px 32px 16px;text-align:center;border-bottom:1px solid %s;">
          <h1 style="margin:0;font-size:26px;font-weight:700;color:%s;">ZedOps</h1>
          <p style="margin:6px 0 0;font-size:12px;color:%s;letter-spacing:1px;text-transform:uppercase;">Agent Alert</p>
        </td></tr>
        <tr><td bgcolor="%s" style="padding:24px 32px;">
          <p style="margin:0 0 16px;font-size:16px;color:%s;">
            Agent <strong style="color:%s;">%s</strong> has been unable to reach the ZedOps manager for <strong style="color:%s;">%v</strong>.
          </p>
          <p style="margin:0 0 8px;font-size:14px;color:%s;">Reason: <strong style="color:%s;">%s</strong></p>
          <p style="margin:0 0 8px;font-size:14px;color:%s;">Failing since: <strong style="color:%s;">%s</strong></p>
          <p style="margin:16px 0 0;font-size:14px;color:%s;">
            The agent will keep retrying automatically. This alert is sent once per outage.
          </p>
        </td></tr>
        <tr><td bgcolor="%s" style="padding:16px 32px;border-top:1px solid %s;">
          <p style="margin:0;font-size:12px;color:%s;text-align:center;">Sent directly by the agent because the manager is unreachable.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
			c.Bg, c.Text, // body
			c.Bg,                  // outer table
			c.Card, c.Border,      // inner table
			c.Card, c.Border,      // header td
			c.Accent,              // h1
			c.Muted,               // subtitle
			c.Card,                // body td
			c.Text,                // body p
			c.Accent, a.agentName, // agent name
			c.Error, elapsed, // duration
			c.Muted, c.Text, reason, // reason
			c.Muted, c.Text, failingSince.UTC().Format("2006-01-02 15:04:05 UTC"), // failing since
			c.Muted,          // footer p
			c.Card, c.Border, // footer td
			c.Muted,          // footer text
		)

		if err := sendResendEmail(a.alertConfig.ResendApiKey, a.alertConfig.ResendFromEmail, r.Email, subject, body); err != nil {
			log.Printf("Failed to send alert to %s: %v", r.Email, err)
		}
	}
}

// SendRecoveryEmail sends a recovery email to all configured recipients via Resend API.
func (a *Agent) SendRecoveryEmail(failingSince time.Time) {
	if a.alertConfig == nil || a.alertConfig.ResendApiKey == "" || len(a.alertConfig.AlertRecipients) == 0 {
		return
	}

	downtime := time.Since(failingSince).Round(time.Minute)
	subject := fmt.Sprintf(`[ZedOps] Agent "%s" is back online`, a.agentName)

	log.Printf("Sending recovery email to %d recipient(s)...", len(a.alertConfig.AlertRecipients))

	for _, r := range a.alertConfig.AlertRecipients {
		c := r.Colors
		body := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background-color:%s;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:%s;">
  <table width="100%%%%" cellpadding="0" cellspacing="0" bgcolor="%s" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="100%%%%" cellpadding="0" cellspacing="0" bgcolor="%s" style="max-width:520px;border-radius:12px;border:1px solid %s;">
        <tr><td bgcolor="%s" style="padding:32px 32px 16px;text-align:center;border-bottom:1px solid %s;">
          <h1 style="margin:0;font-size:26px;font-weight:700;color:%s;">ZedOps</h1>
          <p style="margin:6px 0 0;font-size:12px;color:%s;letter-spacing:1px;text-transform:uppercase;">Agent Recovery</p>
        </td></tr>
        <tr><td bgcolor="%s" style="padding:24px 32px;">
          <p style="margin:0 0 16px;font-size:16px;color:%s;">
            Agent <strong style="color:%s;">%s</strong> is back <strong style="color:%s;">online</strong>.
          </p>
          <p style="margin:0;font-size:14px;color:%s;">
            Total downtime: <strong style="color:%s;">%v</strong>
          </p>
        </td></tr>
        <tr><td bgcolor="%s" style="padding:16px 32px;border-top:1px solid %s;">
          <p style="margin:0;font-size:12px;color:%s;text-align:center;">Connection to ZedOps manager has been restored.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
			c.Bg, c.Text, // body
			c.Bg,                  // outer table
			c.Card, c.Border,      // inner table
			c.Card, c.Border,      // header td
			c.Accent,              // h1
			c.Muted,               // subtitle
			c.Card,                // body td
			c.Text,                // body p
			c.Accent, a.agentName, // agent name
			c.Success,        // "online"
			c.Muted,          // downtime label
			c.Text, downtime, // downtime value
			c.Card, c.Border, // footer td
			c.Muted,          // footer text
		)

		if err := sendResendEmail(a.alertConfig.ResendApiKey, a.alertConfig.ResendFromEmail, r.Email, subject, body); err != nil {
			log.Printf("Failed to send recovery email to %s: %v", r.Email, err)
		}
	}
}

// sendResendEmail sends a single email via Resend API.
func sendResendEmail(apiKey, fromEmail, to, subject, html string) error {
	from := fromEmail
	if from == "" {
		from = "ZedOps Alerts <noreply@example.com>"
	}
	payload := map[string]interface{}{
		"from":    from,
		"to":      []string{to},
		"subject": subject,
		"html":    html,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal email payload: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("resend API returned status %d", resp.StatusCode)
	}

	return nil
}
