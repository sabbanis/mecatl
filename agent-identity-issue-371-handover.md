---
matlatl: orphan-intentional
---

# Issue #371 handover — authority must attenuate

This is a handover note, not an acceptance plan and not a decision record. It
records the agreed next step after caller separation.

## Starting point

`acc/caller-separation` is the right prerequisite, but it is not all the
substrate for #371. It gives us the inbound half: a verified caller, durable
ownership of sessions and other persisted resources, and an application context
that can decide whether that caller may touch a handle.

That prevents Alice from operating Bob's session. It does not prevent Alice's
low-authority agent from asking to spawn a higher-authority `deployer` child, or
from resuming an old child after its definition has become broader. Those are not
resource-owner lookups. They are authority propagation problems at the point a
run is created, delegated, or resumed.

The outbound identity draft explains why this distinction matters. The model is
an untrusted chooser of requests. It must be able to ask for a narrower child,
but never be able to turn a request, a definition name, a model override, or a
resume into new capability. The useful invariant is deliberately short:

> Spawn narrows. Resume never widens.

## The direction

Treat authority as explicit runtime state, rather than as a late lookup of the
current definition or configuration.

At a minimum, each active run needs a compact authority envelope rooted in the
verified caller context that caller separation supplies. The envelope is the
maximum that run may spend: the relevant capabilities and bindings (for example,
selected identity/credential, workspace, tool, and target restrictions) that
mecatl can actually enforce. Do not design a general policy language before the
first enforceable constraints are known.

Every child constructor derives its envelope by intersection:

1. what the parent currently holds;
2. the resolved named definition's maximum, if a definition is selected; and
3. any restriction explicitly requested for this child.

A requested capability not present in the parent is an attempted widening. It
must be refused before the child gains a runner, tool catalog, workspace, or
outbound handle. The operation belongs in one shared core seam; Subagent,
Parallel, and Team must not each implement a slightly different merge.

The writable Subagent path is the sharpest proof. It runs against the real parent
workspace, so its envelope has to be narrowed before that direct-write runner is
made available. A check after the child has started is too late.

## Resume is the test that exposes the design

Persist a ceiling with a child session. On resume, derive the new effective
authority from the authenticated resumer and that persisted ceiling. Do not use a
newer definition or ambient configuration as the child's authority source. If the
ceiling is missing or cannot be interpreted, fail closed; treating it as the
current definition is exactly the widening path #371 is meant to close.

Caller separation's ownership check remains necessary on resume: a foreign
caller should not even find the child. The ceiling is the separate second check
that protects the legitimate owner from configuration drift and from a model's
attempt to select a broader definition.

## Definition names are part of the boundary

Definition selection must be fixed before it contributes a ceiling. An
operator-tier definition owns its name. A project-tier definition with the same
name must be rejected, not allowed to shadow it depending on discovery order.
Otherwise no request changes owner and no wire data is forged, yet a lower-trust
body can replace the authority limit selected by `agent:`.

## What to prove, not a task list

Use actor-and-ordering tests rather than only positive unit properties:

- Start with a deliberately constrained parent and ask every delegation path for
  something broader. Show that no child starts and no privileged tool or handle is
  obtained; also show that a genuinely narrower request still works.
- Repeat this for plain, named, writable, forked, background, model-overridden,
  Parallel, and Team children. The concern is coverage of spawn seams, not a
  separate policy per tool.
- Persist a constrained child, broaden its definition/configuration, restart the
  service, and resume it. It must not become broader. A foreign caller must still
  receive the same absence-shaped result as for an unknown child.
- Define an operator agent and a project agent with the same name. The project
  definition must never be selected or supply a ceiling; non-colliding project
  definitions must keep their existing trust-gated behavior.

The external gateway/token-exchange design is intentionally not the first
implementation slice. The local envelope and its attenuation are the substrate a
future outbound token can honestly encode. Sharing authority between independent
callers, cross-system credential protocol, and migration of pre-ceiling snapshots
remain separate decisions.

## Suggested implementation order

Finish caller separation first. Then identify the smallest set of authority
constraints the harness can enforce now and add the runtime envelope plus snapshot
ceiling. Route all child construction through the single intersection seam,
starting with Subagent and its writable path, then Parallel and Team. Add the
restart/configuration-drift proof once persistence is stable. Resolve definition
name collisions using the same resolved-definition value used by the spawn seam.
