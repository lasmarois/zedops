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

// AlertConfig holds the cached alert configuration received from the manager on auth.
// Stored on disk so it's available even when the manager is unreachable.
type AlertConfig struct {
	ResendApiKey    string   `json:"resendApiKey"`
	AlertRecipients []string `json:"alertRecipients"`
}

// GetAlertConfigPath returns the path to the alert config file (~/.zedops-agent/alert-config.json)
func GetAlertConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get home directory: %w", err)
	}
	return filepath.Join(home, tokenDir, alertConfigFile), nil
}

// LoadAlertConfig loads the cached alert config from disk.
// Returns nil if the file doesn't exist (agent has never connected).
func LoadAlertConfig() (*AlertConfig, error) {
	path, err := GetAlertConfigPath()
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to read alert config: %w", err)
	}

	var config AlertConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse alert config: %w", err)
	}

	return &config, nil
}

// SaveAlertConfig saves the alert config to disk.
func SaveAlertConfig(config *AlertConfig) error {
	path, err := GetAlertConfigPath()
	if err != nil {
		return err
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("failed to create alert config directory: %w", err)
	}

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
	body := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background-color:#080604;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8e0d6;">
  <table width="100%%" cellpadding="0" cellspacing="0" bgcolor="#080604" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="100%%" cellpadding="0" cellspacing="0" bgcolor="#121010" style="max-width:520px;border-radius:12px;border:1px solid #2a1f17;">
        <tr><td bgcolor="#121010" style="padding:32px 32px 16px;text-align:center;border-bottom:1px solid #2a1f17;">
          <h1 style="margin:0;font-size:26px;font-weight:700;color:#f58b07;">ZedOps</h1>
          <p style="margin:6px 0 0;font-size:12px;color:#6b5d52;letter-spacing:1px;text-transform:uppercase;">Agent Alert</p>
        </td></tr>
        <tr><td bgcolor="#121010" style="padding:24px 32px;">
          <p style="margin:0 0 16px;font-size:16px;color:#e8e0d6;">
            Agent <strong style="color:#f58b07;">%s</strong> has been unable to reach the ZedOps manager for <strong style="color:#ef4444;">%v</strong>.
          </p>
          <p style="margin:0 0 8px;font-size:14px;color:#6b5d52;">Reason: <strong style="color:#e8e0d6;">%s</strong></p>
          <p style="margin:0 0 8px;font-size:14px;color:#6b5d52;">Failing since: <strong style="color:#e8e0d6;">%s</strong></p>
          <p style="margin:16px 0 0;font-size:14px;color:#6b5d52;">
            The agent will keep retrying automatically. This alert is sent once per outage.
          </p>
        </td></tr>
        <tr><td bgcolor="#121010" style="padding:16px 32px;border-top:1px solid #2a1f17;">
          <p style="margin:0;font-size:12px;color:#6b5d52;text-align:center;">Sent directly by the agent because the manager is unreachable.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, a.agentName, elapsed, reason, failingSince.UTC().Format("2006-01-02 15:04:05 UTC"))

	log.Printf("Sending offline alert email to %d recipient(s)...", len(a.alertConfig.AlertRecipients))

	for _, email := range a.alertConfig.AlertRecipients {
		if err := sendResendEmail(a.alertConfig.ResendApiKey, email, subject, body); err != nil {
			log.Printf("Failed to send alert to %s: %v", email, err)
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
	body := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background-color:#080604;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8e0d6;">
  <table width="100%%" cellpadding="0" cellspacing="0" bgcolor="#080604" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="100%%" cellpadding="0" cellspacing="0" bgcolor="#121010" style="max-width:520px;border-radius:12px;border:1px solid #2a1f17;">
        <tr><td bgcolor="#121010" style="padding:32px 32px 16px;text-align:center;border-bottom:1px solid #2a1f17;">
          <h1 style="margin:0;font-size:26px;font-weight:700;color:#f58b07;">ZedOps</h1>
          <p style="margin:6px 0 0;font-size:12px;color:#6b5d52;letter-spacing:1px;text-transform:uppercase;">Agent Recovery</p>
        </td></tr>
        <tr><td bgcolor="#121010" style="padding:24px 32px;">
          <p style="margin:0 0 16px;font-size:16px;color:#e8e0d6;">
            Agent <strong style="color:#f58b07;">%s</strong> is back <strong style="color:#22c55e;">online</strong>.
          </p>
          <p style="margin:0;font-size:14px;color:#6b5d52;">
            Total downtime: <strong style="color:#e8e0d6;">%v</strong>
          </p>
        </td></tr>
        <tr><td bgcolor="#121010" style="padding:16px 32px;border-top:1px solid #2a1f17;">
          <p style="margin:0;font-size:12px;color:#6b5d52;text-align:center;">Connection to ZedOps manager has been restored.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, a.agentName, downtime)

	log.Printf("Sending recovery email to %d recipient(s)...", len(a.alertConfig.AlertRecipients))

	for _, email := range a.alertConfig.AlertRecipients {
		if err := sendResendEmail(a.alertConfig.ResendApiKey, email, subject, body); err != nil {
			log.Printf("Failed to send recovery email to %s: %v", email, err)
		}
	}
}

// sendResendEmail sends a single email via Resend API.
func sendResendEmail(apiKey, to, subject, html string) error {
	payload := map[string]interface{}{
		"from":    "ZedOps Alerts <noreply@example.com>",
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
