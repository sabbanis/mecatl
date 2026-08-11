//go:build kind_e2e

// SPIKE ONLY — see docs/acceptance/caller-identity-e2e.md "The dependency wall".
// Requires an agent image containing the toolhive-core/authn adapter, i.e. built
// under the GOWORK override. MUST NOT merge until toolhive-core tags authn.

package k8s_e2e_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/onsi/ginkgo/v2"
	"github.com/onsi/gomega"
)

// --- bearer-carrying HTTP helpers --------------------------------------------
//
// The existing helpers send no Authorization header, which is correct for the
// base deployment (no auth). Caller identity is inherently MULTI-caller, so these
// take the bearer per call rather than reading one shared credential — the same
// reason e2e/harness's single MECATL_E2E_AUTH_TOKEN is not enough here.

// createSessionAs creates a session presenting bearer, returning the status and
// the new id ("" unless 201).
func createSessionAs(ctx context.Context, addr, bearer string) (int, string) {
	ginkgo.GinkgoHelper()
	body, _ := json.Marshal(map[string]any{"workspace": "/tmp", "mode": "default"})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		fmt.Sprintf("http://%s/v1/sessions", addr), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	resp, err := http.DefaultClient.Do(req)
	gomega.ExpectWithOffset(1, err).NotTo(gomega.HaveOccurred(), "POST /v1/sessions")
	defer func() { _ = resp.Body.Close() }()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
	if resp.StatusCode != http.StatusCreated {
		return resp.StatusCode, ""
	}
	var out struct {
		SessionID string `json:"session_id"`
	}
	gomega.ExpectWithOffset(1, json.Unmarshal(raw, &out)).To(gomega.Succeed(), "unmarshal %s", raw)
	return resp.StatusCode, out.SessionID
}

// ownerSubjectFromStore reads the session's DURABLE snapshot straight out of
// Redis and returns the owner's subject ("" when the session records no owner).
//
// It reads the store rather than the API deliberately. The owner is exposed on
// the gRPC ListSessions row (proto SessionSummary.owner) and there is NO HTTP
// list endpoint, so an HTTP client cannot observe it at all — and this suite is
// kubectl-only by design (it imports no mecatl code, so it has no gRPC client).
//
// Reading the store is also the stronger assertion for what these specs claim:
// AC3.1 says "the store row ... names her", and the failover spec is about
// exactly that row surviving the pod that wrote it. Redis is the shared state
// both replicas read, so this observes the same bytes the successor will load.
func ownerSubjectFromStore(sessionID string) string {
	ginkgo.GinkgoHelper()
	// The redisstore keys a session at mecatl:session:<id> with the snapshot JSON
	// in the "blob" hash field.
	blob := runCmdQuiet("kubectl", "exec", "-n", k8sNamespace, "redis-0", "--",
		"redis-cli", "--no-raw", "HGET", "mecatl:session:"+sessionID, "blob")
	if blob == "" {
		return ""
	}
	// redis-cli --no-raw quotes the value and escapes the inner JSON; unquote it
	// before parsing so a shape change fails loudly here rather than silently
	// reporting "no owner".
	unquoted := blob
	if u, err := strconv.Unquote(strings.TrimSpace(blob)); err == nil {
		unquoted = u
	}
	var snap struct {
		Owner *struct {
			Subject string `json:"subject"`
		} `json:"owner"`
	}
	if err := json.Unmarshal([]byte(unquoted), &snap); err != nil {
		ginkgo.GinkgoWriter.Printf("snapshot did not parse as JSON: %v\nraw: %.400s\n", err, unquoted)
		return ""
	}
	if snap.Owner == nil {
		return ""
	}
	return snap.Owner.Subject
}

// --- the specs ---------------------------------------------------------------

var _ = ginkgo.Describe("caller identity in a real cluster", ginkgo.Serial, ginkgo.Ordered, func() {
	var fx *oidcFixture

	ginkgo.BeforeAll(func() {
		ctx := ginkgoSuiteCtx()
		fx = deployJWKS(ctx)
		patchAgentToOIDC(ctx)
	})

	// Shared cluster state: identity stays on for every later spec unless it is
	// put back. Restoring is what keeps these specs from failing the rest of the
	// suite.
	ginkgo.AfterAll(func() { restoreAgentFromOIDC(ginkgoSuiteCtx()) })

	// AC3.1 — the assertion this whole plan exists for: attribution written under a
	// real token, persisted in real Redis, and read back by a DIFFERENT replica
	// after the one that wrote it is gone. The in-process two-Build test cannot
	// prove this; it shares a process and a store instance.
	ginkgo.It("keeps a session's owner across a replica failover", func() {
		ctx := ginkgoSuiteCtx()
		alice := fx.mint("alice")

		addrA, stopA := portForward(agentPods[0])
		status, sessionID := createSessionAs(ctx, addrA, alice)
		gomega.Expect(status).To(gomega.Equal(http.StatusCreated),
			"creating a session with a genuinely-signed token failed — caller identity is not working in the cluster")
		gomega.Expect(sessionID).NotTo(gomega.BeEmpty())

		gomega.Expect(ownerSubjectFromStore(sessionID)).To(gomega.Equal("alice"),
			"the session did not record its creator as owner in the durable store")
		stopA()

		ginkgo.By("deleting the pod that created the session")
		pre := podNames()
		kubectlDeletePod(agentPods[0], false)
		successor := waitReplacementReady(pre)
		gomega.Expect(successor).NotTo(gomega.Equal(agentPods[0]))

		ginkgo.By("reading the session back from a different replica")
		addrB, stopB := portForward(successor)
		defer stopB()
		// The successor must be able to LOAD the session (proving it is serving it),
		// and the durable row must still name Alice.
		gomega.Eventually(func() int {
			st, _ := createSessionAs(ctx, addrB, alice)
			return st
		}, 90*time.Second, 2*time.Second).Should(gomega.Equal(http.StatusCreated),
			"the successor replica never accepted an authenticated request")
		gomega.Expect(ownerSubjectFromStore(sessionID)).To(gomega.Equal("alice"),
			"the owner did not survive the failover — attribution is lost when the pod that wrote it dies")

		agentPods = podNames()
	})

	// THE USER STORY. Two callers share one deployment, each drives a real
	// authenticated RUN, and the durable record attributes each to the right
	// person. This is the spec that decides whether "multi-user mecatl in k8s"
	// can honestly be documented — the failover spec above proves persistence,
	// but persistence of a session nobody ever ran is not the story.
	ginkgo.It("attributes two callers' authenticated runs to the right owners", func() {
		ctx := ginkgoSuiteCtx()
		addr, stop := portForward(agentPods[0])
		defer stop()

		aliceTok, bobTok := fx.mint("alice"), fx.mint("bob")

		ginkgo.By("alice creates a session and drives a run to terminal")
		st, aliceSess := createSessionAs(ctx, addr, aliceTok)
		gomega.Expect(st).To(gomega.Equal(http.StatusCreated), "alice could not create a session")
		// The RUN is the point: session creation alone never exercises the prompt
		// path through the authenticated edge.
		gomega.Expect(promptAs(ctx, addr, aliceSess, aliceTok, "hello from alice")).
			To(gomega.Equal(http.StatusOK), "alice's authenticated run was refused")

		ginkgo.By("bob creates his own session and drives his own run")
		st, bobSess := createSessionAs(ctx, addr, bobTok)
		gomega.Expect(st).To(gomega.Equal(http.StatusCreated), "bob could not create a session")
		gomega.Expect(promptAs(ctx, addr, bobSess, bobTok, "hello from bob")).
			To(gomega.Equal(http.StatusOK), "bob's authenticated run was refused")

		ginkgo.By("each session names its own creator, and they are not the same")
		gomega.Expect(ownerSubjectFromStore(aliceSess)).To(gomega.Equal("alice"))
		gomega.Expect(ownerSubjectFromStore(bobSess)).To(gomega.Equal("bob"))

		ginkgo.By("bob acts on alice's session: PERMITTED (no isolation in this phase)")
		// Documented behaviour, asserted so nobody mistakes the absence of
		// isolation for a bug — and so the isolation track has a red test to flip.
		gomega.Expect(promptAs(ctx, addr, aliceSess, bobTok, "bob touching alice's session")).
			To(gomega.Equal(http.StatusOK),
				"bob was refused on alice's session — this phase ships NO isolation, so a refusal here is a behaviour change, not a fix")

		ginkgo.By("alice's session still belongs to alice after bob acted on it")
		// The owner is write-once: acting on a session must never re-own it.
		gomega.Expect(ownerSubjectFromStore(aliceSess)).To(gomega.Equal("alice"),
			"bob acting on alice's session changed its owner — ownership laundering")

		ginkgo.By("the durable event log attributes bob's actions to BOB, not to alice")
		// The ship-blocker both reviews found, proven in a cluster: the actor is the
		// caller who acted, and the owner is whose the session is. They differ here.
		gomega.Eventually(func() []string {
			return eventActorsFromStore(aliceSess)
		}, 60*time.Second, 2*time.Second).Should(gomega.ContainElement("bob"),
			"no event on alice's session records bob as the actor, so the audit trail cannot say who did what")
	})
})

// promptAs drives a prompt through the authenticated edge and returns the HTTP
// status, draining the SSE body so the run reaches terminal.
//
// The suite's existing httpPrompt/drainRun send no Authorization header, which is
// right for the unauthenticated base but cannot exercise the path that matters
// here: a RUN under a verified caller.
func promptAs(ctx context.Context, addr, sessionID, bearer, text string) int {
	ginkgo.GinkgoHelper()
	body, _ := json.Marshal(map[string]any{"text": text})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		fmt.Sprintf("http://%s/v1/sessions/%s/prompt", addr, sessionID), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	resp, err := http.DefaultClient.Do(req)
	gomega.ExpectWithOffset(1, err).NotTo(gomega.HaveOccurred(), "POST prompt")
	defer func() { _ = resp.Body.Close() }()
	// Drain so the run completes and its events are appended before we assert.
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<20))
	return resp.StatusCode
}

// eventActorsFromStore returns the Actor subjects recorded on a session's durable
// event log, read straight out of Redis.
//
// Event.Actor is LOG-ONLY: toProto omits it, so it never reaches a client and
// cannot be observed through the API at all. The durable log is the only place it
// exists, which makes reading the store the only honest way to assert it.
func eventActorsFromStore(sessionID string) []string {
	ginkgo.GinkgoHelper()
	raw := runCmdQuiet("kubectl", "exec", "-n", k8sNamespace, "redis-0", "--",
		"redis-cli", "--no-raw", "LRANGE", "mecatl:events:"+sessionID, "0", "-1")
	var subs []string
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if u, err := strconv.Unquote(line); err == nil {
			line = u
		}
		var ev struct {
			Actor *struct {
				Subject string `json:"subject"`
			} `json:"actor"`
		}
		if json.Unmarshal([]byte(line), &ev) != nil || ev.Actor == nil {
			continue
		}
		subs = append(subs, ev.Actor.Subject)
	}
	return subs
}
