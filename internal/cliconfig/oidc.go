// Package cliconfig: OIDC caller-identity wiring shared by the server mains
// (cmd/mecated, cmd/mecak8s), so the flag names, the required-audience rule and
// the fail-CLOSED startup decision cannot drift between them (ADR 0100
// decision 3).
//
// Token VALIDATION is not implemented here and never will be: it is delegated to
// the validator behind server.PrincipalValidator. This file only resolves the
// operator's flags into one and decides that a broken resolution is FATAL.

package cliconfig

import (
	"context"
	"errors"
	"flag"
	"fmt"

	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/syscaller"
)

// OIDCConfig carries the caller-identity flags. The zero value is identity OFF
// — the byte-identical no-auth posture.
type OIDCConfig struct {
	// Issuer is the IdP that mints the tokens (the `iss` claim, byte-exact). It
	// is the ON switch: empty means caller identity is off.
	Issuer string
	// JWKSURI, when set, is the STATIC signing-key endpoint; it short-circuits
	// OIDC discovery (the offline-test and air-gap hook).
	JWKSURI string
	// Audience is the `aud` this deployment accepts. REQUIRED when Issuer is
	// set: an audience-less verifier accepts tokens minted for other services.
	Audience string

	// NewValidator constructs the token validator. It is an injection point, not
	// an extension point: the real implementation (toolhive-core/authn) is wired
	// in by the mains once it exists, and a test substitutes a construction
	// failure. Nil means "no validator is available in this build", which is a
	// startup FAILURE when Issuer is set — never a silent degrade.
	//
	// ponytail: one field instead of a registry; when the real validator lands
	// it becomes a default here and this comment goes away.
	//
	// --- WHAT THE FOLLOW-UP ADAPTER MUST DO (decided here, up front) ---------
	//
	// toolhive-core/authn is not yet released (the API below lives on an
	// unmerged branch), so mecatl takes no dependency on it and this field stays
	// nil. The decisions the adapter would otherwise improvise are recorded here
	// rather than left to whoever writes it:
	//
	// SHAPE. `authn.NewValidator(ctx, cfg) (*authn.Validator, error)`;
	// `(*Validator).Validate(ctx, token) (authn.Principal, error)` returns a
	// VALUE; `(*Validator).Close()` stops the background JWKS refresh and is
	// idempotent. The adapter must therefore also implement io.Closer, which
	// server.Authenticator.Close type-asserts (teardown is an optional
	// capability; server.PrincipalValidator stays single-method).
	//
	// GRANT TYPE. `authn.Principal` has NO grant type and the library has no
	// azp/cid/client_id/grant handling at all, while session.Principal requires
	// one and the edge REJECTS an out-of-enum value — a field-copy adapter would
	// 401 every valid token. Derive it with
	// server.GrantTypeFromClaims(p.Claims); do not re-derive the rules.
	//
	// ERROR MAPPING. authn errors are a struct (`authn.Error` with a `Code`),
	// not errors.Is-able sentinels, so the adapter switches on the CODE and
	// wraps mecatl's sentinel — the 401-vs-503 split is load-bearing at the edge
	// (an IdP outage must not be reported as an authn failure):
	//
	//	authn.CodeInvalidToken   (401) → server.ErrInvalidToken
	//	authn.CodeInvalidRequest (400) → server.ErrInvalidToken
	//	authn.CodeUnavailable    (503) → server.ErrIdentityUnavailable
	//	anything unrecognised          → server.ErrInvalidToken (fail CLOSED)
	//
	// ponytail: a table, not a helper — a code→sentinel switch that cannot yet
	// type-assert the error it switches on is untestable scaffolding, and the
	// real switch is three lines inside the adapter.
	//
	// CONFIG DEFAULTS mecatl PINS rather than inherits. `authn.Config` is much
	// richer than these three flags (Audiences, AllowAnyAudience, Leeway,
	// MaxJWKSStaleness, AcceptedTokenTypes, MaxTokenLifetime, HTTPClient,
	// InsecureAllowHTTP, AllowPrivateIP, CACertPath, KeyProvider). No flags are
	// added for the rest until an operator asks; these two are pinned because
	// either one flipped defeats the exercise:
	//
	//	AllowAnyAudience: false  — an audience-less verifier accepts tokens
	//	                           minted for another service; Audience is
	//	                           already REQUIRED here for the same reason.
	//	InsecureAllowHTTP: false — a plaintext JWKS fetch lets anyone on the
	//	                           path substitute the signing keys.
	//
	// Audience maps to Audiences[0] (the library's field is plural). Making
	// --oidc-audience REPEATABLE is a deliberate LATER change, not an oversight:
	// it is a superset of today's behaviour (a flag.Value collecting into a
	// []string, one element in the common case) and it is what a deployment
	// behind two names needs — but a single required audience is the safe
	// default to ship, and adding it later breaks no existing invocation.
	NewValidator func(ctx context.Context, c OIDCConfig) (server.PrincipalValidator, error)
}

// Enabled reports whether the operator asked for caller identity.
func (c OIDCConfig) Enabled() bool { return c.Issuer != "" }

// RegisterOIDCFlags registers the three caller-identity flags on fs. Both server
// mains call it so the names and help text are identical.
func RegisterOIDCFlags(fs *flag.FlagSet, c *OIDCConfig) {
	fs.StringVar(&c.Issuer, "oidc-issuer", "",
		"OIDC issuer URL (the `iss` claim, byte-exact) whose tokens identify callers. Setting it turns caller identity ON: every request must present a bearer the IdP vouches for, and the verified (iss, sub) is recorded as the session owner. Empty (default) disables it — requests are processed unauthenticated exactly as before. Requires --oidc-audience; a validator that cannot be constructed is FATAL, never a silent fall-back to unauthenticated")
	fs.StringVar(&c.JWKSURI, "oidc-jwks-uri", "",
		"STATIC JWKS endpoint for --oidc-issuer; short-circuits OIDC discovery (the air-gapped / pinned-key deployment). Empty derives it from the issuer's discovery document")
	fs.StringVar(&c.Audience, "oidc-audience", "",
		"audience (`aud`) this deployment accepts, REQUIRED with --oidc-issuer: an audience-less verifier would accept tokens minted for a different service")
}

// ErrOIDCMisconfigured is returned when caller identity is requested but cannot
// be wired. It is fatal at startup by design.
var ErrOIDCMisconfigured = errors.New("oidc: misconfigured")

// OIDCValidator resolves c into a token validator, or (nil, nil) when caller
// identity is off (the unchanged path).
//
// ctx MUST be the SERVER-ROOT context: the validator owns background JWKS
// refresh, so binding it to a per-request context would tear key rotation down
// with the first request.
//
// Every failure is FATAL — the caller must refuse to start. Degrading to the
// unauthenticated path here would silently turn an authenticated deployment into
// an open one.
func OIDCValidator(ctx context.Context, c OIDCConfig) (server.PrincipalValidator, error) {
	if !c.Enabled() {
		return nil, nil
	}
	if c.Audience == "" {
		return nil, fmt.Errorf("%w: --oidc-issuer is set but --oidc-audience is empty", ErrOIDCMisconfigured)
	}
	if c.NewValidator == nil {
		return nil, fmt.Errorf("%w: no OIDC token validator is available in this build", ErrOIDCMisconfigured)
	}
	// The validator's background JWKS refresh has no caller: it runs as the
	// explicit system principal (ADR 0100 decision 7).
	v, err := c.NewValidator(syscaller.Context(ctx, syscaller.RootJWKSRefresh), c)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrOIDCMisconfigured, err)
	}
	if v == nil {
		return nil, fmt.Errorf("%w: validator constructor returned no validator", ErrOIDCMisconfigured)
	}
	return v, nil
}
