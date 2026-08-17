package governance

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sort"
)

const authorityVersion = 1

type authorityKind string

const (
	authorityNone         authorityKind = "none"
	authorityRestricted   authorityKind = "restricted"
	authorityUnrestricted authorityKind = "unrestricted"
)

var (
	// ErrInvalidAuthority reports an authority value that cannot safely bound a run.
	ErrInvalidAuthority = errors.New("governance: invalid authority")

	authorityName = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.:-]*$`)
)

// AuthorityProfile is the immutable execution-profile ceiling held by an Authority.
// A false field denies that capability; intersection can only turn fields off.
type AuthorityProfile struct {
	FileSystem  bool
	DirectWrite bool
	Isolated    bool
}

// AuthoritySpec is the restricted authority vocabulary. Tool and delegate names are
// exact canonical names; they are never patterns or policy rules.
type AuthoritySpec struct {
	Tools              []string
	Delegates          []string
	MaxDelegationDepth int
	Profile            AuthorityProfile
}

// Authority is an immutable, session-free ceiling on the capabilities a run may
// hold. Construct it with NewAuthority, NoneAuthority, UnrestrictedAuthority, or
// ParseAuthority.
type Authority struct {
	kind authorityKind
	spec AuthoritySpec
}

// NoneAuthority is an absent authority value. It is intentionally distinct from an
// empty restricted authority and cannot participate in attenuation algebra.
func NoneAuthority() Authority { return Authority{kind: authorityNone} }

// UnrestrictedAuthority is an explicit compatibility/root value with no v1
// restrictions. It is distinct from an empty restricted authority.
func UnrestrictedAuthority() Authority { return Authority{kind: authorityUnrestricted} }

// NewAuthority returns a restricted authority with sorted, de-duplicated exact
// names. Empty lists and a zero depth are a valid empty restricted authority.
func NewAuthority(spec AuthoritySpec) (Authority, error) {
	if spec.MaxDelegationDepth < 0 {
		return Authority{}, fmt.Errorf("%w: negative delegation depth", ErrInvalidAuthority)
	}
	tools, err := canonicalNames(spec.Tools)
	if err != nil {
		return Authority{}, fmt.Errorf("%w: tools: %w", ErrInvalidAuthority, err)
	}
	delegates, err := canonicalNames(spec.Delegates)
	if err != nil {
		return Authority{}, fmt.Errorf("%w: delegates: %w", ErrInvalidAuthority, err)
	}
	spec.Tools = tools
	spec.Delegates = delegates
	return Authority{kind: authorityRestricted, spec: spec}, nil
}

// ParseAuthority validates and parses an authority's canonical wire vocabulary.
// Unknown fields, unknown versions, and malformed names are rejected fail closed.
func ParseAuthority(raw string) (Authority, error) {
	var object map[string]json.RawMessage
	decoder := json.NewDecoder(bytes.NewBufferString(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&object); err != nil {
		return Authority{}, fmt.Errorf("%w: decode: %w", ErrInvalidAuthority, err)
	}
	if decoder.More() {
		return Authority{}, fmt.Errorf("%w: trailing data", ErrInvalidAuthority)
	}
	var version int
	var kind authorityKind
	if err := decodeRequired(object, "v", &version); err != nil || version != authorityVersion {
		return Authority{}, fmt.Errorf("%w: unsupported version", ErrInvalidAuthority)
	}
	if err := decodeRequired(object, "kind", &kind); err != nil {
		return Authority{}, fmt.Errorf("%w: kind", ErrInvalidAuthority)
	}
	switch kind {
	case authorityNone, authorityUnrestricted:
		if len(object) != 2 {
			return Authority{}, fmt.Errorf("%w: fields for %s", ErrInvalidAuthority, kind)
		}
		return Authority{kind: kind}, nil
	case authorityRestricted:
		if len(object) != 6 {
			return Authority{}, fmt.Errorf("%w: fields for restricted", ErrInvalidAuthority)
		}
		var spec AuthoritySpec
		if err := decodeRequired(object, "tools", &spec.Tools); err != nil {
			return Authority{}, fmt.Errorf("%w: tools", ErrInvalidAuthority)
		}
		if err := decodeRequired(object, "delegates", &spec.Delegates); err != nil {
			return Authority{}, fmt.Errorf("%w: delegates", ErrInvalidAuthority)
		}
		if err := decodeRequired(object, "depth", &spec.MaxDelegationDepth); err != nil {
			return Authority{}, fmt.Errorf("%w: depth", ErrInvalidAuthority)
		}
		profile, ok := object["profile"]
		if !ok || !validProfile(profile) {
			return Authority{}, fmt.Errorf("%w: profile", ErrInvalidAuthority)
		}
		if err := json.Unmarshal(profile, &spec.Profile); err != nil {
			return Authority{}, fmt.Errorf("%w: profile: %w", ErrInvalidAuthority, err)
		}
		return NewAuthority(spec)
	default:
		return Authority{}, fmt.Errorf("%w: unknown kind %q", ErrInvalidAuthority, kind)
	}
}

// Canonical returns the deterministic, validated serialization of a.
func (a Authority) Canonical() (string, error) {
	switch a.kind {
	case authorityNone, authorityUnrestricted:
		return fmt.Sprintf(`{"v":%d,"kind":%q}`, authorityVersion, a.kind), nil
	case authorityRestricted:
		canonical, err := NewAuthority(a.spec)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf(`{"v":%d,"kind":"restricted","tools":%s,"delegates":%s,"depth":%d,"profile":{"filesystem":%t,"direct_write":%t,"isolated":%t}}`,
			authorityVersion, jsonNames(canonical.spec.Tools), jsonNames(canonical.spec.Delegates), canonical.spec.MaxDelegationDepth,
			canonical.spec.Profile.FileSystem, canonical.spec.Profile.DirectWrite, canonical.spec.Profile.Isolated), nil
	default:
		return "", fmt.Errorf("%w: unset kind", ErrInvalidAuthority)
	}
}

// Equal reports whether two authorities are the same canonical bound.
func (a Authority) Equal(other Authority) bool {
	left, err := a.Canonical()
	if err != nil {
		return false
	}
	right, err := other.Canonical()
	return err == nil && left == right
}

// Contains reports whether a is at least as permissive as other. None is never
// treated as a grant, and malformed values fail closed.
func (a Authority) Contains(other Authority) bool {
	if _, err := a.Canonical(); err != nil {
		return false
	}
	if _, err := other.Canonical(); err != nil || other.kind == authorityNone {
		return false
	}
	if a.kind == authorityUnrestricted {
		return true
	}
	if a.kind != authorityRestricted || other.kind == authorityUnrestricted {
		return false
	}
	return namesContain(a.spec.Tools, other.spec.Tools) &&
		namesContain(a.spec.Delegates, other.spec.Delegates) &&
		a.spec.MaxDelegationDepth >= other.spec.MaxDelegationDepth &&
		profileContains(a.spec.Profile, other.spec.Profile)
}

// AllowsTool reports whether name is within this authority's tool ceiling.
// An unrestricted authority permits every name; none and malformed values deny.
func (a Authority) AllowsTool(name string) bool {
	if _, err := a.Canonical(); err != nil || !authorityName.MatchString(name) {
		return false
	}
	if a.kind == authorityUnrestricted {
		return true
	}
	if a.kind != authorityRestricted {
		return false
	}
	return namesContain(a.spec.Tools, []string{name})
}

// ToolNames returns a copy of the exact allowed tool-name set. Unrestricted
// authorities return nil because no finite catalog projection is implied.
func (a Authority) ToolNames() []string {
	switch a.kind {
	case authorityRestricted:
		return append([]string(nil), a.spec.Tools...)
	case authorityNone:
		return []string{}
	default:
		return nil
	}
}

// Intersect returns the greatest authority bounded by both inputs. None and
// malformed values fail closed rather than being interpreted as a broad grant.
func (a Authority) Intersect(other Authority) (Authority, error) {
	if _, err := a.Canonical(); err != nil {
		return Authority{}, err
	}
	if _, err := other.Canonical(); err != nil {
		return Authority{}, err
	}
	if a.kind == authorityNone || other.kind == authorityNone {
		return Authority{}, fmt.Errorf("%w: none authority", ErrInvalidAuthority)
	}
	if a.kind == authorityUnrestricted {
		return cloneAuthority(other)
	}
	if other.kind == authorityUnrestricted {
		return cloneAuthority(a)
	}
	return NewAuthority(AuthoritySpec{
		Tools:              intersectNames(a.spec.Tools, other.spec.Tools),
		Delegates:          intersectNames(a.spec.Delegates, other.spec.Delegates),
		MaxDelegationDepth: minInt(a.spec.MaxDelegationDepth, other.spec.MaxDelegationDepth),
		Profile: AuthorityProfile{
			FileSystem:  a.spec.Profile.FileSystem && other.spec.Profile.FileSystem,
			DirectWrite: a.spec.Profile.DirectWrite && other.spec.Profile.DirectWrite,
			Isolated:    a.spec.Profile.Isolated && other.spec.Profile.Isolated,
		},
	})
}

// Descend returns the authority a newly-created child may hold after consuming one
// delegation hop. The other constraints are unchanged. An unrestricted authority
// remains unrestricted for compatibility roots; a restricted authority with no
// remaining depth is rejected rather than silently creating an unbounded child.
func (a Authority) Descend() (Authority, error) {
	if _, err := a.Canonical(); err != nil {
		return Authority{}, err
	}
	switch a.kind {
	case authorityUnrestricted:
		return UnrestrictedAuthority(), nil
	case authorityRestricted:
		if a.spec.MaxDelegationDepth == 0 {
			return Authority{}, fmt.Errorf("%w: delegation depth exhausted", ErrInvalidAuthority)
		}
		spec := a.spec
		spec.MaxDelegationDepth--
		return NewAuthority(spec)
	default:
		return Authority{}, fmt.Errorf("%w: none authority", ErrInvalidAuthority)
	}
}
func decodeRequired(object map[string]json.RawMessage, field string, dest any) error {
	raw, ok := object[field]
	if !ok {
		return errors.New("missing")
	}
	return json.Unmarshal(raw, dest)
}

func validProfile(raw json.RawMessage) bool {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(raw, &object); err != nil || len(object) != 3 {
		return false
	}
	for _, field := range []string{"filesystem", "direct_write", "isolated"} {
		var value bool
		if err := decodeRequired(object, field, &value); err != nil {
			return false
		}
	}
	return true
}

func canonicalNames(names []string) ([]string, error) {
	if len(names) == 0 {
		return []string{}, nil
	}
	unique := make(map[string]struct{}, len(names))
	for _, name := range names {
		if !authorityName.MatchString(name) {
			return nil, fmt.Errorf("invalid canonical name %q", name)
		}
		unique[name] = struct{}{}
	}
	out := make([]string, 0, len(unique))
	for name := range unique {
		out = append(out, name)
	}
	sort.Strings(out)
	return out, nil
}

func jsonNames(names []string) string {
	encoded, _ := json.Marshal(names)
	return string(encoded)
}

func namesContain(container, values []string) bool {
	for _, value := range values {
		if index := sort.SearchStrings(container, value); index >= len(container) || container[index] != value {
			return false
		}
	}
	return true
}

func intersectNames(left, right []string) []string {
	out := make([]string, 0, minInt(len(left), len(right)))
	for _, name := range left {
		index := sort.SearchStrings(right, name)
		if index < len(right) && right[index] == name {
			out = append(out, name)
		}
	}
	return out
}

func profileContains(container, value AuthorityProfile) bool {
	return (!value.FileSystem || container.FileSystem) &&
		(!value.DirectWrite || container.DirectWrite) &&
		(!value.Isolated || container.Isolated)
}

func cloneAuthority(a Authority) (Authority, error) {
	if a.kind != authorityRestricted {
		return a, nil
	}
	return NewAuthority(a.spec)
}

func minInt(left, right int) int {
	if left < right {
		return left
	}
	return right
}
