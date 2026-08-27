package tool

import (
	"context"
	"time"
)

// AuthorizationRequest is a non-secret, durable correlation for a tool whose
// execution requires an out-of-band authorization transaction. It carries no
// tool arguments, credential, or presentation URL.
type AuthorizationRequest struct {
	ID        string
	Backend   string
	RouteID   string
	ConfigID  string
	ExpiresAt time.Time
}

// AuthorizationRequester is an optional Tool capability. The dispatcher asks
// it only after ordinary permission and PreToolUse gates have allowed the
// effective call. required=false leaves execution unchanged.
type AuthorizationRequester interface {
	Tool
	RequestAuthorization(context.Context) (request AuthorizationRequest, required bool, err error)
	CancelAuthorization(ctx context.Context, authorizationID string) error
}

// DispatchSerial is an optional execution-order hint. Unlike ReadOnly, it does
// not change tool semantics or advertisement; it only keeps calls to the same
// stateful boundary out of read-parallel batches.
type DispatchSerial interface {
	DispatchSerial() bool
}
