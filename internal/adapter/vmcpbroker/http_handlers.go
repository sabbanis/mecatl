package vmcpbroker

import (
	"context"
	"io"
	"net/http"
	"net/url"
)

const (
	maxCallbackValueBytes = 8 << 10
	// Each decoded byte can occupy three percent-encoded bytes. A valid query
	// has code and state, and may include one scope, plus literal separators.
	maxCallbackQueryBytes = 3*3*maxCallbackValueBytes + len("code=&state=&scope=")
)

// CallbackHandler accepts only the broker-created authorization response. The
// Runtime, not the browser, binds code/state to a session and backend.
func CallbackHandler(callback func(context.Context, string, string) error) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Referrer-Policy", "no-referrer")
		if r.Method != http.MethodGet || r.Body == nil || r.ContentLength > 0 {
			callbackBadRequest(w)
			return
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, 1))
		if err != nil || len(body) != 0 {
			callbackBadRequest(w)
			return
		}
		if len(r.URL.RawQuery) > maxCallbackQueryBytes {
			callbackBadRequest(w)
			return
		}
		values, err := url.ParseQuery(r.URL.RawQuery)
		if err != nil || (len(values) != 2 && len(values) != 3) {
			callbackBadRequest(w)
			return
		}
		code, ok := callbackValue(values, "code")
		if !ok {
			callbackBadRequest(w)
			return
		}
		state, ok := callbackValue(values, "state")
		if !ok {
			callbackBadRequest(w)
			return
		}
		if len(values) == 3 {
			if _, ok := callbackValue(values, "scope"); !ok {
				callbackBadRequest(w)
				return
			}
		}
		if callback == nil || callback(r.Context(), code, state) != nil {
			callbackBadRequest(w)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "Authorization complete. You may close this window.\n")
	})
}

func callbackValue(values url.Values, key string) (string, bool) {
	value, ok := values[key]
	if !ok || len(value) != 1 || value[0] == "" || len(value[0]) > maxCallbackValueBytes {
		return "", false
	}
	return value[0], true
}

func callbackBadRequest(w http.ResponseWriter) {
	w.WriteHeader(http.StatusBadRequest)
	_, _ = io.WriteString(w, "Bad request.\n")
}
