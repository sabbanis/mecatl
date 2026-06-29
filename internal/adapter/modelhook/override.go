package modelhook

import (
	"strings"
	"sync"
)

// overrideMarker is the case-sensitive directive a HUMAN prefixes to a re-issued
// prompt to authorize the NEXT matching guardrail block ONCE. It is matched only on
// the first non-empty line of the GENUINE user prompt (Service.StartRunContent), never
// on tool results / fetched pages / MCP responses / model output — that channel
// separation is the load-bearing security property (ADR 0061).
const overrideMarker = "/guardrail-allow"

// overrideScopeSep separates the optional tool token from the optional command
// substring in the directive grammar: `/guardrail-allow [<tool>] [-- <command>]`.
const overrideScopeSep = "--"

// OverrideScope narrows which guardrail block an armed override may authorize. A
// zero-value scope (both fields empty) authorizes the next block on ANY tool. Tool, if
// set, restricts the override to that exact tool name; Command, if set, restricts it to
// a block whose extracted command CONTAINS the substring (tightening — a human who
// wrote `Bash -- gh pr merge` does not authorize an unrelated `git push`).
type OverrideScope struct {
	// Tool, when non-empty, requires an exact tool-name match for the override to fire.
	Tool string
	// Command, when non-empty, requires the blocked command to CONTAIN this substring
	// (Bash only — the command is "" for non-Bash tools, so a Command-scoped override
	// never fires on a non-Bash block).
	Command string
}

// matches reports whether this armed scope authorizes a block on (tool, cmd). An empty
// Tool matches any tool; an empty Command matches any command; a non-empty Command
// matches iff cmd contains it (so a non-Bash block, whose cmd is "", is authorized only
// by a Command-less scope).
func (s OverrideScope) matches(tool, cmd string) bool {
	if s.Tool != "" && s.Tool != tool {
		return false
	}
	if s.Command != "" && !strings.Contains(cmd, s.Command) {
		return false
	}
	return true
}

// OverrideArmer is the concurrency-safe, session-keyed, ONE-SHOT holder for human
// guardrail overrides. Arm records a scope for a session id (the genuine-user-prompt
// scan in Service.StartRunContent is the SOLE caller); Consume is the atomic
// test-and-clear the Runner performs on a would-be block. Session-keying gives child
// isolation for free: the Runner is wired only into the MAIN engine, and a child
// session id never matches a parent's arm. A nil *OverrideArmer is safe — Arm is a
// no-op and Consume returns false (the byte-identical OFF posture).
type OverrideArmer struct {
	mu    sync.Mutex
	armed map[string]OverrideScope
}

// NewOverrideArmer constructs an empty armer.
func NewOverrideArmer() *OverrideArmer {
	return &OverrideArmer{armed: make(map[string]OverrideScope)}
}

// Arm records a one-shot override scope for sessionID, replacing any prior un-consumed
// arm for that session (a fresh human directive supersedes a stale one). A nil receiver
// is a no-op.
func (a *OverrideArmer) Arm(sessionID string, scope OverrideScope) {
	if a == nil {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.armed == nil {
		a.armed = make(map[string]OverrideScope)
	}
	a.armed[sessionID] = scope
}

// Consume atomically tests-and-clears the armed override for sessionID. It returns true
// (and REMOVES the entry — one-shot) iff an entry is armed for that session AND its
// scope matches (tool, cmd). A non-match leaves the entry in place (a scoped override
// is not burned by an unrelated block). A nil receiver returns false.
func (a *OverrideArmer) Consume(sessionID, tool, cmd string) bool {
	if a == nil {
		return false
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	scope, ok := a.armed[sessionID]
	if !ok || !scope.matches(tool, cmd) {
		return false
	}
	delete(a.armed, sessionID)
	return true
}

// ParseOverrideDirective scans text for the human override directive on its FIRST
// non-empty line ONLY. The grammar is:
//
//	/guardrail-allow [<tool>] [-- <command-substring>]
//
// On a match it returns the parsed scope, the remainder (text with that first directive
// line removed, the rest preserved verbatim), and found=true. Otherwise it returns the
// zero scope, the original text, and found=false. The marker is case-SENSITIVE.
//
// This is a deliberately TINY, separate parser — it does NOT reuse engine/prompt's slash
// command machinery (a different trust domain: that path expands LIVE commands from
// disk; this path arms a security override only from the genuine principal channel).
func ParseOverrideDirective(text string) (scope OverrideScope, remainder string, found bool) {
	lines := strings.Split(text, "\n")
	idx := -1
	for i, ln := range lines {
		if strings.TrimSpace(ln) == "" {
			continue
		}
		idx = i
		break
	}
	if idx < 0 {
		return OverrideScope{}, text, false
	}
	first := strings.TrimSpace(lines[idx])
	rest, ok := cutMarker(first)
	if !ok {
		return OverrideScope{}, text, false
	}
	scope = parseScope(rest)
	// Remove the directive line, preserving the rest verbatim.
	remaining := append(append([]string{}, lines[:idx]...), lines[idx+1:]...)
	return scope, strings.Join(remaining, "\n"), true
}

// overrideNearMissPrefix is the case-insensitive prefix that marks a FIRST-LINE
// near-miss: a line the user plainly intended as an override directive but that
// ParseOverrideDirective rejected (a typo, wrong case, or malformed grammar). It is
// deliberately broad ("/guardrail") so `/Guardrail-Allow`, `/guardrail-allowance`, and
// `/guardrailallow` all trip it, but narrow enough that an ordinary prompt mentioning a
// guardrail in prose does not (it must START the first non-empty line).
const overrideNearMissPrefix = "/guardrail"

// LooksLikeOverrideDirective reports whether the FIRST non-empty line of text appears to
// be an attempt at the /guardrail-allow directive — i.e. it begins (case-insensitively)
// with "/guardrail". It is FIRST-LINE only (an ordinary prompt that mentions /guardrail
// mid-text does not trip it), matching ParseOverrideDirective's scan. The caller uses it
// to detect a near-miss: when this is true but ParseOverrideDirective returned
// found=false, the user typo'd a directive and should be told it was not recognized
// (a near-miss NEVER arms — fail-safe — this is purely a feedback signal).
func LooksLikeOverrideDirective(text string) bool {
	for _, ln := range strings.Split(text, "\n") {
		trimmed := strings.TrimSpace(ln)
		if trimmed == "" {
			continue
		}
		return strings.HasPrefix(strings.ToLower(trimmed), overrideNearMissPrefix)
	}
	return false
}

// cutMarker reports whether line begins with the override marker as a whole token
// (the marker followed by end-of-string or whitespace, so `/guardrail-allowance` does
// NOT match), and returns the trimmed tail after the marker.
func cutMarker(line string) (rest string, ok bool) {
	if line == overrideMarker {
		return "", true
	}
	tail, ok := strings.CutPrefix(line, overrideMarker+" ")
	if !ok {
		return "", false
	}
	return strings.TrimSpace(tail), true
}

// parseScope parses the tail after the marker into an OverrideScope. Grammar:
// `[<tool>] [-- <command-substring>]`. A leading non-"--" token is the tool; everything
// after a "--" token is the command substring (trimmed, joined verbatim).
func parseScope(tail string) OverrideScope {
	if tail == "" {
		return OverrideScope{}
	}
	var scope OverrideScope
	fields := strings.Fields(tail)
	i := 0
	if i < len(fields) && fields[i] != overrideScopeSep {
		scope.Tool = fields[i]
		i++
	}
	if i < len(fields) && fields[i] == overrideScopeSep {
		i++
		scope.Command = strings.TrimSpace(strings.Join(fields[i:], " "))
	}
	return scope
}
