package session

import (
	"fmt"
	"reflect"
	"strings"
	"time"
	"unicode"
)

// PendingMCPAuthorization is the private durable continuation state for one
// broker-protected call. It deliberately has no browser URL, credential, or
// backend-internal identifier: the aggregate preserves only the correlation and
// non-secret route/configuration provenance needed to reject a stale restore.
type PendingMCPAuthorization struct {
	AuthorizationID string
	Backend         string
	RouteID         string
	ConfigID        string
	ExpiresAt       time.Time
	Call            ToolCall
	Deferred        []ToolCall
}

// Clone returns an independent copy of p, including all raw tool arguments.
func (p PendingMCPAuthorization) Clone() PendingMCPAuthorization {
	out := p
	out.Call = cloneMCPAuthorizationCall(p.Call)
	out.Deferred = make([]ToolCall, len(p.Deferred))
	for i, call := range p.Deferred {
		out.Deferred[i] = cloneMCPAuthorizationCall(call)
	}
	return out
}

func cloneMCPAuthorizationCall(call ToolCall) ToolCall {
	call.Args = append(call.Args[:0:0], call.Args...)
	return call
}

// PauseForMCPAuthorization records a broker authorization park after the
// permission and PreToolUse gates. The pending call must be the exact unpaired
// call in the trailing assistant turn; deferred holds its exact later siblings.
func (s *Session) PauseForMCPAuthorization(pending PendingMCPAuthorization) error {
	if s.State != StateRunning {
		return fmt.Errorf("%w: PauseForMCPAuthorization from %q", ErrIllegalTransition, s.State)
	}
	if s.pending != nil {
		return fmt.Errorf("%w: permission ask already pending", ErrIllegalTransition)
	}
	if err := validatePendingMCPAuthorization(s.Conversation.Messages, pending); err != nil {
		return fmt.Errorf("session: invalid pending MCP authorization: %w", err)
	}
	pendingCopy := pending.Clone()
	s.pendingMCPAuthorization = &pendingCopy
	s.State = StateAuthorizing
	return nil
}

// PendingMCPAuthorization returns an independent copy of the parked broker
// continuation only while the session is StateAuthorizing.
func (s *Session) PendingMCPAuthorization() (PendingMCPAuthorization, bool) {
	if s.State != StateAuthorizing || s.pendingMCPAuthorization == nil {
		return PendingMCPAuthorization{}, false
	}
	return s.pendingMCPAuthorization.Clone(), true
}

// ClaimMCPAuthorization consumes the durable authorization claim and returns
// the exact call continuation. The caller executes Call once and records its
// result followed by one synthetic result for every Deferred call.
func (s *Session) ClaimMCPAuthorization() (PendingMCPAuthorization, error) {
	if err := s.ValidateMCPAuthorizationState(); err != nil {
		return PendingMCPAuthorization{}, err
	}
	if s.State != StateAuthorizing {
		return PendingMCPAuthorization{}, ErrNoPendingMCPAuthorization
	}
	pending := s.pendingMCPAuthorization.Clone()
	s.pendingMCPAuthorization = nil
	s.State = StateRunning
	return pending, nil
}

// AbortMCPAuthorization leaves authorizing with deterministic, ordered error
// results for the parked call and every deferred sibling. The caller records
// the returned slice through RecordToolResults as one aggregate mutation.
func (s *Session) AbortMCPAuthorization(reason string) ([]ToolResult, error) {
	return s.resolveMCPAuthorization(reason)
}

// InterruptMCPAuthorization resolves a restored authorization whose original
// runtime transaction was lost on process interruption. It never reconnects or
// executes the old call.
func (s *Session) InterruptMCPAuthorization() ([]ToolResult, error) {
	return s.resolveMCPAuthorization("MCP authorization interrupted by process restart")
}

func (s *Session) resolveMCPAuthorization(reason string) ([]ToolResult, error) {
	if err := s.ValidateMCPAuthorizationState(); err != nil {
		return nil, err
	}
	if s.State != StateAuthorizing {
		return nil, ErrNoPendingMCPAuthorization
	}
	if strings.TrimSpace(reason) == "" {
		reason = "MCP authorization aborted"
	}
	pending := s.pendingMCPAuthorization.Clone()
	results := make([]ToolResult, 0, len(pending.Deferred)+1)
	results = append(results, NewToolError(pending.Call.ID, reason))
	for _, call := range pending.Deferred {
		results = append(results, NewToolError(call.ID, "MCP authorization deferred sibling was not executed"))
	}
	s.pendingMCPAuthorization = nil
	s.State = StateRunning
	return results, nil
}

// ValidateMCPAuthorizationState verifies the state/pending correspondence and,
// while authorizing, the sole permitted temporary tool-pairing exception.
func (s *Session) ValidateMCPAuthorizationState() error {
	switch s.State {
	case StateAuthorizing:
		if s.pending != nil || s.pendingMCPAuthorization == nil {
			return fmt.Errorf("session: authorizing state/pending mismatch")
		}
		return validatePendingMCPAuthorization(s.Conversation.Messages, *s.pendingMCPAuthorization)
	default:
		if s.pendingMCPAuthorization != nil {
			return fmt.Errorf("session: MCP authorization pending outside authorizing state")
		}
		if s.State == StateAwaiting && s.pending == nil {
			return fmt.Errorf("session: awaiting state/pending mismatch")
		}
		if s.State != StateAwaiting && s.pending != nil {
			return fmt.Errorf("session: permission ask pending outside awaiting state")
		}
		return nil
	}
}

//nolint:gocyclo // The validation intentionally follows the history pairing state machine.
func validatePendingMCPAuthorization(messages []Message, pending PendingMCPAuthorization) error {
	for name, value := range map[string]string{
		"authorization ID": pending.AuthorizationID,
		"route ID":         pending.RouteID,
		"config ID":        pending.ConfigID,
	} {
		if !validMCPAuthorizationCorrelation(value) {
			return fmt.Errorf("invalid %s", name)
		}
	}
	if !validMCPAuthorizationLabel(pending.Backend) {
		return fmt.Errorf("invalid backend")
	}
	if pending.ExpiresAt.IsZero() {
		return fmt.Errorf("invalid expiry")
	}
	if !validMCPAuthorizationCall(pending.Call) {
		return fmt.Errorf("invalid pending call")
	}
	seen := map[ToolCallID]struct{}{pending.Call.ID: {}}
	for _, call := range pending.Deferred {
		if !validMCPAuthorizationCall(call) {
			return fmt.Errorf("invalid deferred call")
		}
		if _, exists := seen[call.ID]; exists {
			return fmt.Errorf("duplicate call ID %q", call.ID)
		}
		seen[call.ID] = struct{}{}
	}

	lastAssistant := -1
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == RoleAssistant {
			lastAssistant = i
			break
		}
	}
	if lastAssistant < 0 {
		return fmt.Errorf("pending call has no trailing assistant turn")
	}
	calls := messages[lastAssistant].ToolCalls
	if err := ValidateToolPairing(messages[:lastAssistant]); err != nil {
		return fmt.Errorf("history before trailing assistant turn is not paired: %w", err)
	}
	callIDs := make(map[ToolCallID]struct{}, len(calls))
	for _, call := range calls {
		if !validMCPAuthorizationCall(call) {
			return fmt.Errorf("invalid trailing assistant call")
		}
		if _, duplicate := callIDs[call.ID]; duplicate {
			return fmt.Errorf("duplicate trailing assistant call ID %q", call.ID)
		}
		callIDs[call.ID] = struct{}{}
	}
	pendingAt := -1
	for i, call := range calls {
		if call.ID == pending.Call.ID {
			if call.Name != pending.Call.Name {
				return fmt.Errorf("pending call does not match trailing assistant call")
			}
			pendingAt = i
		}
	}
	if pendingAt < 0 {
		return fmt.Errorf("pending call not found in trailing assistant turn")
	}
	if !reflect.DeepEqual(calls[pendingAt+1:], pending.Deferred) {
		return fmt.Errorf("deferred calls do not match trailing assistant suffix")
	}

	answered := make(map[ToolCallID]struct{})
	for _, message := range messages[lastAssistant+1:] {
		if message.Role != RoleTool || message.ToolResult == nil {
			return fmt.Errorf("non-tool message follows trailing assistant turn")
		}
		id := message.ToolResult.CallID
		if _, known := callIDs[id]; !known {
			return fmt.Errorf("result for unknown call %q follows trailing assistant turn", id)
		}
		if _, duplicate := answered[id]; duplicate {
			return fmt.Errorf("duplicate result for call %q", id)
		}
		answered[id] = struct{}{}
	}
	for i, call := range calls {
		_, hasResult := answered[call.ID]
		switch {
		case i < pendingAt && !hasResult:
			return fmt.Errorf("executed call %q lacks result", call.ID)
		case i >= pendingAt && hasResult:
			return fmt.Errorf("parked call %q already has result", call.ID)
		}
	}
	return nil
}

func validMCPAuthorizationCall(call ToolCall) bool {
	return validMCPAuthorizationCorrelation(string(call.ID)) && strings.TrimSpace(call.Name) != ""
}

func validMCPAuthorizationLabel(value string) bool {
	if strings.TrimSpace(value) == "" || len(value) > 256 {
		return false
	}
	for _, r := range value {
		if unicode.IsControl(r) {
			return false
		}
	}
	return true
}
func validMCPAuthorizationCorrelation(value string) bool {
	if value == "" || len(value) > 256 {
		return false
	}
	for _, r := range value {
		if unicode.IsControl(r) || unicode.IsSpace(r) {
			return false
		}
	}
	return true
}
