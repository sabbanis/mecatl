package server_test

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/stacklok/toolhive/pkg/authserver"
	"github.com/stacklok/toolhive/pkg/authserver/runner"
	"github.com/stacklok/toolhive/pkg/authserver/storage"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/mcp"
	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/adapter/vmcpbroker"
)

func TestBundledWorkspaceEnrollment_Scenario11_ConnectRequiresOwner(t *testing.T) {
	runtime := bundledEnrollmentRuntime(t, []string{"github", "slack"})
	store := memstore.New()
	svc := bundledEnrollmentService(t, store, runtime)
	alice := &session.Principal{Issuer: "https://idp.example", Subject: "alice", GrantType: session.GrantTypeUser}
	bob := &session.Principal{Issuer: alice.Issuer, Subject: "bob", GrantType: session.GrantTypeUser}
	aliceCtx := session.WithPrincipal(context.Background(), alice)

	sess, err := svc.CreateSession(aliceCtx, "/workspace", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	if _, err := svc.ConnectWorkspaceServices(session.WithPrincipal(context.Background(), bob), sess.ID); !errors.Is(err, server.ErrNotFound) {
		t.Fatalf("foreign ConnectWorkspaceServices = %v, want ErrNotFound", err)
	}
	presentation, err := svc.ConnectWorkspaceServices(aliceCtx, sess.ID)
	if err != nil {
		t.Fatalf("owner ConnectWorkspaceServices: %v", err)
	}
	repeated, err := svc.ConnectWorkspaceServices(aliceCtx, sess.ID)
	if err != nil {
		t.Fatalf("observe ConnectWorkspaceServices: %v", err)
	}
	if repeated.ID != presentation.ID {
		t.Fatalf("repeat enrollment id = %q, want %q", repeated.ID, presentation.ID)
	}
	if _, err := svc.StartRunContent(aliceCtx, sess.ID, "run before admission", nil); !errors.Is(err, server.ErrFailedPrecondition) {
		t.Fatalf("StartRunContent before catalogue admission = %v, want ErrFailedPrecondition", err)
	}
	if !reflect.DeepEqual(presentation.Backends, []string{"github", "slack"}) || presentation.Status != vmcpbroker.ConnectionPending {
		t.Fatalf("presentation = %+v", presentation)
	}
	persisted, err := store.Load(context.Background(), sess.ID)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if persisted.State == session.StateAuthorizing {
		t.Fatal("workspace enrollment reused StateAuthorizing")
	}
	if _, ok := persisted.PendingMCPAuthorization(); ok {
		t.Fatal("workspace enrollment created PendingMCPAuthorization")
	}
	for _, message := range persisted.Conversation.Messages {
		if len(message.ToolCalls) != 0 {
			t.Fatalf("workspace enrollment created model ToolCall: %+v", message.ToolCalls)
		}
	}
	enrollment, ok := persisted.WorkspaceEnrollment()
	if !ok || enrollment.ID != presentation.ID || !reflect.DeepEqual(enrollment.Backends, presentation.Backends) || enrollment.Status != session.WorkspaceEnrollmentPending {
		t.Fatalf("persisted safe enrollment = %+v, %v", enrollment, ok)
	}
}

func TestBundledWorkspaceEnrollment_Scenario11_AllOrNothing(t *testing.T) {
	backends := []string{"github", "slack"}
	runtime := bundledEnrollmentRuntime(t, backends)
	opened, err := runtime.OpenSession("bundle")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = opened.Close() })
	if got := opened.Tools(); len(got) != 0 {
		t.Fatalf("protected catalogue before enrollment = %v, want empty", toolNames(got))
	}
	pending, err := runtime.ConnectWorkspaceServices(t.Context(), "bundle")
	if err != nil {
		t.Fatalf("ConnectWorkspaceServices: %v", err)
	}
	if !reflect.DeepEqual(pending.Backends, backends) {
		t.Fatalf("backend order = %v, want %v", pending.Backends, backends)
	}

	for _, outcome := range []vmcpbroker.WorkspaceEnrollmentOutcome{
		vmcpbroker.WorkspaceEnrollmentDenied,
		vmcpbroker.WorkspaceEnrollmentCancelled,
		vmcpbroker.WorkspaceEnrollmentExpired,
		vmcpbroker.WorkspaceEnrollmentFailed,
	} {
		if err := runtime.AbortWorkspaceEnrollment("bundle", pending.ID, outcome); err != nil {
			t.Fatalf("AbortWorkspaceEnrollment(%s): %v", outcome, err)
		}
		if runtime.ProtectedCatalogueReady("bundle") || len(opened.Tools()) != 0 {
			t.Fatalf("%s exposed a partial protected catalogue", outcome)
		}
		pending, err = runtime.ConnectWorkspaceServices(t.Context(), "bundle")
		if err != nil {
			t.Fatalf("restart enrollment after %s: %v", outcome, err)
		}
	}

	// A new process has no grant or catalogue even when the old process had a
	// pending correlation. This covers restart/process loss without replaying it.
	restarted := bundledEnrollmentRuntime(t, backends)
	reopened, err := restarted.OpenSession("bundle")
	if err != nil {
		t.Fatalf("restart OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = reopened.Close() })
	if restarted.ProtectedCatalogueReady("bundle") || len(reopened.Tools()) != 0 {
		t.Fatal("restart/process loss restored a partial protected catalogue")
	}
}

func TestBundledWorkspaceEnrollment_Scenario11_ServiceRestartRequiresEnrollment(t *testing.T) {
	store := memstore.New()
	alice := &session.Principal{Issuer: "https://idp.example", Subject: "alice", GrantType: session.GrantTypeUser}
	ctx := session.WithPrincipal(context.Background(), alice)
	firstRuntime := bundledEnrollmentRuntime(t, []string{"github"})
	firstService := bundledEnrollmentService(t, store, firstRuntime)
	sess, err := firstService.CreateSession(ctx, "/workspace", session.ModeDefault, session.Limits{})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	first, err := firstService.ConnectWorkspaceServices(ctx, sess.ID)
	if err != nil {
		t.Fatalf("first ConnectWorkspaceServices: %v", err)
	}

	restartedRuntime := bundledEnrollmentRuntime(t, []string{"github"})
	restartedService := bundledEnrollmentService(t, store, restartedRuntime)
	fresh, err := restartedService.ConnectWorkspaceServices(ctx, sess.ID)
	if err != nil {
		t.Fatalf("restart ConnectWorkspaceServices: %v", err)
	}
	if fresh.ID == "" || fresh.ID == first.ID || fresh.Status != vmcpbroker.ConnectionPending {
		t.Fatalf("restart enrollment = %+v, prior id %q", fresh, first.ID)
	}
	persisted, err := store.Load(t.Context(), sess.ID)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	enrollment, ok := persisted.WorkspaceEnrollment()
	if !ok || enrollment.ID != fresh.ID {
		t.Fatalf("restart persisted enrollment = %+v, %t", enrollment, ok)
	}
	if restartedRuntime.ProtectedCatalogueReady(sess.ID) {
		t.Fatal("restart replayed protected catalogue admission")
	}
}

func TestBundledWorkspaceEnrollment_Scenario11_AnonymousCompatibility(t *testing.T) {
	called := 0
	runtime, err := vmcpbroker.NewRuntime([]vmcpbroker.Route{{
		BackendID: "public", Tool: tool.ToolSpec{Name: "mcp__public__status", Schema: json.RawMessage(`{"type":"object"}`)}, ReadOnly: true,
	}}, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
		called++
		return session.NewToolResult("", "ok"), nil
	})
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close() })
	opened, err := runtime.OpenSession("anonymous")
	if err != nil {
		t.Fatalf("OpenSession: %v", err)
	}
	t.Cleanup(func() { _ = opened.Close() })
	tools := opened.Tools()
	if len(tools) != 1 || tools[0].Spec().Name != "mcp__public__status" {
		t.Fatalf("anonymous eager catalogue = %v", toolNames(tools))
	}
	if _, err := tools[0].Execute(t.Context(), session.NewToolCall("call", tools[0].Spec().Name, json.RawMessage(`{}`)), tool.Environment{}); err != nil || called != 1 {
		t.Fatalf("anonymous execution = calls %d, err %v", called, err)
	}
	if _, err := runtime.ConnectWorkspaceServices(t.Context(), "anonymous"); !errors.Is(err, vmcpbroker.ErrInvalidControlTarget) {
		t.Fatalf("anonymous enrollment control = %v, want ErrInvalidControlTarget", err)
	}
	if got := runtime.WorkspaceEnrollmentBackends(); len(got) != 0 {
		t.Fatalf("anonymous runtime exposed per-backend enrollment controls: %v", got)
	}
}

func bundledEnrollmentRuntime(t *testing.T, backends []string) *vmcpbroker.Runtime {
	t.Helper()
	issuer := "https://broker.example/v1/mcp/broker"
	store := storage.NewMemoryStorage()
	upstreams := make([]authserver.UpstreamRunConfig, 0, len(backends))
	for _, backend := range backends {
		upstreams = append(upstreams, authserver.UpstreamRunConfig{Name: backend, Type: authserver.UpstreamProviderTypeOAuth2, OAuth2Config: &authserver.OAuth2UpstreamRunConfig{
			AuthorizationEndpoint: "https://" + backend + ".example/authorize", TokenEndpoint: "https://" + backend + ".example/token",
			ClientID: backend + "-client", RedirectURI: issuer + "/oauth/callback", IdentityFromToken: &authserver.IdentityFromTokenRunConfig{SubjectPath: "sub"},
		}})
	}
	auth, err := runner.NewEmbeddedAuthServerWithStorage(t.Context(), &authserver.RunConfig{
		SchemaVersion: "v1", Issuer: issuer, AllowedAudiences: []string{issuer}, Upstreams: upstreams,
	}, store)
	if err != nil {
		t.Fatalf("NewEmbeddedAuthServerWithStorage: %v", err)
	}
	runtime, err := vmcpbroker.NewToolHiveRuntime(nil, func(context.Context, session.SessionID, vmcpbroker.Route, json.RawMessage) (session.ToolResult, error) {
		return session.ToolResult{}, errors.New("protected route must not execute before discovery")
	}, vmcpbroker.ToolHiveRuntimeConfig{
		AuthServer: auth, Storage: store, Issuer: issuer, Resource: issuer,
		AuthorizationEndpoint: issuer + "/oauth/authorize", TokenEndpoint: issuer + "/oauth/token",
		CallbackURL: "https://client.example/callback", ProtectedBackends: backends,
	}, time.Minute)
	if err != nil {
		_ = auth.Close()
		t.Fatalf("NewToolHiveRuntime: %v", err)
	}
	t.Cleanup(func() { _ = runtime.Close(); _ = auth.Close() })
	return runtime
}

func bundledEnrollmentService(t *testing.T, store *memstore.Store, runtime *vmcpbroker.Runtime) *server.Service {
	t.Helper()
	eng := agent.NewEngine(agent.Deps{LLM: mockllm.New(mockllm.TextTurn("done")), Catalog: tool.NewCatalog(), Policy: permpolicy.NewPolicy(nil, nil)})
	svc, err := server.NewService(server.Config{
		Engine: eng, Store: store, OwnershipEnforced: true,
		Workspaces: func(root string) tool.Workspace { return memfs.NewWorkspace(root) },
		VMCPBroker: runtime, VMCPBrokerGeneration: runtime.EnrollmentID(), VMCPBrokerBindings: vmcpbroker.NewBindingIndex(),
		SessionEngine: func(context.Context, server.ProviderSelector, []mcp.ServerConfig, server.SessionProfile, string, session.PermissionMode) (server.SessionEngineResult, error) {
			return server.SessionEngineResult{Engine: eng, Close: func() error { return nil }}, nil
		},
	})
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	t.Cleanup(svc.Close)
	return svc
}

func toolNames(tools []tool.Tool) []string {
	result := make([]string, len(tools))
	for i, wrapped := range tools {
		result[i] = wrapped.Spec().Name
	}
	return result
}
