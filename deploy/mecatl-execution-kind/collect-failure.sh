#!/bin/sh
set -eu
# Called only with the owned fixture's explicit kubeconfig/context. Each request
# is bounded; the caller also bounds the whole collector (including jq).
[ "$#" -eq 3 ] || exit 2
kubeconfig=$1
context=$2
output=$3
filter=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)/failure-evidence.jq
umask 077
set -C
{
  for resource in executionenvironments pods persistentvolumeclaims resourcequotas events; do
    if ! kubectl --kubeconfig "$kubeconfig" --context "$context" --request-timeout=10s get "$resource" -n execution-qualification -o json 2>/dev/null; then
      printf '{"unavailable":true}\n'
    fi
  done
} | jq -cs -f "$filter" 2>/dev/null | head -c 1048576 > "$output"
# Never substitute raw stderr or a manifest when a response cannot be projected.
if [ ! -s "$output" ]; then
  printf '{"kind":"collection","unavailable":true}\n' >> "$output"
fi
