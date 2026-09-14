# mecabroker chart

Managed MCP OAuth clients are rendered into the broker's strict `broker.json`
configuration. A `dcr` client must provide an `upstream` with `mode: oauth2`
and both `authorizationEndpoint` and `tokenEndpoint`; an issuer-only DCR
configuration is rejected because ToolHive cannot complete DCR without those
explicit endpoints. Use `preregistered` when the upstream already supplies a
client identity and secret.
