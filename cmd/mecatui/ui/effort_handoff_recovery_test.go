package ui

import (
	"context"
	"errors"
	"testing"

	tea "charm.land/bubbletea/v2"
	"github.com/stacklok/mecatl/cmd/mecatui/client"
)

func effortHandoffPick(t *testing.T, m Model) (Model, tea.Cmd) {
	t.Helper()
	mm, _ := m.runEffort()
	m = mm.(Model)
	m = pressEffortKey(t, m, tea.KeyPressMsg{Code: tea.KeyDown})
	mm, cmd, _ := m.onEffortKey(tea.KeyPressMsg{Code: tea.KeyEnter})
	return mm.(Model), cmd
}

func TestMecatuiEffortHandoffRecovery_Scenario1_FailuresRetainUsableSource(t *testing.T) {
	m := newModelsModel(t, sampleModels(), &fakeStore{}, modelsCaps(), client.ModelSelection{})
	conv := m.deps.Session.(*fakeConv)
	conv.forkErr = context.DeadlineExceeded
	beforeBlocks := len(m.conv.blocks)
	m, cmd := effortHandoffPick(t, m)
	m = feedCmd(t, m, cmd)
	if m.sessionID != "sess-test-0001" || m.phase != phaseIdle || len(m.conv.blocks) != beforeBlocks || !m.prompt.Focused() {
		t.Fatalf("fork failure lost source usability: id=%q phase=%v blocks=%d focused=%v", m.sessionID, m.phase, len(m.conv.blocks), m.prompt.Focused())
	}
	if m.restartFailed || len(conv.closed()) != 0 {
		t.Fatalf("fork failure armed obsolete retry or closed source: restartFailed=%v closed=%v", m.restartFailed, conv.closed())
	}
}

func TestMecatuiEffortHandoffRecovery_Scenario1_HydrationFailureCleansExactTarget(t *testing.T) {
	m := newModelsModel(t, sampleModels(), &fakeStore{}, modelsCaps(), client.ModelSelection{})
	conv := m.deps.Session.(*fakeConv)
	conv.getSessionErr = errors.New("hydrate")
	m, cmd := effortHandoffPick(t, m)
	m = feedCmd(t, m, cmd)
	if m.sessionID != "sess-test-0001" || m.phase != phaseIdle || !m.prompt.Focused() {
		t.Fatalf("hydration failure did not restore source: id=%q phase=%v focused=%v", m.sessionID, m.phase, m.prompt.Focused())
	}
	if got := conv.closed(); len(got) != 1 || got[0] != "sess-fork-1" {
		t.Fatalf("closed=%v, want only exact target", got)
	}
}

func TestMecatuiEffortHandoffRecovery_Scenario1_AdoptsTargetBeforeClosingSource(t *testing.T) {
	m := newModelsModel(t, sampleModels(), &fakeStore{}, modelsCaps(), client.ModelSelection{})
	conv := m.deps.Session.(*fakeConv)
	conv.resolvedModel = client.ResolvedModel{ProviderID: "openai", ModelID: "gpt-5", ReasoningEffort: "low"}
	conv.getSessionCaps = client.Capabilities{ModelSelection: true, ManualCompaction: true}
	conv.getSessionTitle = "successor"
	m, cmd := effortHandoffPick(t, m)
	beforeBlocks := len(m.conv.blocks)
	m = feedCmd(t, m, cmd)
	if m.sessionID != "sess-fork-1" || len(m.conv.blocks) != beforeBlocks || m.sessionTitle != "successor" || m.resolvedSessionModel.ReasoningEffort != "low" {
		t.Fatalf("target was not adopted with local projection preserved: id=%q blocks=%d title=%q effort=%q", m.sessionID, len(m.conv.blocks), m.sessionTitle, m.resolvedSessionModel.ReasoningEffort)
	}
	if m.caps.ManualCompaction != true || len(conv.closed()) != 1 || conv.closed()[0] != "sess-test-0001" {
		t.Fatalf("target metadata/source retirement mismatch: caps=%+v closed=%v", m.caps, conv.closed())
	}
}

func TestMecatuiEffortHandoffRecovery_Scenario1_StaleReadyCleansTargetAndStaleFailureIsInert(t *testing.T) {
	m := newModelsModel(t, sampleModels(), &fakeStore{}, modelsCaps(), client.ModelSelection{})
	conv := m.deps.Session.(*fakeConv)
	m.phase = phaseConnecting
	m.modelSwitchRequestToken = 2
	mm, cmd, _ := m.updateLifecycle(effortHandoffReadyMsg{token: 1, sourceID: m.sessionID, targetID: "stale-target"})
	m = mm.(Model)
	m = feedCmd(t, m, cmd)
	if got := conv.closed(); len(got) != 1 || got[0] != "stale-target" {
		t.Fatalf("stale ready cleanup=%v, want stale target only", got)
	}
	beforeID, beforePhase := m.sessionID, m.phase
	mm, cmd, _ = m.updateLifecycle(effortHandoffFailedMsg{token: 1, sourceID: m.sessionID, targetID: "ignored", err: errors.New("stale")})
	m = mm.(Model)
	m = feedCmd(t, m, cmd)
	if m.sessionID != beforeID || m.phase != beforePhase || len(conv.closed()) != 1 {
		t.Fatalf("stale failure changed handoff state: id=%q phase=%v closed=%v", m.sessionID, m.phase, conv.closed())
	}
}
