{{- define "mecabroker.validateImage" -}}
{{- if not (regexMatch "^sha256:[0-9a-f]{64}$" .Values.image.digest) -}}{{ fail "image.digest must be a lowercase sha256 digest" }}{{- end -}}
{{- if .Values.image.tag -}}{{ fail "image.tag is not permitted; use image.digest" }}{{- end -}}
{{- end -}}

{{- define "mecabroker.validateShutdownBudget" -}}
{{- $required := add (add (add (int .Values.drain.propagationDelaySeconds) (int .Values.drain.timeoutSeconds)) (int .Values.drain.listenerShutdownTimeoutSeconds)) 5 -}}
{{- if le (int .Values.terminationGracePeriodSeconds) $required -}}{{ fail (printf "terminationGracePeriodSeconds must exceed drain propagation + timeout + listener shutdown + 5s close (%ds)" $required) }}{{- end -}}
{{- end -}}

{{- define "mecabroker.validateMCP" -}}
{{- if and .Values.mcp.servers (not .Values.mcp.broker.callbackURL) -}}{{ fail "mcp.broker.callbackURL is required whenever mcp.servers is non-empty; top-level callbackURL is not used" }}{{- end -}}
{{- if and .Values.mcp.broker.callbackURL .Values.profiles }}{{ fail "mcp.broker.callbackURL conflicts with legacy profiles; choose one callback/profile source" }}{{- end -}}
{{- if and .Values.mcp.servers .Values.profiles -}}{{ fail "mcp.servers and legacy profiles cannot be combined; choose one broker profile source" }}{{- end -}}
{{- if and .Values.mcp.servers .Values.mcp.broker.callbackURL (ne .Values.callbackURL "https://broker.invalid/callback") }}{{ fail "mcp.broker.callbackURL conflicts with the legacy top-level callbackURL; set only the mcp callback" }}{{- end -}}
{{- $seen := dict -}}
{{- range $index, $profile := .Values.profiles -}}
{{- $key := lower $profile.name -}}{{- if hasKey $seen $key }}{{ fail (printf "duplicate broker profile name %q" $profile.name) }}{{- end }}{{- $_ := set $seen $key true -}}
{{- end -}}
{{- range $index, $server := .Values.mcp.servers -}}
{{- $key := lower $server.name -}}{{- if hasKey $seen $key }}{{ fail (printf "duplicate broker profile name %q" $server.name) }}{{- end }}{{- $_ := set $seen $key true -}}
{{- if ne $server.auth.mode "oauth" }}{{ fail (printf "mcp.servers[%d] must use auth.mode oauth; direct entries remain owned by mecak8s" $index) }}{{- end -}}
{{- if not $server.auth.oauth.client.mode }}{{ fail (printf "mcp.servers[%d].auth.oauth.client.mode is required" $index) }}{{- end -}}
{{- if or (gt (len $server.auth.oauth.network.additionalOrigins) 0) (gt (len $server.auth.oauth.network.privateOrigins) 0) (ne (int $server.auth.oauth.network.maxRedirects) 0) }}{{ fail (printf "mcp.servers[%d].auth.oauth.network is unsupported by mecabroker; use mecak8s or remove network settings" $index) }}{{- end -}}
{{- if eq $server.auth.oauth.client.mode "cimd" -}}{{ fail "CIMD OAuth client_mode is unsupported by mecabroker; use preregistered or dcr" }}{{- end -}}
{{- if eq $server.auth.oauth.client.mode "dcr" -}}{{- if or (not $server.auth.oauth.upstream) (ne $server.auth.oauth.upstream.mode "oauth2") (not $server.auth.oauth.upstream.oauth2.authorizationEndpoint) (not $server.auth.oauth.upstream.oauth2.tokenEndpoint) }}{{ fail (printf "mcp.servers[%d] DCR requires explicit OAuth2 authorizationEndpoint and tokenEndpoint" $index) }}{{- end -}}{{- end -}}
{{- if eq $server.auth.oauth.client.mode "preregistered" }}{{- if not $server.auth.oauth.client.preregistered.secretKeyRef.name }}{{ fail (printf "mcp.servers[%d] preregistered Secret reference is required" $index) }}{{- end -}}{{- end -}}
{{- end -}}
{{- end -}}

{{- define "mecabroker.brokerConfig" -}}
{{- $profiles := list -}}
{{- range $index, $profile := .Values.profiles -}}
{{- $rendered := dict "name" $profile.name "url" $profile.url "auth" $profile.auth -}}
{{- if eq $profile.auth "oauth" -}}
{{- $oauth := dict "client_mode" "preregistered" "client_id" $profile.oauth.clientID "client_secret_file" (printf "/var/run/mecabroker/oauth/%d/client-secret" $index) "scopes" $profile.oauth.scopes "request_refresh_token" $profile.oauth.requestRefreshToken -}}
{{- if $profile.oauth.issuer }}{{- $_ := set $oauth "issuer" $profile.oauth.issuer }}{{- end -}}
{{- if $profile.oauth.authorizationEndpoint }}{{- $_ := set $oauth "authorization_endpoint" $profile.oauth.authorizationEndpoint }}{{- end -}}
{{- if $profile.oauth.tokenEndpoint }}{{- $_ := set $oauth "token_endpoint" $profile.oauth.tokenEndpoint }}{{- end -}}
{{- $_ := set $rendered "oauth" $oauth -}}
{{- $tools := list -}}
{{- range $tool := $profile.tools -}}
{{- $static := dict "name" $tool.name "schema" $tool.schema "read_only" $tool.readOnly -}}
{{- if $tool.description }}{{- $_ := set $static "description" $tool.description }}{{- end -}}
{{- $tools = append $tools $static -}}
{{- end -}}
{{- $_ := set $rendered "tools" $tools -}}
{{- end -}}
{{- $profiles = append $profiles $rendered -}}
{{- end -}}
{{- range $index, $server := .Values.mcp.servers -}}
{{- if ne $server.auth.mode "oauth" -}}{{ fail (printf "mcp.servers[%d] must use auth.mode oauth; direct none/staticBearer entries remain owned by mecak8s" $index) }}{{- end -}}
{{- $oauth := dict "scopes" $server.auth.oauth.scopes "request_refresh_token" (default false $server.auth.oauth.requestRefreshToken) -}}
{{- if eq $server.auth.oauth.client.mode "dcr" -}}
{{- if or (not $server.auth.oauth.upstream) (ne $server.auth.oauth.upstream.mode "oauth2") -}}{{ fail (printf "mcp.servers[%d] DCR requires explicit OAuth2 authorizationEndpoint and tokenEndpoint" $index) }}{{- end -}}
{{- if or (not $server.auth.oauth.upstream.oauth2.authorizationEndpoint) (not $server.auth.oauth.upstream.oauth2.tokenEndpoint) -}}{{ fail (printf "mcp.servers[%d] DCR requires explicit OAuth2 authorizationEndpoint and tokenEndpoint" $index) }}{{- end -}}
{{- end -}}
{{- if eq $server.auth.oauth.client.mode "preregistered" -}}
{{- $_ := set $oauth "client_mode" "preregistered" -}}
{{- $_ := set $oauth "client_id" $server.auth.oauth.client.preregistered.id -}}
{{- $_ := set $oauth "client_secret_file" (printf "/var/run/mecabroker/mcp-oauth/%d/client-secret" $index) -}}
{{- else if eq $server.auth.oauth.client.mode "cimd" -}}
{{- $_ := set $oauth "client_mode" "cimd" -}}
{{- $_ := set $oauth "cimd_document_url" $server.auth.oauth.client.cimd.documentURL -}}
{{- else -}}
{{- $_ := set $oauth "client_mode" "dcr" -}}
{{- $_ := set $oauth "dcr_discovery_url" $server.auth.oauth.client.dcr.discoveryURL -}}
{{- end -}}
{{- if $server.auth.oauth.issuer }}{{- $_ := set $oauth "issuer" $server.auth.oauth.issuer }}{{- end -}}
{{- if $server.auth.oauth.upstream }}{{- if eq $server.auth.oauth.upstream.mode "oauth2" }}{{- $_ := set $oauth "authorization_endpoint" $server.auth.oauth.upstream.oauth2.authorizationEndpoint }}{{- $_ := set $oauth "token_endpoint" $server.auth.oauth.upstream.oauth2.tokenEndpoint }}{{- end }}{{- end -}}
{{- $rendered := dict "name" $server.name "url" $server.url "auth" "oauth" "oauth" $oauth -}}
{{- if $server.auth.oauth.tools }}{{- $tools := list -}}{{- range $tool := $server.auth.oauth.tools }}{{- $tools = append $tools (dict "name" $tool.name "description" $tool.description "schema" $tool.inputSchema "read_only" (default false $tool.readOnly)) -}}{{- end -}}{{- $_ := set $rendered "tools" $tools -}}{{- end -}}
{{- $profiles = append $profiles $rendered -}}
{{- end -}}
{{- $callback := .Values.callbackURL -}}{{- if .Values.mcp.servers }}{{- $callback = .Values.mcp.broker.callbackURL -}}{{- else if .Values.mcp.broker.callbackURL }}{{- $callback = .Values.mcp.broker.callbackURL -}}{{- end -}}
{{- $config := dict
  "api_version" "mecabroker.mecatl.dev/v1"
  "listener" (dict "public_address" .Values.listener.publicAddress "tls_cert_file" (printf "/var/run/mecabroker/tls/%s" .Values.listener.tls.certKey) "tls_key_file" (printf "/var/run/mecabroker/tls/%s" .Values.listener.tls.keyKey))
  "workload_jwt" (dict "issuer" .Values.workloadJWT.issuer "jwks_uri" .Values.workloadJWT.jwksURI "audience" .Values.workloadJWT.audience "subject" .Values.workloadJWT.subject "trust_bundle_file" (printf "/var/run/mecabroker/workload-jwt/%s" .Values.workloadJWT.trustBundle.key) "max_jwks_staleness" (printf "%ds" (int .Values.workloadJWT.maxJWKSStalenessSeconds)))
  "callback_url" $callback
  "profiles" $profiles
  "drain" (dict "propagation_delay" (printf "%ds" (int .Values.drain.propagationDelaySeconds)) "timeout" (printf "%ds" (int .Values.drain.timeoutSeconds)) "listener_shutdown_timeout" (printf "%ds" (int .Values.drain.listenerShutdownTimeoutSeconds)))
  "transport" (dict "rpc_deadline" (printf "%ds" (int .Values.transport.rpcDeadlineSeconds)) "execute_deadline" (printf "%ds" (int .Values.transport.executeDeadlineSeconds)) "handle_idle_timeout" (printf "%ds" (int .Values.transport.handleIdleTimeoutSeconds)) "sweep_interval" (printf "%ds" (int .Values.transport.sweepIntervalSeconds)) "cleanup_timeout" (printf "%ds" (int .Values.transport.cleanupTimeoutSeconds)) "max_handles" .Values.transport.maxHandles "max_owners" .Values.transport.maxOwners "max_receipts" .Values.transport.maxReceipts "max_receipt_bytes" .Values.transport.maxReceiptBytes "max_pending_controls" .Values.transport.maxPendingControls "max_active_executes" .Values.transport.maxActiveExecutes)
  "runtime" (dict "max_logical_sessions" .Values.runtime.maxLogicalSessions "logical_retention" (printf "%ds" (int .Values.runtime.logicalRetentionSeconds)) "max_pending_auth_states" .Values.runtime.maxPendingAuthStates) -}}
{{- $config | toPrettyJson -}}
{{- end -}}

{{- define "mecabroker.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- define "mecabroker.fullname" -}}
{{- default (printf "%s-%s" .Release.Name (include "mecabroker.name" .)) .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- define "mecabroker.labels" -}}
app.kubernetes.io/name: {{ include "mecabroker.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: broker
{{- end -}}
