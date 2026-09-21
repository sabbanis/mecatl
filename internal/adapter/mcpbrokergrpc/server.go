package mcpbrokergrpc

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"google.golang.org/grpc"

	brokerv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/broker/v1"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/mcpbroker"
)

// Server adapts one mcpbroker.Service incarnation to the broker RPC service.
type Server struct {
	brokerv1.UnimplementedBrokerServiceServer
	service         mcpbroker.Service
	diagnostics     port.Diagnostics
	mu              sync.Mutex
	handles         map[string]*serverAttachment
	owners          map[session.SessionID]*sessionOwner
	maxHandles      int
	incarnation     string
	cfg             Config
	closed          bool
	done            chan struct{}
	stop            chan struct{}
	executeCtx      context.Context
	executeStop     context.CancelFunc
	executeWG       sync.WaitGroup
	activeExecutes  int
	pendingControls int
}

// NewServer constructs a server with default deadlines and the requested handle bound.
func NewServer(service mcpbroker.Service, maxHandles int) (*Server, error) {
	cfg := DefaultConfig()
	if maxHandles > 0 {
		cfg.MaxHandles = maxHandles
	}
	return NewServerWithConfig(service, cfg)
}

// NewServerWithConfig constructs one authoritative broker-process incarnation.
func NewServerWithConfig(service mcpbroker.Service, cfg Config) (*Server, error) {
	if service == nil {
		return nil, errors.New("mcpbrokergrpc: service is required")
	}
	if cfg.MaxReceipts < 0 || cfg.MaxReceiptBytes < 0 || cfg.MaxPendingControls < 0 || cfg.MaxOwners < 0 || cfg.MaxActiveExecutes < 0 {
		return nil, errors.New("mcpbrokergrpc: capacities must not be negative")
	}
	defaults := DefaultConfig()
	if cfg.MaxOwners == 0 {
		cfg.MaxOwners = defaults.MaxOwners
	}
	if cfg.MaxReceipts == 0 {
		cfg.MaxReceipts = defaults.MaxReceipts
	}
	if cfg.MaxReceiptBytes == 0 {
		cfg.MaxReceiptBytes = defaults.MaxReceiptBytes
	}
	if cfg.MaxPendingControls == 0 {
		cfg.MaxPendingControls = defaults.MaxPendingControls
	}
	if cfg.MaxActiveExecutes == 0 {
		cfg.MaxActiveExecutes = defaults.MaxActiveExecutes
	}
	if !cfg.valid() {
		return nil, errors.New("mcpbrokergrpc: all deadlines and capacities must be positive")
	}
	incarnation, err := newHandle()
	if err != nil {
		return nil, fmt.Errorf("mcpbrokergrpc: mint broker incarnation: %w", err)
	}
	executeCtx, executeStop := context.WithCancel(context.Background())
	s := &Server{service: service, diagnostics: port.NopDiagnostics{}, handles: make(map[string]*serverAttachment), owners: make(map[session.SessionID]*sessionOwner), maxHandles: cfg.MaxHandles, incarnation: incarnation, cfg: cfg, done: make(chan struct{}), stop: make(chan struct{}), executeCtx: executeCtx, executeStop: executeStop}
	go s.sweep()
	return s, nil
}

// WithDiagnostics injects the server's operational sink without widening the wire transport Config.
// It must be configured before the server begins accepting RPCs.
func (s *Server) WithDiagnostics(diagnostics port.Diagnostics) *Server {
	if diagnostics == nil {
		diagnostics = port.NopDiagnostics{}
	}
	s.diagnostics = diagnostics
	return s
}

// TraceRPC records a safe, closed-vocabulary RPC outcome. Authentication has already
// validated the principal before this method is reached.
func (s *Server) TraceRPC(ctx context.Context, operation, outcome string, fields ...any) {
	level := port.LevelDebug
	if outcome != "success" {
		level = port.LevelWarn
	}
	s.diagnostics.Log(ctx, level, "broker RPC", append([]any{"operation", operation, "outcome", outcome, "inbound_credential_kind", "workload_jwt"}, fields...)...)
}

func (s *Server) traceUnknownTool(ctx context.Context, a *serverAttachment, requested string) {
	const previewLimit = 8
	names := make([]string, 0, len(a.tools))
	for name := range a.tools {
		names = append(names, diagnosticToolName(name))
	}
	sort.Strings(names)
	truncated := len(names) > previewLimit
	if truncated {
		names = names[:previewLimit]
	}
	s.TraceRPC(ctx, "execute", "unknown_tool", "logical_session", a.logicalID, "tool", diagnosticToolName(string(requested)), "registered_tool_count", len(a.tools), "registered_tool_preview", strings.Join(names, ","), "registered_tool_preview_truncated", truncated)
}

func diagnosticToolName(name string) string {
	const limit = 128
	lower := strings.ToLower(name)
	if len(name) > limit || !utf8.ValidString(name) || strings.Contains(lower, "secret") || strings.Contains(lower, "token") || strings.Contains(lower, "bearer") {
		return "[redacted]"
	}
	return name
}

// ExecuteDeadline returns the server-side upper bound used for Execute calls.
func (s *Server) ExecuteDeadline() time.Duration { return s.cfg.ExecuteDeadline }

// RegisterServer registers an explicitly owned server so its cleanup can be joined.
func RegisterServer(reg grpc.ServiceRegistrar, server *Server) {
	brokerv1.RegisterBrokerServiceServer(reg, server)
}

func (s *Server) bounded(ctx context.Context, execute bool) (context.Context, context.CancelFunc) {
	d := s.cfg.RPCDeadline
	if execute {
		d = s.cfg.ExecuteDeadline
	}
	return context.WithTimeout(ctx, d)
}

// Shutdown rejects new operations and bounds closure of every orphaned handle.
func (s *Server) Shutdown(ctx context.Context) error {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil
	}
	s.closed = true
	close(s.stop)
	attachments := make([]*serverAttachment, 0, len(s.handles))
	toClose := make([]*serverAttachment, 0, len(s.handles))
	for handle, attachment := range s.handles {
		delete(s.handles, handle)
		attachments = append(attachments, attachment)
		if attachment.terminal == lifecycleNone {
			toClose = append(toClose, attachment)
		}
	}
	clear(s.owners)
	s.mu.Unlock()
	s.executeStop()
	executeDone := make(chan struct{})
	go func() {
		s.executeWG.Wait()
		close(executeDone)
	}()
	select {
	case <-executeDone:
		s.mu.Lock()
		for _, attachment := range attachments {
			releaseReceiptsLocked(attachment)
		}
		s.mu.Unlock()
	case <-ctx.Done():
		return ctx.Err()
	}
	for _, attachment := range toClose {
		closeCtx, cancel := context.WithTimeout(ctx, s.cfg.CleanupTimeout)
		_, err := attachment.attachment.Close(closeCtx)
		cancel()
		if err != nil && ctx.Err() != nil {
			return ctx.Err()
		}
	}
	select {
	case <-s.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
