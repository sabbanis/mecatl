{{- define "mecabroker.validateImage" -}}
{{- if not (regexMatch "^sha256:[0-9a-f]{64}$" .Values.image.digest) -}}{{ fail "image.digest must be a lowercase sha256 digest" }}{{- end -}}
{{- if .Values.image.tag -}}{{ fail "image.tag is not permitted; use image.digest" }}{{- end -}}
{{- end -}}

{{- define "mecabroker.validateShutdownBudget" -}}
{{- $required := add (add (add (int .Values.drain.propagationDelaySeconds) (int .Values.drain.timeoutSeconds)) (int .Values.drain.listenerShutdownTimeoutSeconds)) 5 -}}
{{- if le (int .Values.terminationGracePeriodSeconds) $required -}}{{ fail (printf "terminationGracePeriodSeconds must exceed drain propagation + timeout + listener shutdown + 5s close (%ds)" $required) }}{{- end -}}
{{- end -}}

{{- define "mecabroker.brokerConfig" -}}
{{- $profiles := list -}}
{{- range $index, $profile := .Values.profiles -}}
{{- $rendered := dict "name" $profile.name "url" $profile.url "auth" $profile.auth -}}
{{- if eq $profile.auth "oauth" -}}
{{- $oauth := dict "client_id" $profile.oauth.clientID "client_secret_file" (printf "/var/run/mecabroker/oauth/%d/client-secret" $index) "scopes" $profile.oauth.scopes "request_refresh_token" $profile.oauth.requestRefreshToken -}}
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
{{- $config := dict
  "api_version" "mecabroker.mecatl.dev/v1"
  "listener" (dict "public_address" .Values.listener.publicAddress "tls_cert_file" (printf "/var/run/mecabroker/tls/%s" .Values.listener.tls.certKey) "tls_key_file" (printf "/var/run/mecabroker/tls/%s" .Values.listener.tls.keyKey))
  "workload_jwt" (dict "issuer" .Values.workloadJWT.issuer "jwks_uri" .Values.workloadJWT.jwksURI "audience" .Values.workloadJWT.audience "subject" .Values.workloadJWT.subject "trust_bundle_file" (printf "/var/run/mecabroker/workload-jwt/%s" .Values.workloadJWT.trustBundle.key) "max_jwks_staleness" (printf "%ds" (int .Values.workloadJWT.maxJWKSStalenessSeconds)))
  "callback_url" .Values.callbackURL
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
