package mcpbrokerserver

import (
	"context"
	"crypto/tls"
	"errors"
	"net"
	"strings"
	"time"

	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/internal/adapter/mcpbroker"
	"github.com/stacklok/mecatl/internal/adapter/mcpbrokergrpc"
)

const defaultShutdownTimeout = 5 * time.Second

// ProductionConfig is the complete process-local broker assembly.
type ProductionConfig struct {
	PublicAddress   string
	AdminAddress    string
	TLSConfig       *tls.Config
	WorkloadJWT     WorkloadJWTConfig
	ToolHive        mcpbroker.ToolHiveConfig
	ToolHiveOptions []mcpbroker.Option
	Diagnostics     port.Diagnostics
	PropagationWait time.Duration
	DrainTimeout    time.Duration
	ShutdownTimeout time.Duration
	PublicBounds    PublicListenerConfig
	Transport       mcpbrokergrpc.Config
	RuntimeLimits   mcpbroker.Limits
}

// NewProduction constructs the only production broker assembly.
func NewProduction(ctx context.Context, cfg ProductionConfig) (*Lifecycle, error) {
	if cfg.PropagationWait < 0 || cfg.DrainTimeout <= 0 {
		return nil, errors.New("mcpbrokerserver: broker drain bounds are invalid")
	}
	if err := validateAdminAddress(cfg.AdminAddress); err != nil {
		return nil, err
	}
	if err := validateTransport(cfg.PublicAddress, cfg.TLSConfig); err != nil {
		return nil, err
	}
	transport := cfg.Transport
	if transport == (mcpbrokergrpc.Config{}) {
		transport = mcpbrokergrpc.DefaultConfig()
	}
	if cfg.RuntimeLimits.LogicalRetention > 0 {
		transport.OwnerRetention = cfg.RuntimeLimits.LogicalRetention
	}
	broker, err := newBrokerHost(ctx, hostConfig{WorkloadJWT: cfg.WorkloadJWT, Diagnostics: cfg.Diagnostics, Transport: transport, Runtime: func(factoryCtx context.Context) (brokerRuntime, error) {
		options := append([]mcpbroker.Option(nil), cfg.ToolHiveOptions...)
		options = append(options, mcpbroker.WithLimits(cfg.RuntimeLimits))
		process, processErr := mcpbroker.NewToolHiveProcess(factoryCtx, cfg.ToolHive, options...)
		if processErr != nil {
			return brokerRuntime{}, processErr
		}
		return brokerRuntime{Service: process.Runtime, Handlers: process.Handlers, CallbackPath: process.CallbackPath, Close: process.Close}, nil
	}})
	if err != nil {
		return nil, err
	}
	cleanupBroker := true
	defer func() {
		if cleanupBroker {
			_ = broker.close(context.Background())
		}
	}()
	listener, err := net.Listen("tcp", cfg.PublicAddress)
	if err != nil {
		return nil, errors.New("mcpbrokerserver: listen for broker public traffic")
	}
	cleanupPublic := true
	defer func() {
		if cleanupPublic {
			_ = listener.Close()
		}
	}()
	bounds := cfg.PublicBounds
	if bounds == (PublicListenerConfig{}) {
		bounds = DefaultPublicListenerConfig()
	}
	public, err := newPublicListener(listener, broker, cfg.TLSConfig, bounds)
	if err != nil {
		return nil, err
	}
	adminListener, err := net.Listen("tcp", cfg.AdminAddress)
	if err != nil {
		return nil, errors.New("mcpbrokerserver: listen for broker administration")
	}
	admin := newAdminServer(adminListener, bounds.MaxHeaderBytes)
	lifecycle := &Lifecycle{broker: broker, public: public, admin: admin, adminListener: adminListener, propagation: cfg.PropagationWait, drainTimeout: cfg.DrainTimeout, shutdownTimeout: cfg.ShutdownTimeout, propagated: make(chan struct{})}
	if lifecycle.shutdownTimeout <= 0 {
		lifecycle.shutdownTimeout = defaultShutdownTimeout
	}
	admin.Handler = lifecycle.adminHandler()
	cleanupBroker, cleanupPublic = false, false
	return lifecycle, nil
}
func validateAdminAddress(address string) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return errors.New("mcpbrokerserver: broker admin listen address is invalid")
	}
	if strings.EqualFold(host, "localhost") {
		return nil
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() {
		return errors.New("mcpbrokerserver: broker admin listener must bind to loopback")
	}
	return nil
}
