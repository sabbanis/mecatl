# Changelog

Notable changes to `@stacklok-oss/mecatl-sdk` are recorded here.

For installation and API entry points, see the [TypeScript SDK README](./README.md).

## Unreleased

- Added `client.compatibility()` and `client.serverInfo()` so a consumer can
  read the compatibility document (API major, server capabilities, feature
  registry) and the safe server-identity probe without the raw client.
- Added `session.controls(runId)`: strict, run-id-addressed HTTP controls
  (`resolveAsk`, `cancel`, `steer`, `cancelSteer`) that need no event stream,
  so a client can act on a run it re-attached to or observes through a durable
  watch. `steer` returns the server's `accepted` / `appended` / `too_late`
  outcome and accepts a client-minted `messageId` and media parts; a control
  that outlives its run surfaces as `ServerError` `stale_run_control`.
- The HTTP transport now decodes `google.protobuf.Timestamp` and
  `google.protobuf.Duration` fields the daemon marshals with stdlib
  `encoding/json` (`{"seconds", "nanos"}` objects) — learning proposals,
  learned skills, dream plans, schedule specs and fires, and session
  snapshots no longer fail with `ProtocolError` against a real daemon.

## [0.1.0](https://www.npmjs.com/package/%40stacklok-oss%2Fmecatl-sdk/v/0.1.0)

- Initial public npm release.
