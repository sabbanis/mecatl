# mecabroker chart

Managed MCP OAuth clients are rendered into the broker's strict `broker.json`
configuration. A `dcr` client must provide an `upstream` with `mode: oauth2`
and both `authorizationEndpoint` and `tokenEndpoint`; an issuer-only DCR
configuration is rejected because ToolHive cannot complete DCR without those
explicit endpoints. Use `task kind:load:broker` to build the local broker image and load it into the
`mecatl-dev` Kind cluster. The task prints the digest-form image values to use when
rendering the chart, for example:

```sh
IMAGE_DIGEST="$(task kind:load:broker | awk -F= '/image.digest=/{print $2}')"
helm upgrade --install mecabroker . \
  -f ci/production-values.yaml \
  --set image.repository=ko.local/mecabroker \
  --set image.digest="$IMAGE_DIGEST"
```

Set `KIND_CLUSTER` when using a different cluster. The fixture target is local-only;
production chart renders continue to require a canonical `sha256:` image digest and do
not permit `image.tag`.
