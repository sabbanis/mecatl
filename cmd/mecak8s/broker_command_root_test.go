package main

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
	"github.com/stacklok/mecatl/internal/app"
	"github.com/stacklok/mecatl/internal/cliconfig"
)

func TestSessionMCPAuthorization_Scenario10_Mecak8sCommandRootVertical(t *testing.T) {
	cert, key := loopbackTLSFiles(t)
	cfg := config{httpAddr: freeLoopbackPort(t), grpcAddr: freeLoopbackPort(t), tlsCert: cert, tlsKey: key,
		oidc: cliconfig.OIDCConfig{Issuer: "https://identity.example", Audience: "mecak8s", NewValidator: func(context.Context, cliconfig.OIDCConfig) (server.PrincipalValidator, error) {
			return testPrincipalValidator{}, nil
		}},
	}
	settings := filepath.Join(t.TempDir(), "settings.yaml")
	t.Setenv("MECATL_SCENARIO10_CLIENT_SECRET", "test-secret")
	if err := os.WriteFile(settings, []byte("mcp:\n  mode: broker\n  broker:\n    callback_url: https://"+cfg.httpAddr+"/exact/callback\n  servers:\n    - name: protected\n      url: https://mcp.example.invalid/mcp\n      auth:\n        mode: oauth\n        oauth:\n          issuer: https://issuer.example.invalid\n          client:\n            mode: preregistered\n            preregistered:\n              id: scenario10-client\n              secret_env: MECATL_SCENARIO10_CLIENT_SECRET\n          scopes: [openid]\n          network: {}\n"), 0o600); err != nil {
		t.Fatalf("write broker settings: %v", err)
	}
	bundle := vmcpbroker.HandlerBundle{
		Authorization:     http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }),
		Token:             http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }),
		UpstreamCallback:  http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }),
		Discovery:         http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }),
		JWKS:              http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }),
		ProtectedResource: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }),
		VMCP:              http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }),
		Callback:          http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }),
	}
	built, err := app.Build(t.Context(), app.Config{
		Workspace: t.TempDir(), UseMock: true, NoSoul: true, NoUserModel: true,
		PermissionsConventional: false, AgentsConventional: false, OwnershipEnforced: true,
		PermissionConfigs: []string{settings}, MCPAuthorityDefault: string(cliconfig.MCPAuthorityBroker), MCPBrokerSupported: true,
		MCPAuthorityLoader: cliconfig.NewMCPProfileResolver(nil, os.LookupEnv),
		VMCPBrokerConstructor: func(context.Context, app.VMCPBrokerDeclarations) (*vmcpbroker.Process, error) {
			runtime, err := vmcpbroker.NewRuntime(nil, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
				return session.ToolResult{}, nil
			})
			if err != nil {
				return nil, err
			}
			return &vmcpbroker.Process{Runtime: runtime, Handlers: bundle}, nil
		},
	})
	if err != nil {
		t.Fatalf("Build from broker settings: %v", err)
	}
	t.Cleanup(built.Close)

	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() {
		done <- serve(ctx, cfg, built.Service, observability{}, built.VMCPBrokerHandlers, built.VMCPBrokerCallbackPath)
	}()
	client := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12, InsecureSkipVerify: true}}} //nolint:gosec // test-only loopback certificate
	for _, path := range []string{"/v1/mcp/broker/oauth/authorize", "/v1/mcp/broker/mcp", "/exact/callback"} {
		var response *http.Response
		var requestErr error
		for deadline := time.Now().Add(time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
			response, requestErr = client.Get("https://" + cfg.httpAddr + path)
			if requestErr == nil {
				break
			}
		}
		if requestErr != nil {
			t.Fatalf("GET %s: %v", path, requestErr)
		}
		_ = response.Body.Close()
		if response.StatusCode != http.StatusNoContent {
			t.Fatalf("GET %s status = %d", path, response.StatusCode)
		}
	}
	cancel()
	if err := <-done; err != nil {
		t.Fatalf("serve: %v", err)
	}
}

type testPrincipalValidator struct{}

func (testPrincipalValidator) Validate(context.Context, string) (*session.Principal, error) {
	return &session.Principal{Issuer: "https://identity.example", Subject: "test", GrantType: session.GrantTypeUser}, nil
}

func loopbackTLSFiles(t *testing.T) (string, string) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.CreateCertificate(rand.Reader, &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "127.0.0.1"}, DNSNames: []string{"localhost"}, IPAddresses: []net.IP{net.ParseIP("127.0.0.1")}, NotBefore: time.Now().Add(-time.Minute), NotAfter: time.Now().Add(time.Hour), KeyUsage: x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}, &x509.Certificate{}, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	certPath, keyPath := filepath.Join(dir, "cert.pem"), filepath.Join(dir, "key.pem")
	if err := os.WriteFile(certPath, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyPath, pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}), 0o600); err != nil {
		t.Fatal(err)
	}
	return certPath, keyPath
}
