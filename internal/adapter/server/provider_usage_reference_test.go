package server

import (
	"context"
	"slices"
	"strings"
	"testing"

	"google.golang.org/protobuf/encoding/protojson"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
)

func TestADR_0353_ProviderUsageReference_Scenario2_WireAndRecorderPreserveExactReference(t *testing.T) {
	want := session.Event{
		Type:  session.EvProviderUsageReference,
		Seq:   7,
		Turn:  2,
		Text:  "resp_AZ09._:-",
		RunID: "run_exact",
	}
	if !isPublicEvent(want) || !relayLiveEvent(want) {
		t.Fatal("provider usage-reference event is not client-visible")
	}

	grpcEvent := toProto(want)
	if grpcEvent.GetType() != "provider.usage_reference" || grpcEvent.GetText() != want.Text || grpcEvent.GetRunId() != want.RunID || grpcEvent.GetTurn() != 2 {
		t.Fatalf("gRPC projection = %+v, want exact common event fields", grpcEvent)
	}

	encoded, err := protojson.Marshal(grpcEvent)
	if err != nil {
		t.Fatalf("marshal HTTP/SSE event JSON: %v", err)
	}
	var httpEvent mecatlv1.Event
	if err := protojson.Unmarshal(encoded, &httpEvent); err != nil {
		t.Fatalf("unmarshal HTTP/SSE event JSON: %v", err)
	}
	if httpEvent.GetType() != grpcEvent.GetType() || httpEvent.GetText() != grpcEvent.GetText() || httpEvent.GetRunId() != grpcEvent.GetRunId() || httpEvent.GetTurn() != grpcEvent.GetTurn() {
		t.Fatalf("HTTP/SSE round trip = %+v, want exact gRPC common fields", &httpEvent)
	}

	log := &countingEventLog{}
	recorder := NewRunEventRecorder(context.Background(), recorderService(log, port.NopDiagnostics{}), "session-1")
	recorder.Observe(want)
	recorder.Close()
	if len(log.recorded) != 1 || log.recorded[0] != want {
		t.Fatalf("recorded events = %+v, want exact usage-reference event", log.recorded)
	}
}

func TestADR_0353_ProviderUsageReference_Scenario2_FeatureAndTypeScriptRegistryParity(t *testing.T) {
	if !slices.Contains(allFeatures, FeatureProviderUsageReferenceV1) {
		t.Fatalf("server feature registry is missing %q", FeatureProviderUsageReferenceV1)
	}
	if !slices.Contains(serverFeatures(FeatureScope{}), FeatureProviderUsageReferenceV1) {
		t.Fatalf("build feature set is missing %q", FeatureProviderUsageReferenceV1)
	}

	paths := sdkTypescriptEventParityPaths(t)
	eventsSource := readParitySource(t, paths.manifest)
	if !strings.Contains(eventsSource, `"provider.usage_reference"`) {
		t.Fatal("TypeScript known-event registry is missing provider.usage_reference")
	}
	serverSource := readParitySource(t, strings.Replace(paths.manifest, "events.ts", "server.ts", 1))
	if !strings.Contains(serverSource, `ProviderUsageReferenceV1: "provider_usage_reference_v1"`) {
		t.Fatal("TypeScript server-feature registry is missing provider_usage_reference_v1")
	}
}
