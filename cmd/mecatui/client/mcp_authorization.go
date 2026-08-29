package client

import (
	"context"
	"fmt"

	mecatlv1 "github.com/stacklok/mecatl/contracts/gen/go/mecatl/v1"
)

// MCPAuthorizationPresentation returns the owned authorization's live browser
// URL. It is intentionally separate from stream events: URLs are presentation
// secrets and are never replayed or rendered from durable event data.
func (c *Client) MCPAuthorizationPresentation(ctx context.Context, sessionID, authorizationID string) (string, error) {
	response, err := c.svc.GetMCPAuthorizationPresentation(ctx, &mecatlv1.MCPAuthorizationControlRequest{SessionId: sessionID, AuthorizationId: authorizationID})
	if err != nil {
		return "", fmt.Errorf("get MCP authorization presentation: %w", err)
	}
	return response.GetUrl(), nil
}

// RecheckMCPAuthorization starts the server-streamed authorization recheck.
// The returned events use the normal EventToMsg projection path.
func (c *Client) RecheckMCPAuthorization(ctx context.Context, sessionID, authorizationID string) (*EventStream, error) {
	stream, err := c.svc.RecheckMCPAuthorization(ctx, &mecatlv1.MCPAuthorizationControlRequest{SessionId: sessionID, AuthorizationId: authorizationID})
	if err != nil {
		return nil, fmt.Errorf("recheck MCP authorization: %w", err)
	}
	return NewEventStream(stream), nil
}

// CancelMCPAuthorization starts the server-streamed authorization cancellation.
func (c *Client) CancelMCPAuthorization(ctx context.Context, sessionID, authorizationID string) (*EventStream, error) {
	stream, err := c.svc.CancelMCPAuthorization(ctx, &mecatlv1.MCPAuthorizationControlRequest{SessionId: sessionID, AuthorizationId: authorizationID})
	if err != nil {
		return nil, fmt.Errorf("cancel MCP authorization: %w", err)
	}
	return NewEventStream(stream), nil
}
