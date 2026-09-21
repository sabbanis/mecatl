// Command mecabroker runs the process-local ToolHive MCP broker behind an
// authenticated gRPC boundary. Browser OAuth routes share the same lifecycle
// but remain unauthenticated; opaque broker-created state is their authority.
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/internal/adapter/mcpbrokerserver"
	"github.com/stacklok/mecatl/internal/adapter/slogdiag"
	"github.com/stacklok/mecatl/internal/cliconfig"
)

const (
	defaultConfigFile   = "/etc/mecabroker/broker.json"
	defaultAdminAddress = "127.0.0.1:8081"
	adminCheckTimeout   = 5 * time.Second
)

type brokerLifecycle interface {
	Start() <-chan error
	Close(context.Context) error
}

var newProduction = func(ctx context.Context, cfg mcpbrokerserver.ProductionConfig) (brokerLifecycle, error) {
	return mcpbrokerserver.NewProduction(ctx, cfg)
}

func main() {
	if len(os.Args) == 2 {
		var err error
		switch os.Args[1] {
		case "health":
			err = requestLocalAdmin(http.MethodGet, "/healthz", adminCheckTimeout)
		case "ready":
			err = requestLocalAdmin(http.MethodGet, "/readyz", adminCheckTimeout)
		case "drain":
			cfg, configErr := readConfig(defaultConfigFile)
			if configErr != nil {
				err = configErr
			} else {
				err = requestLocalAdmin(http.MethodGet, "/drain", cfg.drainRequestTimeout())
			}
		default:
			goto serve
		}
		if err != nil {
			_, _ = fmt.Fprintln(os.Stderr, "mecabroker: local administration failed")
			os.Exit(1)
		}
		return
	}
serve:
	cfg, level, warning, err := parseFlagsWithLogging()
	if err != nil {
		reportStartupError(os.Stderr, "configuration", err)
		os.Exit(1)
	}
	logger := cliconfig.NewTextLogger(os.Stderr, level, warning)
	slog.SetDefault(logger)
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, cfg, slogdiag.NewFromLogger(logger)); err != nil {
		reportStartupError(os.Stderr, "startup or serving", err)
		os.Exit(1)
	}
}

func reportStartupError(w io.Writer, stage string, err error) {
	if err == nil {
		return
	}
	_, _ = fmt.Fprintf(w, "mecabroker: %s failed: %s\n", stage, err)
}

func run(ctx context.Context, cfg fileConfig, diagnostics port.Diagnostics) error {
	productionConfig, err := cfg.loadProductionConfig(diagnostics)
	if err != nil {
		return err
	}
	lifecycle, err := newProduction(ctx, productionConfig)
	if err != nil {
		return err
	}
	defer func() {
		closeCtx, cancel := context.WithTimeout(context.Background(), cfg.Drain.ListenerShutdownTimeout.value())
		defer cancel()
		_ = lifecycle.Close(closeCtx)
	}()
	errs := lifecycle.Start()
	select {
	case <-ctx.Done():
		return lifecycle.Close(context.Background())
	case <-errs:
		return errors.New("broker listener stopped")
	}
}

func requestLocalAdmin(method, path string, timeout time.Duration) error {
	client := &http.Client{Timeout: timeout}
	req, err := http.NewRequest(method, "http://"+defaultAdminAddress+path, nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return errors.New("local drain rejected")
	}
	return nil
}
