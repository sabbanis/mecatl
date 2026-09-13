package main

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"errors"
	"flag"
	"io"
	"net"
	"os"
	"time"

	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/internal/adapter/mcpbroker"
	"github.com/stacklok/mecatl/internal/adapter/mcpbrokergrpc"
	"github.com/stacklok/mecatl/internal/adapter/mcpbrokerserver"
)

const (
	brokerAPIVersion = "mecabroker.mecatl.dev/v1"
	maxConfigBytes   = 1 << 20
	maxJWKSStaleness = 24 * time.Hour
)

type duration time.Duration

func (d *duration) UnmarshalJSON(raw []byte) error {
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return errors.New("duration must be a string")
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return errors.New("duration is invalid")
	}
	*d = duration(parsed)
	return nil
}
func (d duration) value() time.Duration { return time.Duration(d) }

type fileConfig struct {
	APIVersion string `json:"api_version"`
	Listener   struct {
		PublicAddress string `json:"public_address"`
		TLSCertFile   string `json:"tls_cert_file"`
		TLSKeyFile    string `json:"tls_key_file"`
	} `json:"listener"`
	WorkloadJWT struct {
		Issuer           string   `json:"issuer"`
		JWKSURI          string   `json:"jwks_uri"`
		Audience         string   `json:"audience"`
		Subject          string   `json:"subject"`
		TrustBundleFile  string   `json:"trust_bundle_file"`
		MaxJWKSStaleness duration `json:"max_jwks_staleness"`
	} `json:"workload_jwt"`
	CallbackURL string        `json:"callback_url"`
	Profiles    []fileProfile `json:"profiles"`
	Drain       struct {
		PropagationDelay        duration `json:"propagation_delay"`
		Timeout                 duration `json:"timeout"`
		ListenerShutdownTimeout duration `json:"listener_shutdown_timeout"`
	} `json:"drain"`
	Transport struct {
		RPCDeadline        duration `json:"rpc_deadline"`
		ExecuteDeadline    duration `json:"execute_deadline"`
		HandleIdleTimeout  duration `json:"handle_idle_timeout"`
		SweepInterval      duration `json:"sweep_interval"`
		CleanupTimeout     duration `json:"cleanup_timeout"`
		MaxHandles         int      `json:"max_handles"`
		MaxOwners          int      `json:"max_owners"`
		MaxReceipts        int      `json:"max_receipts"`
		MaxReceiptBytes    int      `json:"max_receipt_bytes"`
		MaxPendingControls int      `json:"max_pending_controls"`
		MaxActiveExecutes  int      `json:"max_active_executes"`
	} `json:"transport"`
	Runtime struct {
		MaxLogicalSessions   int      `json:"max_logical_sessions"`
		LogicalRetention     duration `json:"logical_retention"`
		MaxPendingAuthStates int      `json:"max_pending_auth_states"`
	} `json:"runtime"`
}
type fileProfile struct {
	Name   string       `json:"name"`
	URL    string       `json:"url"`
	Auth   string       `json:"auth"`
	OAuth  *fileOAuth   `json:"oauth,omitempty"`
	Static []fileStatic `json:"tools,omitempty"`
}
type fileOAuth struct {
	Issuer                string   `json:"issuer,omitempty"`
	AuthorizationEndpoint string   `json:"authorization_endpoint,omitempty"`
	TokenEndpoint         string   `json:"token_endpoint,omitempty"`
	ClientID              string   `json:"client_id"`
	ClientSecretFile      string   `json:"client_secret_file"`
	Scopes                []string `json:"scopes"`
	RequestRefreshToken   bool     `json:"request_refresh_token,omitempty"`
}
type fileStatic struct {
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Schema      json.RawMessage `json:"schema"`
	ReadOnly    bool            `json:"read_only,omitempty"`
}

func parseFlags() (fileConfig, error) { return parseConfigFlag(flag.CommandLine) }

func parseConfigFlag(flags *flag.FlagSet) (fileConfig, error) {
	var path string
	flags.StringVar(&path, "config", "", "strict JSON broker configuration (required)")
	if err := flags.Parse(os.Args[1:]); err != nil {
		return fileConfig{}, err
	}
	if path == "" {
		return fileConfig{}, errors.New("--config is required")
	}
	if flags.NArg() != 0 {
		return fileConfig{}, errors.New("serving accepts only --config")
	}
	return readConfig(path)
}

func readConfig(path string) (fileConfig, error) {
	file, err := os.Open(path)
	if err != nil {
		return fileConfig{}, errors.New("open broker configuration")
	}
	defer func() { _ = file.Close() }()
	data, err := io.ReadAll(io.LimitReader(file, maxConfigBytes+1))
	if err != nil || len(data) > maxConfigBytes {
		return fileConfig{}, errors.New("broker configuration exceeds size limit")
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var cfg fileConfig
	if err := decoder.Decode(&cfg); err != nil {
		return fileConfig{}, errors.New("decode broker configuration")
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return fileConfig{}, errors.New("broker configuration has trailing data")
	}
	if err := cfg.validate(); err != nil {
		return fileConfig{}, err
	}
	return cfg, nil
}

const maxClientSecretBytes = 64 << 10

// validateConfiguredSecretFile bounds secret handling at configuration admission.
// ToolHive reads the path only while constructing its upstream client.
func validateConfiguredSecretFile(path string) error {
	if path == "" {
		return nil
	}
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer func() { _ = file.Close() }()
	secret, err := io.ReadAll(io.LimitReader(file, maxClientSecretBytes+1))
	if err != nil || len(secret) > maxClientSecretBytes || len(bytes.TrimSpace(secret)) == 0 {
		return errors.New("invalid")
	}
	return nil
}

//nolint:gocyclo // configuration admission keeps cross-field policy together.
func (cfg fileConfig) validate() error {
	if cfg.APIVersion != brokerAPIVersion {
		return errors.New("broker configuration API version is required and unsupported versions are rejected")
	}
	if cfg.Listener.PublicAddress == "" || cfg.Listener.TLSCertFile == "" || cfg.Listener.TLSKeyFile == "" {
		return errors.New("complete public listener configuration is required")
	}
	if _, _, err := net.SplitHostPort(cfg.Listener.PublicAddress); err != nil {
		return errors.New("public listener address is invalid")
	}
	if cfg.WorkloadJWT.Issuer == "" || cfg.WorkloadJWT.JWKSURI == "" || cfg.WorkloadJWT.Audience == "" || cfg.WorkloadJWT.Subject == "" || cfg.WorkloadJWT.TrustBundleFile == "" {
		return errors.New("complete workload-JWT configuration is required")
	}
	if err := mcpbroker.ValidateProtectedURL(cfg.WorkloadJWT.Issuer, "workload-JWT issuer"); err != nil {
		return err
	}
	if err := mcpbroker.ValidateProtectedURL(cfg.WorkloadJWT.JWKSURI, "workload-JWT JWKS URI"); err != nil {
		return err
	}
	if cfg.WorkloadJWT.MaxJWKSStaleness.value() <= 0 || cfg.WorkloadJWT.MaxJWKSStaleness.value() > maxJWKSStaleness {
		return errors.New("workload-JWT JWKS staleness is invalid")
	}
	if err := mcpbroker.ValidateProtectedURL(cfg.CallbackURL, "broker callback"); err != nil {
		return err
	}
	if len(cfg.Profiles) == 0 {
		return errors.New("broker profiles are required")
	}
	for _, d := range []duration{cfg.Drain.PropagationDelay, cfg.Drain.Timeout, cfg.Drain.ListenerShutdownTimeout, cfg.Transport.RPCDeadline, cfg.Transport.ExecuteDeadline, cfg.Transport.HandleIdleTimeout, cfg.Transport.SweepInterval, cfg.Transport.CleanupTimeout, cfg.Runtime.LogicalRetention} {
		if d.value() <= 0 {
			return errors.New("broker duration bounds must be positive")
		}
	}
	for _, n := range []int{cfg.Transport.MaxHandles, cfg.Transport.MaxOwners, cfg.Transport.MaxReceipts, cfg.Transport.MaxReceiptBytes, cfg.Transport.MaxPendingControls, cfg.Transport.MaxActiveExecutes, cfg.Runtime.MaxLogicalSessions, cfg.Runtime.MaxPendingAuthStates} {
		if n <= 0 {
			return errors.New("broker capacity bounds must be positive")
		}
	}
	for _, profile := range cfg.Profiles {
		if profile.Name == "" || profile.URL == "" {
			return errors.New("profile name and URL are required")
		}
		switch profile.Auth {
		case "none":
			if profile.OAuth != nil || len(profile.Static) != 0 {
				return errors.New("anonymous profile contains protected configuration")
			}
		case "oauth":
			if profile.OAuth == nil || profile.OAuth.ClientID == "" || profile.OAuth.ClientSecretFile == "" {
				return errors.New("protected profile OAuth client configuration is required")
			}
			if err := validateConfiguredSecretFile(profile.OAuth.ClientSecretFile); err != nil {
				return errors.New("protected profile OAuth client secret file is invalid")
			}
			if err := mcpbroker.ValidateProtectedURL(profile.URL, "protected upstream URL"); err != nil {
				return err
			}
			for label, endpoint := range map[string]string{"issuer": profile.OAuth.Issuer, "authorization endpoint": profile.OAuth.AuthorizationEndpoint, "token endpoint": profile.OAuth.TokenEndpoint} {
				if endpoint != "" {
					if err := mcpbroker.ValidateProtectedURL(endpoint, label); err != nil {
						return err
					}
				}
			}
			if (profile.OAuth.AuthorizationEndpoint == "") != (profile.OAuth.TokenEndpoint == "") {
				return errors.New("protected profile has partial OAuth endpoints")
			}
			if profile.OAuth.Issuer == "" && profile.OAuth.AuthorizationEndpoint == "" {
				return errors.New("protected profile OAuth issuer or endpoints are required")
			}
			for _, static := range profile.Static {
				if static.Name == "" || len(static.Schema) == 0 || !json.Valid(static.Schema) || static.Schema[0] != '{' {
					return errors.New("protected profile static tool is invalid")
				}
			}
		default:
			return errors.New("profile auth mode is invalid")
		}
	}
	return nil
}

func (cfg fileConfig) loadProductionConfig(diagnostics port.Diagnostics) (mcpbrokerserver.ProductionConfig, error) {
	certificate, err := tls.LoadX509KeyPair(cfg.Listener.TLSCertFile, cfg.Listener.TLSKeyFile)
	if err != nil {
		return mcpbrokerserver.ProductionConfig{}, errors.New("load server identity")
	}
	caPEM, err := os.ReadFile(cfg.WorkloadJWT.TrustBundleFile)
	if err != nil {
		return mcpbrokerserver.ProductionConfig{}, errors.New("read workload-JWT trust bundle")
	}
	return cfg.productionConfig(certificate, caPEM, diagnostics), nil
}

func (cfg fileConfig) productionConfig(certificate tls.Certificate, caPEM []byte, diagnostics port.Diagnostics) mcpbrokerserver.ProductionConfig {
	return mcpbrokerserver.ProductionConfig{
		PublicAddress: cfg.Listener.PublicAddress,
		AdminAddress:  defaultAdminAddress,
		TLSConfig:     &tls.Config{Certificates: []tls.Certificate{certificate}, MinVersion: tls.VersionTLS12},
		WorkloadJWT: mcpbrokerserver.WorkloadJWTConfig{
			Issuer: cfg.WorkloadJWT.Issuer, JWKSURI: cfg.WorkloadJWT.JWKSURI,
			Audience: cfg.WorkloadJWT.Audience, AllowedSubjects: []string{cfg.WorkloadJWT.Subject},
			TrustedCAPEM: caPEM, MaxJWKSStaleness: cfg.WorkloadJWT.MaxJWKSStaleness.value(),
		},
		ToolHive: cfg.toolHive(), Diagnostics: diagnostics,
		PropagationWait: cfg.Drain.PropagationDelay.value(), DrainTimeout: cfg.Drain.Timeout.value(),
		ShutdownTimeout: cfg.Drain.ListenerShutdownTimeout.value(),
		PublicBounds:    mcpbrokerserver.DefaultPublicListenerConfig(),
		Transport:       cfg.transport(), RuntimeLimits: cfg.runtimeLimits(),
	}
}

func (cfg fileConfig) drainRequestTimeout() time.Duration {
	return cfg.Drain.PropagationDelay.value() + cfg.Drain.Timeout.value() + cfg.Drain.ListenerShutdownTimeout.value()
}
func (cfg fileConfig) transport() mcpbrokergrpc.Config {
	// DialTimeout is a remote-client concern. Keep the adapter's finite default;
	// serving configuration owns only the broker's server-side bounds.
	out := mcpbrokergrpc.DefaultConfig()
	out.RPCDeadline = cfg.Transport.RPCDeadline.value()
	out.ExecuteDeadline = cfg.Transport.ExecuteDeadline.value()
	out.HandleIdleTimeout = cfg.Transport.HandleIdleTimeout.value()
	out.SweepInterval = cfg.Transport.SweepInterval.value()
	out.CleanupTimeout = cfg.Transport.CleanupTimeout.value()
	out.MaxHandles = cfg.Transport.MaxHandles
	out.MaxOwners = cfg.Transport.MaxOwners
	out.MaxReceipts = cfg.Transport.MaxReceipts
	out.MaxReceiptBytes = cfg.Transport.MaxReceiptBytes
	out.MaxPendingControls = cfg.Transport.MaxPendingControls
	out.MaxActiveExecutes = cfg.Transport.MaxActiveExecutes
	return out
}
func (cfg fileConfig) runtimeLimits() mcpbroker.Limits {
	return mcpbroker.Limits{MaxLogicalSessions: cfg.Runtime.MaxLogicalSessions, LogicalRetention: cfg.Runtime.LogicalRetention.value(), SweepInterval: cfg.Transport.SweepInterval.value(), MaxPendingStates: cfg.Runtime.MaxPendingAuthStates}
}
func (cfg fileConfig) toolHive() mcpbroker.ToolHiveConfig {
	profiles := make([]mcpbroker.ToolHiveProfile, len(cfg.Profiles))
	for i, profile := range cfg.Profiles {
		converted := mcpbroker.ToolHiveProfile{Name: profile.Name, URL: profile.URL, Auth: profile.Auth}
		if profile.OAuth != nil {
			converted.OAuth = &mcpbroker.ToolHiveOAuth{Issuer: profile.OAuth.Issuer, AuthorizationEndpoint: profile.OAuth.AuthorizationEndpoint, TokenEndpoint: profile.OAuth.TokenEndpoint, ClientID: profile.OAuth.ClientID, ClientSecretFile: profile.OAuth.ClientSecretFile, Scopes: append([]string(nil), profile.OAuth.Scopes...), RequestRefreshToken: profile.OAuth.RequestRefreshToken}
		}
		converted.Static = make([]mcpbroker.StaticTool, len(profile.Static))
		for j, spec := range profile.Static {
			converted.Static[j] = mcpbroker.StaticTool{Name: spec.Name, Description: spec.Description, Schema: append(json.RawMessage(nil), spec.Schema...), ReadOnly: spec.ReadOnly}
		}
		profiles[i] = converted
	}
	return mcpbroker.ToolHiveConfig{CallbackURL: cfg.CallbackURL, Profiles: profiles}
}
