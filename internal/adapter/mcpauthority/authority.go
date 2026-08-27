// Package mcpauthority carries the exclusive MCP construction selection between
// command-side profile loading and application composition.
package mcpauthority

import (
	"github.com/stacklok/mecatl/internal/adapter/mcp"
	"github.com/stacklok/mecatl/internal/adapter/permconfig"
)

type Mode string

const (
	Global Mode = "global"
	Broker Mode = "broker"
)

type BrokerConfig struct {
	Profiles    []permconfig.MCPServerProfile
	CallbackURL string
}

// Result is a tagged union. Its unexported payloads mechanically prevent callers
// from constructing a result that carries both authority paths.
type Result struct {
	mode   Mode
	global []mcp.ServerConfig
	close  interface{ Close() error }
	broker *BrokerConfig
}

func NewGlobal(servers []mcp.ServerConfig, close interface{ Close() error }) *Result {
	return &Result{mode: Global, global: append([]mcp.ServerConfig(nil), servers...), close: close}
}

func NewBroker(config BrokerConfig) *Result {
	return &Result{mode: Broker, broker: &BrokerConfig{Profiles: cloneProfiles(config.Profiles), CallbackURL: config.CallbackURL}}
}

func (r *Result) Mode() Mode { return r.mode }
func (r *Result) Global() ([]mcp.ServerConfig, interface{ Close() error }) {
	return append([]mcp.ServerConfig(nil), r.global...), r.close
}
func (r *Result) Broker() (BrokerConfig, bool) {
	if r == nil || r.broker == nil {
		return BrokerConfig{}, false
	}
	return BrokerConfig{Profiles: cloneProfiles(r.broker.Profiles), CallbackURL: r.broker.CallbackURL}, true
}

func cloneProfiles(in []permconfig.MCPServerProfile) []permconfig.MCPServerProfile {
	out := append([]permconfig.MCPServerProfile(nil), in...)
	for i := range out {
		a := &out[i].Auth
		if a.StaticBearer != nil {
			v := *a.StaticBearer
			a.StaticBearer = &v
		}
		if a.OAuth == nil {
			continue
		}
		o := *a.OAuth
		a.OAuth = &o
		o.Scopes = append([]string(nil), o.Scopes...)
		if o.Network != nil {
			n := *o.Network
			n.AdditionalOrigins = append([]string(nil), n.AdditionalOrigins...)
			n.PrivateOrigins = append([]string(nil), n.PrivateOrigins...)
			o.Network = &n
		}
		if o.Client.Preregistered != nil {
			v := *o.Client.Preregistered
			o.Client.Preregistered = &v
		}
		if o.Client.CIMD != nil {
			v := *o.Client.CIMD
			o.Client.CIMD = &v
		}
		if o.Credentials.Local != nil {
			v := *o.Credentials.Local
			o.Credentials.Local = &v
		}
		if o.Credentials.Environment != nil {
			v := *o.Credentials.Environment
			o.Credentials.Environment = &v
		}
	}
	return out
}
