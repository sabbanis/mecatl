# Qualification fork patch inventory

This inventory tracks the bounded divergence on branch
`i2i/remote-read-only-v1-v0.0.39` from upstream Mecatl v0.0.39 commit
`a711451616edf84f50e793c9bcbfb697ef400347`. It is patch evidence, not a release,
security, compatibility, or production-readiness claim.

| Patch | Purpose | Primary evidence | Disposition |
|---|---|---|---|
| Model-only session profile and compatibility signal | Provide exact no-FS placement and a construction-time empty model-visible catalog; reject client MCP and host-attached tools; advertise `model_only_v1` so clients can fail closed before session creation | `internal/app/model_only_profile_test.go`, `internal/adapter/server/profile_test.go`, `internal/adapter/server/features.go`, ADR 0350 | Candidate for upstream contribution after fork qualification |
| Explicit compaction-off | Disable automatic compaction and make manual compaction fail closed without history mutation or a model call | `internal/app/model_only_profile_test.go`, `cmd/mecated/main_test.go`, ADR 0350 | Candidate for upstream contribution after fork qualification |
| One-shot runtime and resource envelope | Permit one primary model attempt with no auxiliary model paths or run-scoped tool injection; reject scheduling; persist the attempt fence before launch; enforce positive request, response, event, buffered-event, session, queue, concurrency, token, and duration ceilings | `engine/agent/resource_limits_test.go`, `internal/app/model_only_limits_test.go`, `internal/app/model_only_profile_test.go`, `internal/app/scheduler_fire_model_only_test.go`, `internal/adapter/server/profile_test.go`, `internal/adapter/server/schedule_model_only_test.go`, ADR 0351 | Candidate for upstream contribution after fork qualification |

The pinned external client remains a separate consumer artifact and is not
imported into this fork as an implicit interface. Requalification must bind its
exact digest alongside the server, protocol, configuration, and deployment. A
new upstream base starts a new candidate and a complete qualification; it is
not merged into an already qualified artifact.

Related decisions: [ADR 0350](../adr/0350-model-only-profile-and-compaction-off.md)
defines the empty catalog and compaction-off profile, and
[ADR 0351](../adr/0351-bounded-one-shot-model-only-runs.md) defines the one-shot
resource envelope.
