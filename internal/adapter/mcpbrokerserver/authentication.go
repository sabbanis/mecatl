package mcpbrokerserver

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/stacklok/toolhive-core/authn"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	oidcadapter "github.com/stacklok/mecatl/authn/oidc"
	brokerv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/broker/v1"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/adapter/mcpbroker"
)

const maxJWKSStaleness = 24 * time.Hour

// WorkloadJWTConfig is the production workload-identity policy. There is intentionally
// no insecure HTTP, private-address, or TLS-verification escape hatch.
type WorkloadJWTConfig struct {
	// Issuer is the required HTTPS OIDC issuer URL that tokens must claim as iss.
	Issuer string
	// JWKSURI is the explicit HTTPS endpoint whose keys verify issuer signatures.
	JWKSURI string
	// Audience is the required token aud value for this broker.
	Audience string
	// AllowedSubjects is the closed allowlist of workload subject claims; authentication
	// succeeds only after the token is valid and its subject is in this set.
	AllowedSubjects []string
	// TrustedCAPEM is the operator-supplied trust bundle used for issuer and JWKS TLS.
	// It is copied during verifier construction and is never returned in diagnostics.
	TrustedCAPEM []byte
	// MaxJWKSStaleness is the maximum age of cached verification keys accepted while
	// the JWKS endpoint is unavailable. It must be positive and no greater than 24 hours.
	MaxJWKSStaleness time.Duration
}

type workloadVerifier interface {
	Validate(context.Context, string) (*session.Principal, error)
	Ready(context.Context) error
	Close() error
}

func newWorkloadJWTVerifier(ctx context.Context, cfg WorkloadJWTConfig) (workloadVerifier, error) {
	if err := mcpbroker.ValidateProtectedURL(cfg.Issuer, "OIDC issuer"); err != nil {
		return nil, fmt.Errorf("mcpbrokerserver: %w", err)
	}
	if cfg.JWKSURI == "" {
		return nil, errors.New("mcpbrokerserver: an explicit HTTPS JWKS URI is required")
	}
	if err := mcpbroker.ValidateProtectedURL(cfg.JWKSURI, "JWKS URI"); err != nil {
		return nil, fmt.Errorf("mcpbrokerserver: %w", err)
	}
	if cfg.Audience == "" {
		return nil, errors.New("mcpbrokerserver: OIDC audience is required")
	}
	if len(cfg.AllowedSubjects) == 0 {
		return nil, errors.New("mcpbrokerserver: at least one OIDC workload subject is required")
	}
	for _, subject := range cfg.AllowedSubjects {
		if subject == "" || strings.ContainsRune(subject, '\x00') {
			return nil, errors.New("mcpbrokerserver: OIDC workload subjects must be non-empty")
		}
	}
	if len(cfg.TrustedCAPEM) == 0 {
		return nil, errors.New("mcpbrokerserver: an explicit OIDC trust bundle is required")
	}
	if cfg.MaxJWKSStaleness <= 0 || cfg.MaxJWKSStaleness > maxJWKSStaleness {
		return nil, fmt.Errorf("mcpbrokerserver: JWKS staleness must be in (0,%s]", maxJWKSStaleness)
	}
	validator, err := oidcadapter.NewValidator(ctx, oidcadapter.Config{Issuer: cfg.Issuer, JWKSURI: cfg.JWKSURI, Audience: cfg.Audience, MaxJWKSStaleness: cfg.MaxJWKSStaleness, AllowPrivateHTTPSIssuer: true, TrustedCAFile: "operator-supplied-ca.pem", TrustedCAPEM: append([]byte(nil), cfg.TrustedCAPEM...)})
	if err != nil {
		return nil, fmt.Errorf("mcpbrokerserver: initialize workload identity: %w", err)
	}
	return validator, nil
}

func (h *brokerHost) authenticate(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	operation := operationName(info.FullMethod)
	values := metadata.ValueFromIncomingContext(ctx, "authorization")
	if len(values) != 1 {
		h.record(ctx, operation, "unauthenticated")
		return nil, status.Error(codes.Unauthenticated, "workload authentication required")
	}
	bearer, err := authn.ParseBearer(values[0])
	if err != nil {
		h.record(ctx, operation, "unauthenticated")
		return nil, status.Error(codes.Unauthenticated, "invalid workload credential")
	}
	principal, err := h.verifier.Validate(ctx, bearer)
	if err != nil {
		if errors.Is(err, oidcadapter.ErrIdentityUnavailable) || errors.Is(err, context.DeadlineExceeded) {
			h.record(ctx, operation, "unavailable")
			return nil, status.Error(codes.Unavailable, "workload identity unavailable")
		}
		h.record(ctx, operation, "unauthenticated")
		return nil, status.Error(codes.Unauthenticated, "invalid workload credential")
	}
	if _, allowed := h.allowedSubjects[principal.Subject]; !allowed {
		h.record(ctx, operation, "unauthorized")
		return nil, status.Error(codes.PermissionDenied, "workload is not authorized")
	}
	h.record(ctx, operation, "allowed")
	return handler(session.WithPrincipal(ctx, principal), req)
}
func operationName(method string) string {
	switch method {
	case brokerv1.BrokerService_Attach_FullMethodName:
		return "attach"
	case brokerv1.BrokerService_Commit_FullMethodName:
		return "commit"
	case brokerv1.BrokerService_Abort_FullMethodName:
		return "abort"
	case brokerv1.BrokerService_Close_FullMethodName:
		return "close"
	case brokerv1.BrokerService_Delete_FullMethodName:
		return "delete"
	case brokerv1.BrokerService_Execute_FullMethodName:
		return "execute"
	case brokerv1.BrokerService_RequestAuthorization_FullMethodName:
		return "request_authorization"
	case brokerv1.BrokerService_AbortAuthorization_FullMethodName:
		return "abort_authorization"
	case brokerv1.BrokerService_PresentAuthorization_FullMethodName:
		return "present_authorization"
	case brokerv1.BrokerService_AuthorizationStatus_FullMethodName:
		return "authorization_status"
	case brokerv1.BrokerService_CancelAuthorization_FullMethodName:
		return "cancel_authorization"
	case brokerv1.BrokerService_BeginWorkspaceEnrollment_FullMethodName:
		return "begin_workspace_enrollment"
	case brokerv1.BrokerService_ObserveWorkspaceEnrollment_FullMethodName:
		return "observe_workspace_enrollment"
	case brokerv1.BrokerService_CancelWorkspaceEnrollment_FullMethodName:
		return "cancel_workspace_enrollment"
	default:
		return "unknown"
	}
}
func (h *brokerHost) record(ctx context.Context, operation, outcome string) {
	h.diagnostics.Log(ctx, port.LevelInfo, "broker authentication", "operation", operation, "outcome", outcome)
	if h.observe != nil {
		h.observe(operation, outcome)
	}
}
