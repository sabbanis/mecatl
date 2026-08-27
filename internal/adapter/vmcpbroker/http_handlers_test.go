package vmcpbroker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestInvariant_mcp_callback_input_is_bounded_and_never_reflected(t *testing.T) {
	code, state := "code-canary", "state-canary"
	called := false
	h := CallbackHandler(func(_ context.Context, gotCode, gotState string) error {
		called = gotCode == code && gotState == state
		return nil
	})
	cases := map[string]*http.Request{
		"success":         httptest.NewRequest(http.MethodGet, "https://attacker.invalid/callback?code="+code+"&state="+state, nil),
		"post":            httptest.NewRequest(http.MethodPost, "https://attacker.invalid/callback?code="+code+"&state="+state, nil),
		"body":            httptest.NewRequest(http.MethodGet, "https://attacker.invalid/callback?code="+code+"&state="+state, strings.NewReader("x")),
		"duplicate":       httptest.NewRequest(http.MethodGet, "https://attacker.invalid/callback?code="+code+"&code=again&state="+state, nil),
		"duplicate-state": httptest.NewRequest(http.MethodGet, "https://attacker.invalid/callback?code="+code+"&state="+state+"&state=again", nil),
		"missing":         httptest.NewRequest(http.MethodGet, "https://attacker.invalid/callback?code="+code, nil),
		"unexpected":      httptest.NewRequest(http.MethodGet, "https://attacker.invalid/callback?code="+code+"&state="+state+"&backend=forged", nil),
		"malformed":       httptest.NewRequest(http.MethodGet, "https://attacker.invalid/callback?code=%zz&state="+state, nil),
		"oversized":       httptest.NewRequest(http.MethodGet, "https://attacker.invalid/callback?code="+strings.Repeat("a", 8193)+"&state="+state, nil),
	}
	for name, request := range cases {
		t.Run(name, func(t *testing.T) {
			called = false
			rr := httptest.NewRecorder()
			h.ServeHTTP(rr, request)
			if rr.Header().Get("Cache-Control") != "no-store" || rr.Header().Get("Referrer-Policy") != "no-referrer" {
				t.Fatalf("missing privacy headers: %#v", rr.Header())
			}
			if strings.Contains(rr.Body.String(), code) || strings.Contains(rr.Body.String(), state) || strings.Contains(rr.Body.String(), "attacker.invalid") {
				t.Fatalf("response reflects untrusted input: %q", rr.Body.String())
			}
			if name == "success" {
				if rr.Code != http.StatusOK || !called {
					t.Fatalf("success = %d, called=%t", rr.Code, called)
				}
			} else if rr.Code != http.StatusBadRequest || called {
				t.Fatalf("rejection = %d, called=%t", rr.Code, called)
			}
		})
	}
}

func TestInvariant_mcp_callback_cannot_select_authority(t *testing.T) {
	called := false
	h := CallbackHandler(func(context.Context, string, string) error { called = true; return nil })
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "https://attacker.invalid/callback?code=x&state=y&session=other", nil))
	if rr.Code != http.StatusBadRequest || called {
		t.Fatalf("authority selecting request = %d, called=%t", rr.Code, called)
	}
}
