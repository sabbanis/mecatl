export interface Artifact {
  name: string;
  type: "spreadsheet" | "document" | "code";
  createdAt?: string;
}

export interface SystemTask {
  label: string;
  status: "completed" | "running" | "pending";
}

export interface McpServerAccess {
  name: string;
  server: string;
  action: string;
}

export interface BotIdentity {
  name: string;
  color: string;
}

export const BOTS = {
  analyst: { name: "Analyst", color: "bg-[#398560]" },
  salesCopilot: { name: "Sales Copilot", color: "bg-indigo-600" },
  docBot: { name: "DocBot", color: "bg-amber-600" },
  securityBot: { name: "SecurityBot", color: "bg-rose-600" },
  infraBot: { name: "InfraBot", color: "bg-cyan-600" },
  researchBot: { name: "ResearchBot", color: "bg-violet-600" },
  planningBot: { name: "Planning Bot", color: "bg-teal-600" },
  hrBot: { name: "HR Assistant", color: "bg-pink-600" },
  contentBot: { name: "ContentBot", color: "bg-orange-600" },
  eventBot: { name: "EventBot", color: "bg-sky-600" },
} as const;

export interface PermissionRequest {
  service: string;
  access: string;
  action: string;
  granted: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  artifact?: Artifact;
  tasks?: SystemTask[];
  mcpServers?: McpServerAccess[];
  bot?: BotIdentity;
  actions?: string[];
  permissionRequests?: PermissionRequest[];
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  unread: boolean;
  messages: ChatMessage[];
  cost?: string;
}

export interface ProjectMemory {
  id: string;
  content: string;
  source: string;
  updatedAt: string;
}

export interface ProjectAction {
  id: string;
  description: string;
  actor: string;
  timestamp: string;
}

export interface ProjectSuggestion {
  id: string;
  label: string;
  description: string;
}

export interface ProjectFolder {
  id: string;
  name: string;
  sessions: ChatSession[];
  outputFiles?: Artifact[];
  summary?: string;
  status?: string;
  memories?: ProjectMemory[];
  recentActions?: ProjectAction[];
  suggestions?: ProjectSuggestion[];
}

export interface TeamGroup {
  team: string;
  projects: ProjectFolder[];
}

export const MOCK_PRIVATE_CHATS: ChatSession[] = [
  {
    id: "priv-1",
    title: "Weekly planning notes",
    updatedAt: "2h",
    unread: true,
    cost: "$0.12",
    messages: [
      {
        id: "pm1",
        role: "user",
        content: "Help me plan my priorities for this week.",
      },
      {
        id: "pm2",
        role: "assistant",
        bot: BOTS.planningBot,
        content:
          "Looking at your calendar and open tasks, top priorities this week: finalize Q3 roadmap (due Wed), review 3 open PRs blocking the release, prep for Thursday's board meeting (deck needs 2 more slides), and 1:1s with Sarah and Mike Tuesday afternoon.\n\nWant me to block focus time on your calendar for the roadmap work?",
        mcpServers: [
          {
            name: "Google Calendar",
            server: "gcal-mcp",
            action: "Read calendar events and availability",
          },
          {
            name: "Slack",
            server: "slack-mcp",
            action: "Read task mentions and reminders",
          },
        ],
        actions: ["Block focus time", "Review open PRs", "Prep board deck"],
      },
      {
        id: "pm2b",
        role: "user",
        content:
          "Yes, block 2 hours tomorrow morning for the roadmap. Also, which PRs are blocking the release?",
      },
      {
        id: "pm2c",
        role: "assistant",
        bot: BOTS.planningBot,
        content:
          "Done, blocked 9-11am Tuesday for roadmap work. The 3 blocking PRs: #482 agent health check refactor (Marcus, passing CI, needs your architecture sign-off), #479 fix rate limiter race condition (Priya, 2 approvals, needs a third from platform team), and #475 update MCP SDK to v2.4 (Alex, has merge conflicts with #482, needs rebase first).\n\nI'd suggest reviewing #479 first since it's closest to merge, then #482 since Alex needs it resolved before rebasing #475. Want me to leave comments on any of these?",
        mcpServers: [
          {
            name: "Google Drive",
            server: "gdrive-mcp",
            action: "Read shared documents",
          },
          {
            name: "Slack",
            server: "slack-mcp",
            action: "Read PR review threads",
          },
        ],
        actions: ["Comment on PRs", "Set review reminders", "Share with team"],
      },
      {
        id: "pm2d",
        role: "user",
        content:
          "Leave a comment on #475 asking Alex to rebase. Also add the PR reviews to my calendar for Tuesday afternoon.",
      },
      {
        id: "pm2e",
        role: "assistant",
        bot: BOTS.planningBot,
        content:
          "To do this I'll need write access to GitHub and Google Calendar:",
        permissionRequests: [
          {
            service: "GitHub",
            access: "Write",
            action: "Post a comment on PR #475 in stacklok/enterprise-platform",
            granted: false,
          },
          {
            service: "Google Calendar",
            access: "Write",
            action:
              "Create calendar events on Tuesday afternoon for PR reviews",
            granted: false,
          },
        ],
      },
    ],
  },
  {
    id: "priv-2",
    title: "Travel expense report",
    updatedAt: "5h",
    unread: false,
    cost: "$1.42",
    messages: [
      {
        id: "pm3",
        role: "user",
        content:
          "I need to file my expenses from the NYC trip last week. Can you pull my receipts and categorize them?",
      },
      {
        id: "pm4",
        role: "assistant",
        bot: BOTS.analyst,
        content:
          "Here are your NYC trip expenses: Flights $487 (round trip SFO-JFK), Hotel $892 (3 nights at The Standard), Meals $234 (6 receipts), Transport $127 (4 Uber rides). Total $1,740, all within policy limits.\n\nWant me to submit this to Concur?",
        mcpServers: [
          {
            name: "Google Drive",
            server: "gdrive-mcp",
            action: "Read uploaded receipt files",
          },
        ],
        actions: ["Submit to Concur", "Export to CSV", "Flag discrepancies"],
      },
      {
        id: "pm4b",
        role: "user",
        content:
          "One of the meal receipts is a team dinner — that should be under client entertainment, not meals. The one from Nobu on Thursday.",
      },
      {
        id: "pm4c",
        role: "assistant",
        bot: BOTS.analyst,
        content:
          "Updated. Moved the Nobu dinner ($142) from Meals to Client Entertainment. New breakdown: Flights $487, Hotel $892, Meals $92 (5 receipts), Transport $127, Client Entertainment $142 (Nobu, 4 attendees). Total still $1,740.\n\nClient entertainment requires attendee names for the audit trail. I see you, Sarah, and two Acme Corp contacts on the calendar invite. Want me to auto-fill those?",
      },
      {
        id: "pm4d",
        role: "user",
        content: "Yes, use the names from the calendar invite. Then submit it.",
      },
      {
        id: "pm4e",
        role: "assistant",
        bot: BOTS.analyst,
        content:
          "Submitted to Concur with attendees listed: you, Sarah Kim, David Chen (Acme Corp), and Lisa Park (Acme Corp).\n\nGoes to your manager first, then finance — expect reimbursement in 5-7 business days.\n\nI noticed you have a SF trip next week. Want me to set up a pre-populated expense template for that one?",
        mcpServers: [
          {
            name: "Google Calendar",
            server: "gcal-mcp",
            action: "Read calendar invite attendees",
          },
        ],
      },
    ],
  },
  {
    id: "priv-3",
    title: "Reading list summary",
    updatedAt: "1d",
    unread: false,
    cost: "$0.53",
    messages: [
      {
        id: "pm5",
        role: "user",
        content: "Summarize the articles I saved this week.",
      },
      {
        id: "pm6",
        role: "assistant",
        bot: BOTS.analyst,
        content:
          'You saved 4 articles this week. "The End of SaaS as We Know It" argues AI agents will replace most SaaS dashboards (key insight: users want outcomes, not interfaces). "Scaling Postgres to 10M rows/sec" is a deep dive on partitioning strategies, relevant to the data pipeline work. "Why Most AI Products Fail" says 70% of AI features get abandoned within 3 months, fix being start with the workflow not the model. And "Remote Team Rituals That Work" covers async standups + weekly demo days, could be useful for the distributed team.',
        mcpServers: [
          {
            name: "Google Drive",
            server: "gdrive-mcp",
            action: "Read saved reading list items",
          },
        ],
        actions: ["Share with team", "Save summary", "Dig deeper"],
      },
      {
        id: "pm6b",
        role: "user",
        content:
          "The SaaS article and the AI Products one feel related. Can you write me a 2-paragraph synthesis connecting the two?",
      },
      {
        id: "pm6c",
        role: "assistant",
        bot: BOTS.analyst,
        content:
          "The core tension between these pieces is about where value lives. The SaaS article argues dashboards are becoming commodities — what matters is whether software can act on your behalf. The AI Products piece explains why most attempts at that agency fail: teams bolt AI onto existing interfaces instead of redesigning the workflow. Combined insight: the winners won't be \"SaaS + AI chatbot\" — they'll be agents that own the outcome end-to-end.\n\nThis maps directly to our strategy. Our marketplace isn't a dashboard with an agent tab — agents are the product. The 70% failure rate mostly affects companies that treated AI as a feature toggle. Starting agent-native puts us on the right side of that stat. Worth referencing both in the board deck under product strategy.",
        actions: ["Save to board prep", "Refine tone", "Share with team"],
      },
      {
        id: "pm6d",
        role: "user",
        content:
          "Great connection. Save that synthesis — I want to use it in the board prep.",
      },
      {
        id: "pm6e",
        role: "assistant",
        bot: BOTS.analyst,
        content:
          "Saved to your board prep folder as \"AI Strategy Synthesis — SaaS + Agent Thesis,\" tagged with the board meeting date so it surfaces when you're working on the deck.\n\nThe Postgres scaling article might be worth flagging for Mike on the platform team — the partitioning strategies are similar to what we'll need for the usage metering pipeline. Want me to share it with him?",
      },
    ],
  },
  {
    id: "priv-4",
    title: "Meeting prep — board deck",
    updatedAt: "2d",
    unread: false,
    cost: "$0.47",
    messages: [
      {
        id: "pm7",
        role: "user",
        content:
          "I need to add 2 slides to the board deck: one on ARR growth and one on the product roadmap.",
      },
      {
        id: "pm8",
        role: "assistant",
        bot: BOTS.analyst,
        content:
          "Two slides ready.\n\nSlide 1 — ARR Growth: current ARR $12.4M (up 34% YoY), net revenue retention 118%, 23 new logos this quarter, expansion revenue $1.8M (up from $1.2M).\n\nSlide 2 — Product Roadmap H2 2026: Q3 is agent marketplace launch and SOC 2 Type II, Q4 is enterprise SSO, multi-region deployment, and Salesforce integration, with on-prem for regulated industries as a stretch goal.\n\nFormatted in your deck template. Want me to add speaker notes?",
        mcpServers: [
          {
            name: "Google Drive",
            server: "gdrive-mcp",
            action: "Read deck template and revenue data",
          },
          {
            name: "Slack",
            server: "slack-mcp",
            action: "Read roadmap discussion threads",
          },
        ],
        actions: ["Add speaker notes", "Edit slides", "Share deck"],
      },
      {
        id: "pm8b",
        role: "user",
        content:
          "Yes, add speaker notes. Also — the board will ask about the on-prem stretch goal. How should I frame it?",
      },
      {
        id: "pm8c",
        role: "assistant",
        bot: BOTS.planningBot,
        content:
          "Speaker notes added. For the on-prem framing, I'd recommend positioning it as: \"On-prem is a stretch goal, not a commitment. Three regulated-industry prospects (healthcare, defense, financial services) have flagged it as a requirement. We're scoping a hybrid model — customer-hosted agent runtime with cloud-managed control plane. Go/no-go decision by end of Q3 based on pipeline demand.\"\n\nIf pressed, key data: 3 prospects with combined $2.1M potential ARR have requested it, estimated cost is 2 engineers for 3 months, and the hybrid model reduces scope by ~60% vs full on-prem. This frames it as customer-driven and de-risks by not committing until demand is clear.\n\nWant me to add a backup slide with the technical architecture?",
      },
      {
        id: "pm8d",
        role: "user",
        content:
          "Add the backup slide. Keep it simple — one architecture diagram with 3-4 bullet points.",
      },
      {
        id: "pm8e",
        role: "assistant",
        bot: BOTS.analyst,
        content:
          "Added Slide 3 (backup) — Hybrid Deployment Architecture:\n\n```\n[Customer VPC]          [Our Cloud]\n┌─────────────┐    ┌──────────────────┐\n│ Agent Runtime│◄──►│ Control Plane    │\n│ MCP Servers  │    │ Config & Updates │\n│ Data (local) │    │ Monitoring       │\n└─────────────┘    │ Billing          │\n                    └──────────────────┘\n```\n\nAgent runtime and data stay in the customer's VPC (meets data residency), control plane remains cloud-hosted (we manage updates, monitoring, billing), secure WireGuard tunnel for control traffic (no inbound ports), and same developer experience regardless of hosting model.\n\nDeck is ready — 2 main slides + 1 backup. Want me to do a final formatting pass?",
      },
    ],
  },
  {
    id: "priv-5",
    title: "Vendor evaluation matrix",
    updatedAt: "4d",
    unread: false,
    cost: "$0.47",
    messages: [
      {
        id: "pm9",
        role: "user",
        content:
          "We're evaluating 3 observability vendors — Datadog, Grafana Cloud, and New Relic. Can you build a comparison matrix?",
      },
      {
        id: "pm10",
        role: "assistant",
        bot: BOTS.analyst,
        content:
          "Quick comparison at 100 hosts: Datadog ~$23/host/mo with excellent APM and dashboards, Grafana Cloud ~$15/host/mo with best-in-class dashboards and strong Loki-based log management, New Relic has a free tier + $0.30/GB with excellent APM but basic alert routing. All three have native K8s monitoring.\n\nRecommendation: Grafana Cloud for cost efficiency with strong K8s support. Datadog if budget allows — their APM is hard to beat. Want me to schedule vendor demos?",
        mcpServers: [
          {
            name: "Google Drive",
            server: "gdrive-mcp",
            action: "Read vendor pricing documentation",
          },
        ],
        actions: ["Schedule vendor demos", "Export to CSV", "Share with team"],
      },
      {
        id: "pm10b",
        role: "user",
        content:
          "We're leaning toward Grafana Cloud. What would the total cost look like for our setup? We have ~80 hosts and need log management too.",
      },
      {
        id: "pm10c",
        role: "assistant",
        bot: BOTS.analyst,
        content:
          "Grafana Cloud estimate for your setup: Metrics (Prometheus, 80 hosts, ~50K active series) $594/mo, Logs (Loki, ~200GB/mo) $600/mo, Traces (Tempo, ~5GB/mo) $75/mo, Alerting (OnCall, 8 users) $128/mo. Total ~$1,400/mo. Compare to Datadog for the same setup at ~$2,800/mo — that's 50% savings.\n\nOne caveat: Grafana's managed Loki is good but less feature-rich than Datadog's log analytics. If the team relies heavily on log-based dashboards and anomaly detection, Datadog is meaningfully better there. For basic search and alerting, Loki is fine.\n\nWant me to set up a 14-day trial with our actual metrics?",
        mcpServers: [
          {
            name: "Slack",
            server: "slack-mcp",
            action: "Read infrastructure cost discussions",
          },
        ],
        actions: ["Start free trial", "Compare to Datadog", "Share with team"],
      },
      {
        id: "pm10d",
        role: "user",
        content:
          "Yes, let's do the trial. Can you also check if they have an enterprise discount for annual commit?",
      },
      {
        id: "pm10e",
        role: "assistant",
        bot: BOTS.analyst,
        content:
          "Trial activated — I've configured a Grafana Cloud stack and set up the Prometheus remote-write endpoint. Your metrics should start flowing within 10 minutes.\n\nOn enterprise pricing: Grafana Labs offers 15-20% off for annual commits on their Enterprise tier. For our usage level, that would bring the estimate down to ~$1,120-$1,190/mo. The Enterprise tier also includes 24/7 support with 1-hour SLA, SSO/SAML integration, audit logging, and custom retention policies\n\nI've reached out to their sales team and requested a formal quote. They typically respond within 24 hours. I'll loop you in when it arrives.",
        mcpServers: [
          {
            name: "Google Drive",
            server: "gdrive-mcp",
            action: "Read vendor pricing documents",
          },
        ],
      },
    ],
  },
  {
    id: "priv-6",
    title: "Onboarding checklist — new hires",
    updatedAt: "1w",
    unread: false,
    cost: "$0.18",
    messages: [
      {
        id: "pm11",
        role: "user",
        content:
          "We have 2 engineers starting next Monday. Can you draft an onboarding checklist for the first 2 weeks?",
      },
      {
        id: "pm12",
        role: "assistant",
        bot: BOTS.planningBot,
        content:
          "Here's the onboarding plan.\n\nWeek 1 (Setup & Context): Day 1 is laptop setup, access provisioning, and team intro. Day 2 is architecture walkthrough and dev environment setup. Day 3 is a codebase tour starting with the API layer. Day 4, first good-first-issue PR. Day 5, 1:1 with manager plus team retro.\n\nWeek 2 (First Contribution): pair on a real feature ticket, shadow an on-call shift, review 2 PRs from the team, write a short RFC or design doc, and end-of-week demo of their work.\n\nShared with the team leads. Want me to pre-assign their first issues?",
        actions: [
          "Assign first issues",
          "Create Slack channel",
          "Set reminders",
        ],
      },
      {
        id: "pm12b",
        role: "user",
        content:
          "Yes, assign them first issues. One is a backend engineer (Go), the other is full-stack (React + Node).",
      },
      {
        id: "pm12c",
        role: "assistant",
        bot: BOTS.analyst,
        content:
          'Assigned:\n\nBackend engineer — Go:\n- Issue #341: "Add health check endpoint to agent-controller" — straightforward endpoint addition, covers routing, middleware, and testing patterns in the codebase. ~2 hours.\n\nFull-stack — React + Node:\n- Issue #338: "Add loading skeleton to server list page" — touches the React component layer and API integration. Introduces them to our shadcn/ui patterns. ~3 hours.\n\nBoth issues have clear acceptance criteria and a linked PR from a similar past task for reference. I\'ve also added "buddy assignments" — Sarah is paired with the backend engineer, Alex with the full-stack hire.\n\nOne thing to flag: we don\'t have dev environment setup docs for Apple Silicon Macs. Last hire lost half a day on Docker compatibility issues. Want me to create a setup script that handles the M-series edge cases?',
        mcpServers: [
          {
            name: "Google Drive",
            server: "gdrive-mcp",
            action: "Read onboarding documentation",
          },
          {
            name: "Slack",
            server: "slack-mcp",
            action: "Read team buddy assignments",
          },
        ],
        actions: [
          "Create setup script",
          "Send to hiring manager",
          "Update scorecard",
        ],
      },
      {
        id: "pm12d",
        role: "user",
        content:
          "Yes, that setup script would save a lot of time. Also add it to the onboarding doc.",
      },
      {
        id: "pm12e",
        role: "assistant",
        bot: BOTS.analyst,
        content:
          "Created `scripts/dev-setup.sh` — handles Homebrew install, Go 1.22, Node 20, pnpm, Docker Desktop ARM64 with Rosetta, cloning repos, installing deps, seeding local DB, and starting OIDC mock + dev server in one command\n\nTotal setup time: ~15 minutes (down from the typical 3-4 hours of troubleshooting).\n\nI've added it to the onboarding doc under \"Day 1: Dev Environment Setup\" with a one-liner: `curl -sSf https://internal.company.dev/setup.sh | bash`. Also included a troubleshooting FAQ for the 5 most common issues we've seen.\n\nEverything's ready for Monday. Want me to send a welcome Slack message to both new hires on Friday?",
      },
    ],
  },
  {
    id: "priv-7",
    title: "Quarterly OKR draft",
    updatedAt: "2w",
    unread: false,
    cost: "$0.12",
    messages: [
      {
        id: "pm13",
        role: "user",
        content: "Help me draft team OKRs for Q3.",
      },
      {
        id: "pm14",
        role: "assistant",
        bot: BOTS.planningBot,
        content:
          "Draft based on the roadmap:\n\nO1 — Ship the agent marketplace: launch beta with 10 partner agents by July 15, 500 WAU within 30 days, NPS > 40 from beta users.\n\nO2 — Improve platform reliability: reduce P50 API latency from 120ms to 80ms, achieve 99.95% uptime (up from 99.9%), zero SEV-1 incidents.\n\nO3 — Scale the engineering team: hire 2 senior engineers by end of June, team velocity up 20% (story points), PR review turnaround < 4 hours.\n\nThese align with the board's H2 priorities. Want to adjust any of them?",
        actions: [
          "Adjust targets",
          "Create tracking dashboard",
          "Share with leads",
        ],
      },
      {
        id: "pm14b",
        role: "user",
        content:
          "O2 KR3 'zero SEV-1 incidents' feels unrealistic. Can we reframe it? Also, should we add a customer-facing OKR?",
      },
      {
        id: "pm14c",
        role: "assistant",
        bot: BOTS.planningBot,
        content:
          "You're right — zero SEV-1s is aspirational but sets the team up to fail if one bad deploy slips through. Here's a reframe:\n\nReframed O2 KR3: MTTR for SEV-1 incidents < 30 minutes (currently 52 min avg). This rewards fast recovery instead of punishing any incident.\n\nAlso added O4 — Delight enterprise customers: onboarding time from sign-up to first agent < 1 day (currently 2.3 weeks), support ticket resolution < 4 hours (currently 18 hours), and 3 customer case studies published. This connects reliability to revenue — faster onboarding directly impacts the sales pipeline. The case studies also give marketing content for the AI agents article series.\n\nUpdated the OKR doc. Want me to create a tracking dashboard for these?",
        mcpServers: [
          {
            name: "Google Drive",
            server: "gdrive-mcp",
            action: "Read incident MTTR and onboarding metrics",
          },
        ],
        actions: [
          "Create tracking dashboard",
          "Set up alerts",
          "Share with team",
        ],
      },
      {
        id: "pm14d",
        role: "user",
        content:
          "Perfect. Create the tracking dashboard and share it with the leads before Friday's planning meeting.",
      },
      {
        id: "pm14e",
        role: "assistant",
        bot: BOTS.analyst,
        content:
          "Dashboard created with 4 sections: O1 Marketplace (partner agent count, WAU trend, NPS — weekly), O2 Reliability (P50 latency, uptime %, MTTR — real-time), O3 Team (headcount, velocity trend, PR review p50 — per sprint), O4 Customer (onboarding funnel, support SLA %, case study pipeline — weekly).\n\nEach KR has green/yellow/red status based on pace toward target. Red triggers a discussion in the weekly leads sync.\n\nShared with Sarah, Mike, Alex, and Priya with edit access. I've also added a recurring Monday 9am Slack reminder to #leadership with the dashboard link and a summary of any KRs that changed status. Ready for Friday's meeting.",
        mcpServers: [
          {
            name: "Slack",
            server: "slack-mcp",
            action: "Read leadership channel for KR updates",
          },
        ],
      },
    ],
  },
];

export const MOCK_TEAMS: TeamGroup[] = [
  {
    team: "Marketing",
    projects: [
      {
        id: "f-1",
        name: "Glass Documentation",
        summary:
          "Maintaining API reference docs, migration guides, and SDK changelogs for the Glass platform. Doc coverage is at 78% — targeting 90% by end of Q3. Recently completed the v2.4 API reference rewrite and migration guide for breaking changes.",
        suggestions: [
          {
            id: "gs-1",
            label: "Generate missing endpoint docs",
            description:
              "Fill in documentation gaps identified in the coverage report.",
          },
          {
            id: "gs-2",
            label: "Draft v2.5 changelog from recent PRs",
            description:
              "Compile changelog entries from merged pull requests since the last release.",
          },
          {
            id: "gs-3",
            label: "Review migration guide for accuracy",
            description:
              "Cross-check the migration guide against the latest API changes.",
          },
          {
            id: "gs-4",
            label: "Create SDK quickstart tutorial",
            description: "Write a step-by-step tutorial for new SDK users.",
          },
        ],
        outputFiles: [
          { name: "API Reference v2.4.md", type: "document", createdAt: "2d" },
          { name: "Migration Guide.md", type: "document", createdAt: "3d" },
          { name: "SDK Changelog.md", type: "document", createdAt: "5d" },
          {
            name: "Doc Coverage Report.csv",
            type: "spreadsheet",
            createdAt: "1w",
          },
        ],
        sessions: [
          {
            id: "s-1",
            title: "Scheduled doc maintenance",
            updatedAt: "22h",
            unread: true,
            cost: "$2.67",
            messages: [
              {
                id: "m1",
                role: "user",
                content:
                  "Can you set up a scheduled task to review and update the Glass documentation weekly? It should check the Notion sync pipeline and flag any stale API references.",
              },
              {
                id: "m2",
                role: "assistant",
                bot: BOTS.docBot,
                content:
                  "Created a scheduled maintenance task for the Glass docs. It covers API reference updates (checks for new/modified endpoints against the OpenAPI spec), changelog entries (pulls recent merge commits and drafts changelog lines), and migration guide revisions (flags breaking changes needing migration notes).\n\nRuns every Monday at 9am UTC and post a summary to #glass-docs in Slack. Want me to adjust the schedule or add any other checks?",
                mcpServers: [
                  {
                    name: "GitHub",
                    server: "github-mcp",
                    action: "Read repository OpenAPI spec and merge commits",
                  },
                  {
                    name: "Notion",
                    server: "notion-mcp",
                    action: "Read documentation sync pipeline",
                  },
                ],
                actions: [
                  "Adjust schedule",
                  "Add more checks",
                  "Share with team",
                ],
              },
              {
                id: "m3",
                role: "user",
                content:
                  "That looks good. Can you also include a check for deprecated endpoints?",
              },
              {
                id: "m4",
                role: "assistant",
                bot: BOTS.docBot,
                content:
                  "Done. I've added a deprecation scanner that cross-references the current API spec against the previous version. Any endpoint marked as deprecated will be highlighted in the weekly report with a suggested removal timeline.\n\nThe updated task config has been saved to `glass-doc-maintenance.md`.",
                mcpServers: [
                  {
                    name: "GitHub",
                    server: "github-mcp",
                    action: "Read versioned API spec for deprecation tracking",
                  },
                ],
              },
            ],
          },
          {
            id: "s-2",
            title: "API reference v2.4 rewrite",
            updatedAt: "2d",
            unread: false,
            cost: "$0.08",
            messages: [
              {
                id: "m1",
                role: "user",
                content:
                  "The v2.4 API reference needs a full rewrite. Can you audit what's changed since v2.3?",
              },
              {
                id: "m2",
                role: "assistant",
                bot: BOTS.docBot,
                content:
                  "Compared the v2.3 and v2.4 OpenAPI specs. 4 new endpoints: `POST /v2/agents` (create agent instance), `GET /v2/agents/{id}/status` (health check), `PUT /v2/agents/{id}/config` (update config), and `DELETE /v2/agents/{id}` (terminate agent). 2 modified: `POST /v2/auth/token` has a new `scope` parameter, and `GET /v2/servers` response now includes a `health` field. 1 deprecated: `GET /v1/status`, replaced by `/v2/agents/{id}/status`\n\nWant me to draft the new reference pages?",
                mcpServers: [
                  {
                    name: "GitHub",
                    server: "github-mcp",
                    action: "Read OpenAPI spec diffs between v2.3 and v2.4",
                  },
                ],
                actions: [
                  "Draft new reference pages",
                  "Share with team",
                  "Export changelog",
                ],
              },
              {
                id: "m3",
                role: "user",
                content:
                  "Yes, start with the agent endpoints. Those are the most requested by developers.",
              },
              {
                id: "m4",
                role: "assistant",
                bot: BOTS.docBot,
                content:
                  'Draft for the 4 new agent endpoints. Starting with POST /v2/agents (creates a new agent instance):\n\n```json\n// Request\n{\n  "name": "support-agent",\n  "model": "claude-sonnet-4-5",\n  "tools": ["web-search", "code-exec"],\n  "system_prompt": "You are a support agent..."\n}\n\n// Response (201 Created)\n{\n  "id": "agent_01H8X3...",\n  "name": "support-agent",\n  "status": "provisioning",\n  "created_at": "2026-04-28T14:30:00Z"\n}\n```\n\nFollowed the same format as the v2.3 reference — request/response examples, parameter descriptions, error codes, and rate limits for each endpoint. The `DELETE` endpoint includes a note about graceful shutdown behavior.\n\nShould I also update the SDK code samples, or keep the reference doc standalone?',
              },
              {
                id: "m5",
                role: "user",
                content:
                  "Update the SDK samples too. Python and TypeScript are the priority.",
              },
              {
                id: "m6",
                role: "assistant",
                bot: BOTS.analyst,
                content:
                  "Updated both SDK docs with agent management examples:\n\nPython:\n```python\nagent = client.agents.create(\n    name=\"support-agent\",\n    model=\"claude-sonnet-4-5\",\n    tools=[\"web-search\"]\n)\nagent.update_config(max_tokens=4096)\nagent.terminate()  # graceful shutdown\n```\n\nTypeScript:\n```typescript\nconst agent = await client.agents.create({\n  name: 'support-agent',\n  model: 'claude-sonnet-4-5',\n  tools: ['web-search']\n});\nawait agent.updateConfig({ maxTokens: 4096 });\nawait agent.terminate();\n```\n\nBoth include error handling examples and link back to the full API reference. Also added a migration note for users coming from the v1 status endpoint. Ready for review.",
                mcpServers: [
                  {
                    name: "GitHub",
                    server: "github-mcp",
                    action: "Read SDK repository code samples",
                  },
                  {
                    name: "Notion",
                    server: "notion-mcp",
                    action: "Read API reference documentation",
                  },
                ],
              },
            ],
          },
          {
            id: "s-31",
            title: "SDK quickstart guide",
            updatedAt: "4d",
            unread: false,
            cost: "$3.41",
            messages: [
              {
                id: "m1",
                role: "user",
                content:
                  "Write a quickstart guide for the Python SDK. Should get someone from zero to a working API call in under 5 minutes.",
              },
              {
                id: "m2",
                role: "assistant",
                bot: BOTS.docBot,
                content:
                  'Here\'s the quickstart — install, authenticate, create an agent, send a message:\n\n```bash\npip install glass-sdk\n```\n\n```python\nfrom glass import Client\nclient = Client(api_key="your-key")\n```\n\n```python\nagent = client.agents.create(\n    name="my-agent",\n    model="claude-sonnet-4-5",\n    tools=["web-search", "code-exec"]\n)\nprint(agent.id)\n```\n\n```python\nresponse = agent.chat("Summarize the latest sales report")\nprint(response.content)\n```\n\nTotal: 8 lines of code. I\'ve added error handling examples and rate limit notes in the full doc.',
                mcpServers: [
                  {
                    name: "GitHub",
                    server: "github-mcp",
                    action: "Read SDK repository and package registry",
                  },
                ],
                actions: [
                  "Request review",
                  "Publish draft",
                  "Save as template",
                ],
              },
              {
                id: "m3",
                role: "user",
                content:
                  "Add a section on error handling and retries. New users always get tripped up by rate limits.",
              },
              {
                id: "m4",
                role: "assistant",
                bot: BOTS.docBot,
                content:
                  'Added an error handling and retries section:\n\n```python\nfrom glass import Client, RateLimitError, ServerError\nimport time\n\nclient = Client(api_key="your-key")\n\ndef chat_with_retry(agent, message, max_retries=3):\n    for attempt in range(max_retries):\n        try:\n            return agent.chat(message)\n        except RateLimitError as e:\n            wait = e.retry_after or (2 ** attempt)\n            time.sleep(wait)\n        except ServerError:\n            if attempt == max_retries - 1:\n                raise\n            time.sleep(2 ** attempt)\n```\n\nRate limits by tier: Free 10 req/min, Business 100 req/min, Enterprise 1,000 req/min. The SDK also supports automatic retries with `auto_retry=True` on the client constructor. Guide saved.',
                artifact: {
                  name: "SDK Quickstart Guide.doc",
                  type: "document",
                },
                mcpServers: [
                  {
                    name: "GitHub",
                    server: "github-mcp",
                    action: "Read SDK rate limit configuration",
                  },
                ],
                actions: [
                  "Publish draft",
                  "Share with team",
                  "Add to docs site",
                ],
              },
            ],
          },
          {
            id: "s-32",
            title: "Doc coverage audit",
            updatedAt: "1w",
            unread: false,
            cost: "$1.23",
            messages: [
              {
                id: "m1",
                role: "user",
                content:
                  "Run a coverage audit — which API endpoints are missing documentation?",
              },
              {
                id: "m2",
                role: "assistant",
                bot: BOTS.docBot,
                content:
                  "Cross-referenced the OpenAPI spec against published docs: 34 of 41 endpoints documented (83%). The 7 missing are `POST /v2/agents/{id}/clone` (no page), `GET /v2/agents/{id}/logs` (referenced but unwritten), `PUT /v2/teams/{id}/permissions` (new in v2.4), `GET /v2/billing/usage` (stub only), `POST /v2/webhooks` (no examples), `DELETE /v2/webhooks/{id}` (not mentioned), and `GET /v2/audit-log` (enterprise-only, undocumented).\n\nI'd prioritize webhooks and permissions — those are the most-requested in support tickets.",
                artifact: {
                  name: "Doc Coverage Report.csv",
                  type: "spreadsheet",
                },
                mcpServers: [
                  {
                    name: "GitHub",
                    server: "github-mcp",
                    action: "Read OpenAPI spec endpoints",
                  },
                  {
                    name: "Notion",
                    server: "notion-mcp",
                    action: "Read published documentation pages",
                  },
                ],
              },
              {
                id: "m3",
                role: "user",
                content:
                  "Start with the webhooks docs. Support gets 2-3 tickets a week about this.",
              },
              {
                id: "m4",
                role: "assistant",
                bot: BOTS.docBot,
                content:
                  'Drafted the webhooks docs. POST /v2/webhooks subscribes to events (`agent.created`, `agent.failed`, `server.health_changed`, `deployment.completed`) with HMAC-SHA256 signature verification and 3-attempt exponential backoff retries. DELETE /v2/webhooks/{id} returns 204 on success, 404 if not found, and cancels pending deliveries.\n\nAlso added a "Getting Started with Webhooks" guide covering creation, signature verification, and retry handling — should address the most common support questions.\n\nCoverage is now 36 of 41 endpoints (88%). Five more to go. Want me to continue with permissions next?',
              },
              {
                id: "m5",
                role: "user",
                content:
                  "Yes, and also knock out the billing/usage endpoint since enterprise prospects keep asking about it.",
              },
              {
                id: "m6",
                role: "assistant",
                bot: BOTS.analyst,
                content:
                  "Both done. PUT /v2/teams/{id}/permissions is documented with role-based examples (admin, member, viewer) and a permissions matrix. GET /v2/billing/usage covers query parameters for date range and granularity (hourly/daily/monthly), per-agent and per-team breakdowns, a usage-with-cost-estimates example, and a note about the 15-minute data lag for real-time queries.\n\nCoverage is now 38 of 41 endpoints (93%), above the 90% target. Remaining 3 are `clone`, `logs`, and `audit-log`. I'd recommend documenting audit-log in a separate enterprise docs section since it's enterprise-only. Updated the coverage report spreadsheet.",
                artifact: {
                  name: "Doc Coverage Report.csv",
                  type: "spreadsheet",
                },
                mcpServers: [
                  {
                    name: "GitHub",
                    server: "github-mcp",
                    action: "Read billing and permissions API specs",
                  },
                ],
                actions: [
                  "Draft remaining three",
                  "Publish updates",
                  "Share coverage report",
                ],
              },
            ],
          },
        ],
      },
      {
        id: "f-2",
        name: "Content Strategy",
        summary:
          "Managing the Q3 content calendar across blog, social, and developer relations. AI Agents deep-dive article is in final review. Organic traffic up 18% MoM from SEO keyword targeting. Planning a 4-part technical blog series on agentic workflows.",
        suggestions: [
          {
            id: "cs-1",
            label: "Finalize the AI Agents article",
            description:
              "The draft is complete — needs a final editing pass and CTA.",
          },
          {
            id: "cs-2",
            label: "Plan the agentic workflows blog series",
            description:
              "Outline the 4-part series with topics, authors, and target dates.",
          },
          {
            id: "cs-3",
            label: "Analyze top-performing content from Q2",
            description:
              "Review traffic and engagement data to inform Q3 strategy.",
          },
          {
            id: "cs-4",
            label: "Update social media templates for Q3",
            description: "Refresh templates to match the new brand guidelines.",
          },
        ],
        outputFiles: [
          {
            name: "AI Agents Article Draft.md",
            type: "document",
            createdAt: "4h",
          },
          {
            name: "Blog Calendar Q3.csv",
            type: "spreadsheet",
            createdAt: "1d",
          },
          {
            name: "Content Performance.csv",
            type: "spreadsheet",
            createdAt: "3d",
          },
          {
            name: "SEO Keyword Research.csv",
            type: "spreadsheet",
            createdAt: "5d",
          },
          {
            name: "Social Media Templates.doc",
            type: "document",
            createdAt: "1w",
          },
        ],
        sessions: [
          {
            id: "s-3",
            title: "AI agents article series",
            updatedAt: "22h",
            unread: true,
            cost: "$0.05",
            messages: [
              {
                id: "m1",
                role: "user",
                content:
                  "I'm working on a new article about how AI agents are reshaping software strategy. Can you help me outline the key arguments?",
              },
              {
                id: "m2",
                role: "assistant",
                bot: BOTS.contentBot,
                content:
                  "Structured outline based on your previous essays. Core thesis: AI agents don't just automate tasks — they collapse the distance between intent and execution, fundamentally changing what \"software\" means.\n\nThree key arguments: the capability ceiling stays high (agents raise the floor without lowering the ceiling for experts), one person's breakthrough is everyone's baseline (skills compound when encoded as agent behaviors), and the best teacher is the tool itself (learning-by-doing beats documentation when the tool can guide you)\n\nThis builds naturally on your \"Why agents erode software's oldest moat\" piece. Want me to draft the introduction?",
                mcpServers: [
                  {
                    name: "WordPress",
                    server: "wordpress-mcp",
                    action: "Read previous published essays",
                  },
                ],
                actions: [
                  "Draft introduction",
                  "Refine outline",
                  "Schedule post",
                ],
              },
              {
                id: "m3",
                role: "user",
                content:
                  "Yes, draft the intro. Keep it punchy — 150 words max.",
              },
              {
                id: "m4",
                role: "assistant",
                bot: BOTS.contentBot,
                content:
                  "Here's a draft:\n\n> Every decade, software gets a new moat. In the 2000s it was data. In the 2010s it was network effects. In the 2020s it was AI models. But agents are different — they don't just process information, they act on it. And when your software can act, the old moats start to look like puddles.\n>\n> This isn't about automation replacing humans. It's about what happens when every knowledge worker gets a tireless collaborator that learns their patterns, remembers their context, and executes with precision. The companies that figure this out first won't just have better tools. They'll have a fundamentally different relationship with their customers.\n>\n> Here's what that means for your product strategy.\n\n132 words. Want me to refine the tone or move to the next section?",
              },
            ],
          },
          {
            id: "s-4",
            title: "Blog post calendar Q3",
            updatedAt: "5d",
            unread: false,
            cost: "$0.02",
            messages: [
              {
                id: "m1",
                role: "user",
                content:
                  "Draft a blog post calendar for Q3. We want 2 posts per month, alternating technical deep-dives and thought leadership.",
              },
              {
                id: "m2",
                role: "assistant",
                bot: BOTS.contentBot,
                content:
                  'Q3 blog calendar, alternating technical and thought leadership:\n\nJuly: "Building agent memory that actually works" (technical, week 1) and "Why every SaaS company needs an agent strategy" (thought leadership, week 3). August: "RAG vs. long-context: when to use what" (technical) and "The agent builder\'s playbook" (thought leadership). September: "Securing MCP servers in production" (technical) and "From tools to teammates: the next phase of AI" (thought leadership).\n\nEach post targets 1,500-2,000 words. I\'d start drafts 2 weeks ahead of publish date. Want me to create a Notion board to track these?',
                artifact: { name: "Blog Calendar Q3.csv", type: "spreadsheet" },
                mcpServers: [
                  {
                    name: "Google Analytics",
                    server: "ga-mcp",
                    action: "Read content calendar and publish dates",
                  },
                ],
                actions: [
                  "Create Notion board",
                  "Assign authors",
                  "Add to calendar",
                ],
              },
              {
                id: "m3",
                role: "user",
                content:
                  "Can you also pull last quarter's content performance so we know what's working?",
              },
              {
                id: "m4",
                role: "assistant",
                bot: BOTS.analyst,
                content:
                  'Q2 content performance: "Building your first AI agent" (tutorial) led with 15,200 views, 520 shares, and 62 leads. "Why agents erode software\'s oldest moat" got 12,400 views and 340 shares but only 28 leads. "MCP deep-dive" had 8,900 views with the longest read time at 6:10. "Enterprise AI: lessons" did 6,100 views, and "Zero-trust for agent infrastructure" had 3,800 views but a solid 31 leads.\n\nKey takeaway: tutorials drive the most traffic and leads, thought leadership gets shares but fewer leads, and technical deep-dives get the longest read times. For Q3, I\'d weight toward tutorials and make sure every technical post includes a "try it yourself" section with working code. Saved the data.',
                artifact: {
                  name: "Content Performance.csv",
                  type: "spreadsheet",
                },
                mcpServers: [
                  {
                    name: "Google Analytics",
                    server: "ga-mcp",
                    action: "Read blog post traffic and engagement metrics",
                  },
                  {
                    name: "WordPress",
                    server: "wordpress-mcp",
                    action: "Read published post metadata",
                  },
                ],
              },
            ],
          },
          {
            id: "s-33",
            title: "SEO keyword research",
            updatedAt: "1w",
            unread: false,
            cost: "$0.08",
            messages: [
              {
                id: "m1",
                role: "user",
                content:
                  "Do keyword research for our content strategy. Focus on AI agents, MCP, and enterprise automation.",
              },
              {
                id: "m2",
                role: "assistant",
                bot: BOTS.contentBot,
                content:
                  'Top keyword clusters: "AI agents for business" 12,400/mo volume (medium difficulty, not ranking), "enterprise AI automation" 8,700 (high, #22), "AI agent framework" 6,100 (medium, not ranking), "MCP servers" 3,200 (low, #8), "model context protocol" 2,800 (low, #3).\n\nQuick wins: we\'re already #3 for "model context protocol" — a deep-dive could push us to #1. "MCP servers" is low difficulty and we have domain authority. Big gap: no content targeting "AI agents for business" despite 12K monthly searches — the blog series would fill this.The blog series would fill this.',
                artifact: {
                  name: "SEO Keyword Research.csv",
                  type: "spreadsheet",
                },
                mcpServers: [
                  {
                    name: "Google Analytics",
                    server: "ga-mcp",
                    action: "Read organic search ranking data",
                  },
                ],
                actions: [
                  "Target quick wins",
                  "Draft content brief",
                  "Share with team",
                ],
              },
              {
                id: "m3",
                role: "user",
                content:
                  "Let's go after 'model context protocol' first since we're already #3. What content would push us to #1?",
              },
              {
                id: "m4",
                role: "assistant",
                bot: BOTS.contentBot,
                content:
                  'Current #1 and #2 are the official MCP spec page and a generic explainer. We can beat both by combining authority with depth.\n\nRecommended piece: "The Complete Guide to Model Context Protocol (MCP)" at ~3,000 words. Structure: what MCP is (with our own diagram — #1 has none), why it matters for enterprise (angle neither competitor covers), how it works technically (Python and TypeScript examples), real deployment examples from customers (unique content Google rewards), and MCP vs alternatives (comparison table for high SERP click-through).\n\nSEO tactics: exact match H1 "Model Context Protocol: What It Is and How to Use It," FAQ schema for featured snippets, internal links from existing MCP-mentioning posts, and publish under /blog/model-context-protocol.\n\nEstimated time to #1: 4-6 weeks after publish, assuming we get 3-4 backlinks from the dev community. Want me to draft the outline?',
                mcpServers: [
                  {
                    name: "Google Analytics",
                    server: "ga-mcp",
                    action:
                      "Read SERP rankings and competitor content analysis",
                  },
                ],
                actions: [
                  "Draft the outline",
                  "Assign author",
                  "Schedule publish",
                ],
              },
              {
                id: "m5",
                role: "user",
                content:
                  "Draft the outline and assign it. Who on the team should write this?",
              },
              {
                id: "m6",
                role: "assistant",
                bot: BOTS.analyst,
                content:
                  "Outline drafted with section-by-section guidance and target word counts. Recommended author: Alex from the platform team — He's closest to the MCP implementation and his last technical blog post (\"Building your first AI agent\") was our top performer at 15,200 views. Technical credibility + writing chops.\n\nTimeline: week 1 Alex drafts sections 1-3 (technical core), week 2 marketing adds sections 4-5 (enterprise angle, comparisons), week 3 SEO review, diagram creation, and publish\n\nI've created the content brief in Notion and assigned Alex with a June 6 draft deadline. Also flagged 4 existing blog posts that should link to this piece once it's live — that internal linking will boost authority immediately.\n\nThis is our best shot at a #1 ranking for a keyword we actually own. Want me to also prep a LinkedIn distribution plan for when it publishes?",
              },
            ],
          },
          {
            id: "s-34",
            title: "Social media campaign templates",
            updatedAt: "2w",
            unread: false,
            cost: "$0.31",
            messages: [
              {
                id: "m1",
                role: "user",
                content:
                  "Create social media templates for promoting blog posts. Need LinkedIn and Twitter formats.",
              },
              {
                id: "m2",
                role: "assistant",
                bot: BOTS.contentBot,
                content:
                  "Two templates ready.\n\nLinkedIn (thought leadership): hook question (1 line), 2-3 sentences expanding the insight, key takeaway or contrarian view, CTA with link, hashtags #AIAgents #EnterpriseTech #MCP.\n\nTwitter/X (thread format): 1/ bold claim or stat, 2/ why this matters, 3/ what most people get wrong, 4/ your take, 5/ link to full post.\n\nExample LinkedIn post for the agents article:\n> What happens when your software can act, not just respond?\n>\n> Most companies are treating AI agents like fancy chatbots. But the real shift is deeper — agents collapse the gap between what you want and what gets done.\n>\n> The companies that figure this out won't just have better tools. They'll have a fundamentally different relationship with their customers.\n>\n> New post: [link]\n\nSaved both templates.",
                artifact: {
                  name: "Social Media Templates.doc",
                  type: "document",
                },
                actions: [
                  "Schedule first post",
                  "Request review",
                  "Save as template",
                ],
              },
              {
                id: "m3",
                role: "user",
                content:
                  "The LinkedIn template feels generic. Make it more specific to our voice — technical but approachable.",
              },
              {
                id: "m4",
                role: "assistant",
                bot: BOTS.contentBot,
                content:
                  'Updated with your brand voice. LinkedIn (revised) opens with a real scenario instead of a question:\n>\n> "Last week, one of our customers automated their entire deployment review. Not with a chatbot — with an agent that understands their codebase and posts results in Slack before anyone asks."\n>\n> [Insight — no jargon]\n>\n> "The difference between AI that assists and AI that acts is the difference between a search engine and a colleague."\n>\n> [Direct CTA]\n>\n> "Wrote about what this means for product teams → [link]"\n\nKey changes: no hashtags in body (put them in comments), open with stories not questions, CTA uses an arrow not a button. Your best-performing posts all follow this pattern.\n\nWant me to pre-write the first 3 LinkedIn posts for Q3?',
              },
              {
                id: "m5",
                role: "user",
                content:
                  "Yes, match them to the first 3 blog posts on the Q3 calendar.",
              },
              {
                id: "m6",
                role: "assistant",
                bot: BOTS.contentBot,
                content:
                  'Three pre-written posts:\n\nFor "Building agent memory that actually works":\n> We ran 1,000 queries against 5 chunking strategies. Fixed-size at 512 tokens? 72% recall. Hybrid semantic with 20% overlap? 84%. That 12% gap is the difference between an agent that mostly works and one your team trusts → [link]\n\nFor "Why every SaaS company needs an agent strategy":\n> A customer told us: "I don\'t want a dashboard. I want the thing the dashboard shows to already be done." SaaS companies that understand this will thrive. The rest become the legacy tools agents replace → [link]\n\nFor "RAG vs. long-context: when to use what":\n> We tested RAG against long-context on a 50K doc corpus. RAG won on accuracy and cost. Long-context won on simplicity. Neither won on everything. Here\'s the decision framework we use internally → [link]\n\nAll follow the new template: concrete opening, insight, direct CTA. Saved to the content calendar with publish dates aligned.',
                actions: [
                  "Schedule posts",
                  "Request review",
                  "Add to calendar",
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    team: "Sales",
    projects: [
      {
        id: "f-3",
        name: "Pipeline & Forecasting",
        summary:
          "Tracking Q3 sales pipeline health and revenue forecasting. Weighted pipeline is at $4.2M against a $5.8M target — a $1.6M gap. Three accounts flagged as high-risk: Acme Corp (champion departed), Globex (budget freeze), and Initech (declining sentiment). Four high-probability deals identified as best bets to close the gap.",
        status: "At risk — 28% gap to target",
        memories: [
          {
            id: "pm-1",
            content:
              "Acme Corp's champion left the company last week. New contact is evaluating competitors. Needs exec-to-exec outreach.",
            source: "Q3 pipeline forecast chat",
            updatedAt: "18h ago",
          },
          {
            id: "pm-2",
            content:
              "Wayne Enterprises contract redline is in progress. Legal review expected by Friday. 70% close probability.",
            source: "Q3 pipeline forecast chat",
            updatedAt: "18h ago",
          },
          {
            id: "pm-3",
            content:
              "Win rate dipped 3pp from Q2 (34% → 31%) but average deal size is up 9% ($285K → $312K). Sales cycle increased 5 days — correlated with larger enterprise deals.",
            source: "Deal risk analysis chat",
            updatedAt: "3d ago",
          },
          {
            id: "pm-4",
            content:
              "Competitive losses are trending down (8 → 5). New battlecard appears to be working.",
            source: "Deal risk analysis chat",
            updatedAt: "3d ago",
          },
        ],
        recentActions: [
          {
            id: "pa-1",
            description:
              "Generated account health scorecard for top 10 accounts",
            actor: "Claude",
            timestamp: "18h ago",
          },
          {
            id: "pa-2",
            description:
              "Identified 4 high-probability deals to close the $1.6M gap",
            actor: "Claude",
            timestamp: "18h ago",
          },
          {
            id: "pa-3",
            description:
              "Drafted outreach emails for Acme Corp and Umbrella Co",
            actor: "Claude",
            timestamp: "3d ago",
          },
          {
            id: "pa-4",
            description: "Updated weekly revenue summary with new projections",
            actor: "Claude",
            timestamp: "3d ago",
          },
          {
            id: "pa-5",
            description: "Generated win/loss trend comparison (Q2 vs Q3)",
            actor: "Claude",
            timestamp: "3d ago",
          },
        ],
        suggestions: [
          {
            id: "ps-1",
            label: "Schedule QBRs for at-risk accounts",
            description:
              "Acme Corp and Globex are both flagged red/yellow. Scheduling QBRs this month could re-engage stakeholders.",
          },
          {
            id: "ps-2",
            label: "Send SOC 2 docs to Massive Dynamic",
            description:
              "Procurement is the last blocker. Proactively sending compliance docs could accelerate the close.",
          },
          {
            id: "ps-3",
            label: "Refresh pipeline forecast midweek",
            description:
              "Wayne Enterprises legal review lands Friday. A mid-week refresh would capture any early signals.",
          },
          {
            id: "ps-4",
            label: "Draft exec-to-exec outreach for Acme",
            description:
              "Champion departed — the new contact needs a warm intro from your leadership to reset the relationship.",
          },
          {
            id: "ps-5",
            label: "Update competitive battlecard with Q3 intel",
            description:
              "Competitive losses are down but Competitor B dropped pricing 20%. Battlecard needs refreshing.",
          },
        ],
        outputFiles: [
          {
            name: "Q3 Pipeline Forecast.csv",
            type: "spreadsheet",
            createdAt: "2h",
          },
          {
            name: "Deal Risk Analysis.csv",
            type: "spreadsheet",
            createdAt: "6h",
          },
          {
            name: "Weekly Revenue Summary.csv",
            type: "spreadsheet",
            createdAt: "1d",
          },
          {
            name: "Account Health Scorecard.csv",
            type: "spreadsheet",
            createdAt: "2d",
          },
          {
            name: "Forecast Assumptions.doc",
            type: "document",
            createdAt: "3d",
          },
          { name: "Win/Loss Report Q2.doc", type: "document", createdAt: "5d" },
          {
            name: "Territory Mapping.csv",
            type: "spreadsheet",
            createdAt: "1w",
          },
        ],
        sessions: [
          {
            id: "s-5",
            title: "Q3 pipeline forecast",
            updatedAt: "18h",
            unread: true,
            cost: "$0.47",
            messages: [
              {
                id: "m1",
                role: "user",
                content:
                  "Pull the latest pipeline data from Salesforce and give me a summary of where we stand for Q3.",
              },
              {
                id: "m2",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  "Q3 pipeline snapshot: weighted pipeline $4.2M against a $5.8M target, leaving a $1.6M gap (28%).\n\nTop risks: Acme Corp ($450K) — champion left last week, new contact evaluating competitors. Globex renewal ($380K) — pushed to Q4 pending budget approval. Initech expansion ($220K) — Gong sentiment dropped 15% over last 3 calls.\n\nYou'll need roughly 2 more mid-market wins to close the gap. Want me to identify the highest-probability opportunities to focus on?",
                artifact: {
                  name: "Q3 Pipeline Forecast.csv",
                  type: "spreadsheet",
                },
                tasks: [
                  { label: "Connected to Salesforce API", status: "completed" },
                  { label: "Pulled Q3 opportunity data", status: "completed" },
                  {
                    label: "Fetched Gong sentiment scores",
                    status: "completed",
                  },
                  {
                    label: "Calculated weighted pipeline",
                    status: "completed",
                  },
                  { label: "Generated risk analysis", status: "completed" },
                ],
                mcpServers: [
                  {
                    name: "Salesforce",
                    server: "salesforce-mcp",
                    action: "Read opportunities and pipeline data",
                  },
                  {
                    name: "Gong",
                    server: "gong-mcp",
                    action: "Read call sentiment scores",
                  },
                ],
                actions: [
                  "Identify best bets",
                  "Update CRM",
                  "Share with team",
                ],
              },
              {
                id: "m3",
                role: "user",
                content:
                  "Yes, show me the highest-probability opportunities we should focus on to close the gap.",
              },
              {
                id: "m4",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  "Ranked by close probability x deal value, best bets to close the $1.6M gap: Wayne Enterprises ($520K, 70% prob, contract redline in progress, legal review expected Friday), Massive Dynamic ($410K, 70%, technical win confirmed, awaiting procurement), Oscorp ($310K, 55%, proposal submitted, champion is internal advocate), and Tyrell Corp ($340K, 45%, good momentum but needs exec alignment). These four total $1.58M weighted — enough if 3 of 4 land.\n\nRecommended actions: push Wayne for signature this week with a Q3 onboarding incentive, schedule a procurement call with Massive Dynamic and send SOC 2 docs proactively, and ask Oscorp's champion to loop in their VP for a 15-min alignment call\n\nI've updated the weekly revenue summary with these projections.",
                artifact: {
                  name: "Weekly Revenue Summary.csv",
                  type: "spreadsheet",
                },
                tasks: [
                  {
                    label: "Ranked opportunities by weighted value",
                    status: "completed",
                  },
                  {
                    label: "Cross-referenced Gong engagement data",
                    status: "completed",
                  },
                  { label: "Updated revenue projections", status: "completed" },
                ],
                mcpServers: [
                  {
                    name: "Salesforce",
                    server: "salesforce-mcp",
                    action: "Read deal stages and probabilities",
                  },
                  {
                    name: "Gong",
                    server: "gong-mcp",
                    action: "Read engagement metrics",
                  },
                ],
                actions: [
                  "Draft follow-up emails",
                  "Schedule calls",
                  "Update CRM",
                ],
              },
              {
                id: "m5",
                role: "user",
                content:
                  "Generate an account health scorecard for the top 10 accounts.",
              },
              {
                id: "m6",
                role: "assistant",
                bot: BOTS.analyst,
                content:
                  "Account health scorecard for the top 10 by ARR. Green: Weyland-Yutani ($480K, NPS 68), Massive Dynamic ($410K, NPS 71), Oscorp ($310K, NPS 65), Cyberdyne ($275K, NPS 62), Soylent Corp ($190K, NPS 72), Stark Industries ($150K, NPS 70). Yellow: Wayne Enterprises ($520K, NPS 55, pending renewal), Globex ($380K, NPS 48, budget freeze), Tyrell Corp ($340K, NPS 51, exec misalignment). Red: Acme Corp ($450K, NPS 32, champion left).\n\n3 accounts flagged for immediate attention. I'd recommend scheduling QBRs for Acme and Globex this month.",
                artifact: {
                  name: "Account Health Scorecard.csv",
                  type: "spreadsheet",
                },
                mcpServers: [
                  {
                    name: "Salesforce",
                    server: "salesforce-mcp",
                    action: "Read account ARR and renewal dates",
                  },
                  {
                    name: "Gainsight",
                    server: "gainsight-mcp",
                    action: "Read NPS scores and health data",
                  },
                ],
                actions: [
                  "Schedule QBRs",
                  "Export to CSV",
                  "Escalate to manager",
                ],
              },
            ],
          },
          {
            id: "s-6",
            title: "Deal risk analysis",
            updatedAt: "3d",
            unread: false,
            cost: "$2.14",
            messages: [
              {
                id: "m1",
                role: "user",
                content:
                  "Which deals in the pipeline have the highest risk of slipping?",
              },
              {
                id: "m2",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  "Based on Gong sentiment, engagement frequency, and historical patterns, the top 5 at-risk deals: Acme Corp ($450K, high risk — champion departed, no exec sponsor), Globex ($380K, medium-high — budget freeze, pushed to Q4), Initech ($220K, medium — sentiment declining, competitor POC in progress), Umbrella Co ($180K, medium — went dark after demo, no response in 2 weeks), and Stark Industries ($150K, low-medium — procurement slow but technical win confirmed)\n\nRecommendation: schedule exec-to-exec calls for Acme and Umbrella this week. Want me to draft the outreach?",
                artifact: {
                  name: "Deal Risk Analysis.csv",
                  type: "spreadsheet",
                },
                mcpServers: [
                  {
                    name: "Salesforce",
                    server: "salesforce-mcp",
                    action: "Read deal history and contact data",
                  },
                  {
                    name: "Gong",
                    server: "gong-mcp",
                    action: "Read call sentiment and engagement",
                  },
                ],
                actions: [
                  "Draft outreach emails",
                  "Schedule exec calls",
                  "Flag for review",
                ],
              },
              {
                id: "m3",
                role: "user",
                content: "Draft the outreach emails for Acme and Umbrella.",
              },
              {
                id: "m4",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  "Here are both drafts:\n\nAcme Corp — Exec realignment\n\n> Subject: Continuing our partnership — quick sync?\n>\n> Hi [New Contact],\n>\n> I understand there have been some changes on your side. We've been working closely with your team on [project] and I wanted to make sure we're still aligned on the path forward.\n>\n> Would you have 15 minutes this week for a quick intro call? I'd love to understand your priorities and how we can best support the team.\n>\n> Best, [Your name]\n\nUmbrella Co — Re-engagement\n\n> Subject: Following up on your demo — next steps?\n>\n> Hi [Contact],\n>\n> It's been a couple of weeks since your demo and I wanted to check in. The team was excited about the use cases you shared, particularly around [specific use case].\n>\n> Are there any questions we can help answer? Happy to schedule a technical deep-dive with our solutions team if that would be helpful.\n>\n> Best, [Your name]\n\nWant me to personalize these with data from the CRM?",
              },
              {
                id: "m5",
                role: "user",
                content:
                  "What's the win/loss trend looking like compared to Q2?",
              },
              {
                id: "m6",
                role: "assistant",
                bot: BOTS.analyst,
                content:
                  "Q2 vs Q3 comparison: win rate dipped slightly (34% to 31%), but avg deal size is up 9% ($285K to $312K). Avg sales cycle increased 5 days (47 to 52). Competitive losses improved (8 down to 5) and no-decision losses also improved (12 to 9).\n\nKey takeaway: win rate dipped because we're pursuing larger accounts with naturally longer cycles. Competitive losses trending down suggests the new battlecard is working. Main concern is the 5-day cycle increase. This correlates with the procurement slowdowns we're seeing at Stark and Wayne.",
                artifact: { name: "Win/Loss Report Q2.doc", type: "document" },
                mcpServers: [
                  {
                    name: "Salesforce",
                    server: "salesforce-mcp",
                    action: "Read win/loss data and deal cycle metrics",
                  },
                  {
                    name: "Gong",
                    server: "gong-mcp",
                    action: "Read competitive loss call recordings",
                  },
                ],
                actions: ["Update battlecard", "Share with team", "Dig deeper"],
              },
            ],
          },
          {
            id: "s-42",
            title: "Territory mapping review",
            updatedAt: "5d",
            unread: false,
            cost: "$4.12",
            messages: [
              {
                id: "m1",
                role: "user",
                content:
                  "Review the current territory mapping. We added 2 new AEs last month and need to rebalance.",
              },
              {
                id: "m2",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  "Rebalanced territory map: Sarah K. stays on West Coast (28 accounts, $1.8M pipeline, top performer). Mike R. on East Coast goes from 32 to 26 accounts ($1.4M pipeline, was overloaded). Priya S. takes Central/Midwest as a new AE (14 accounts from Mike — she has enterprise experience in that market). James T. takes EMEA as a new AE (11 accounts from Sarah — time zone alignment). Alex W. stays on Mid-Market unchanged (24 accounts, $980K).\n\nBoth new AEs get a mix of existing pipeline and greenfield. Net result: no AE has more than 28 accounts. Want me to draft the announcement?",
                artifact: {
                  name: "Territory Mapping.csv",
                  type: "spreadsheet",
                },
                mcpServers: [
                  {
                    name: "Salesforce",
                    server: "salesforce-mcp",
                    action: "Read account assignments and pipeline data",
                  },
                ],
                actions: ["Draft announcement", "Schedule 1:1s", "Update CRM"],
              },
              {
                id: "m3",
                role: "user",
                content:
                  "Mike might push back on losing accounts. How do I frame this for him?",
              },
              {
                id: "m4",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  'Good instinct. Frame it as: "You\'re at 32 accounts and our data shows AE performance drops above 25. You\'re overloaded, not underperforming. By moving the 6 Midwest accounts to Priya, you can go deeper on your East Coast enterprise deals — that\'s where your $1.4M pipeline lives. Net effect: fewer accounts, more revenue per account, higher commission."\n\nKey data: his close rate dropped from 38% to 29% this quarter (capacity, not skill), the 6 accounts are all mid-market ($30-80K) while his sweet spot is enterprise ($200K+), and Priya has Midwest relationships from her previous role at Salesforce. Don\'t frame it as "taking accounts away" — frame it as "focusing your time where it drives the most revenue."\n\nI\'d suggest a 1:1 before the team announcement. Want me to prep talking points for that conversation?',
                mcpServers: [
                  {
                    name: "Salesforce",
                    server: "salesforce-mcp",
                    action: "Read AE close rates and account tiers",
                  },
                ],
              },
              {
                id: "m5",
                role: "user",
                content:
                  "Yes, prep the talking points. And draft the team announcement separately.",
              },
              {
                id: "m6",
                role: "assistant",
                bot: BOTS.analyst,
                content:
                  "Mike 1:1 talking points: open with recognition (his pipeline is the largest on the team), show the data (32 accounts, declining close rate — pattern holds for all AEs above 25), explain the move (6 mid-market accounts to Priya, he keeps all enterprise), highlight the upside (more time per deal = higher close rate = more commission), and ask for input on which accounts he wants to keep (flexibility shows respect).\n\nTeam Announcement (draft):\n\n> Team — as we welcome Priya and James, we're rebalancing territories to set everyone up for success.\n>\n> The goal: no one over 28 accounts, better geographic alignment, and room for our new AEs to ramp.\n>\n> Key changes:\n> - Priya takes Central/Midwest — she brings deep enterprise experience in this market\n> - James covers EMEA — finally proper timezone coverage for our EU accounts\n> - Mike and Sarah keep their core territories, focused on the highest-value opportunities\n>\n> Account handoff starts Monday. I'll schedule 1:1s to walk through your specific changes.\n\nSend the announcement after your 1:1 with Mike — ideally same day so he hears it from you first.",
              },
            ],
          },
          {
            id: "s-43",
            title: "Competitive battlecard update",
            updatedAt: "1w",
            unread: false,
            cost: "$0.02",
            messages: [
              {
                id: "m1",
                role: "user",
                content:
                  "Update the battlecard for Competitor B. They just dropped pricing 20% and launched a new orchestration feature.",
              },
              {
                id: "m2",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  'Updated the Competitor B battlecard. Two changes: pricing dropped 20% across all tiers (now $8-$10/seat) and they launched "Orchestration Studio" (visual workflow builder).\n\nOn pricing, counter with: their support is ticket-only (no dedicated CSM below Enterprise), no uptime SLA on Business tier, and TCO is higher at scale due to hidden per-API-call charges. Ask prospects "What\'s included in that price?" — ours includes support, SLA, and unlimited API calls.\n\nOn Orchestration Studio: it\'s visual-only with no code export (locked into their builder), doesn\'t support MCP (proprietary protocol only), and our agent SDK gives full programmatic control. Ask "Can you bring your own tools?" — the answer is no.\n\nNew win story: Cyberdyne evaluated both and chose us for MCP compatibility and API-first approach despite a 15% price premium.\n\nDistributed to the team via #sales-enablement.',
                mcpServers: [
                  {
                    name: "Gong",
                    server: "gong-mcp",
                    action: "Read competitive mention call transcripts",
                  },
                ],
                actions: ["Create demo script", "Share with AEs", "Update CRM"],
              },
              {
                id: "m3",
                role: "user",
                content:
                  "The AEs are asking for a side-by-side demo script they can use in competitive deals. Can you write one?",
              },
              {
                id: "m4",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  'Here\'s a 10-minute competitive demo script:\n\nSetup (2 min):\nOpen two browser tabs — our platform and Competitor B\'s free trial.\n\nAct 1: Build an agent (3 min)\n- Our platform: create agent via SDK in 8 lines of code, deploy to production in 30 seconds\n- Their platform: drag-and-drop builder, looks easy... but show what happens when you need custom logic → stuck in their visual editor\n\nAct 2: Connect a tool (3 min)\n- Our platform: add any MCP-compatible tool with one line. Show connecting to their existing Slack, Jira, or GitHub.\n- Their platform: only works with their 12 pre-built connectors. No MCP support. "What if the tool you need isn\'t on this list?"\n\nAct 3: Show the bill (2 min)\n- Our platform: flat per-seat pricing, unlimited API calls\n- Their platform: $8/seat looks cheap... until you show the API call charges. "At your volume, that\'s an extra $3,400/month they don\'t mention on the pricing page."\n\nClosing line: "You can start fast with either. The question is — where do you want to be in 12 months?"\n\nWant me to also prep a FAQ for objections that come up during the demo?',
              },
              {
                id: "m5",
                role: "user",
                content:
                  "Yes, and add the top 3 objections we hear in competitive deals specifically.",
              },
              {
                id: "m6",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  'Top 3 Competitive Objections & Responses:\n\n1. "Competitor B is 20% cheaper"\n> "At list price, yes. But their pricing doesn\'t include API calls, which at your usage would add $2-4K/month. Here\'s a TCO calculator — let\'s plug in your numbers. In 8 out of 10 enterprise deals, we come out 10-15% cheaper when you factor in support, SLA, and API costs."\n\n2. "Their visual builder looks easier"\n> "For simple workflows, it is. But your team told me you need [specific complex requirement]. Try building that in their visual editor — you\'ll hit a wall. Our SDK approach means you can build anything, and your engineers already know the tools. No vendor-specific skills to learn."\n\n3. "They have SOC 2 Type II, you don\'t"\n> "We\'re on track for Type II by October, and here\'s a bridge letter from our auditor confirming it. We\'re already Type I certified, which means the controls exist — Type II is the observation period. We can also include a contractual commitment with a termination clause if we miss the date."\n\nAdded these to the battlecard and distributed to the team. The demo script is saved as a separate enablement doc. Sarah on the West Coast team is already asking to do a dry-run — want me to schedule it?',
              },
            ],
          },
        ],
      },
      {
        id: "f-4",
        name: "Pricing & Proposals",
        summary:
          "Enterprise pricing strategy and proposal templates for the sales team. Recently updated the pricing matrix with new volume tiers and competitive positioning. Win rate on proposals using the v3 template is 34% vs 22% on the old format.",
        suggestions: [
          {
            id: "pp-1",
            label: "Update pricing for the new Enterprise Plus tier",
            description:
              "Add the new tier to the pricing matrix with volume discounts.",
          },
          {
            id: "pp-2",
            label: "Analyze competitor pricing changes",
            description: "Review recent pricing moves from top 3 competitors.",
          },
          {
            id: "pp-3",
            label: "Create a proposal for the Acme Corp deal",
            description: "Use the v3 template with custom volume pricing.",
          },
        ],
        outputFiles: [
          {
            name: "Enterprise Pricing Matrix.csv",
            type: "spreadsheet",
            createdAt: "1d",
          },
          {
            name: "Discount Approval Template.doc",
            type: "document",
            createdAt: "2d",
          },
          {
            name: "Competitive Pricing Intel.csv",
            type: "spreadsheet",
            createdAt: "4d",
          },
          {
            name: "Proposal Template v3.doc",
            type: "document",
            createdAt: "1w",
          },
        ],
        sessions: [
          {
            id: "s-7",
            title: "Enterprise pricing playbook",
            updatedAt: "1d",
            unread: false,
            cost: "$2.67",
            messages: [
              {
                id: "m1",
                role: "user",
                content:
                  "Create a pricing playbook for enterprise deals. Include competitive displacement scenarios and objection handling.",
              },
              {
                id: "m2",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  'I\'ve drafted the Enterprise Pricing Playbook. Key sections:\n\nTiered pricing:\n- Starter: up to 50 seats, $15/seat/mo\n- Business: up to 500 seats, $12/seat/mo\n- Enterprise: 500+ seats, custom pricing from $9/seat/mo\n\nVolume discounts (per Q2 board approval):\n- 2-year commit: 15% discount\n- 3-year commit: 25% discount\n\nCompetitive displacement — Datadog migration:\n- Lead with TCO comparison (typically 30-40% savings)\n- Offer free migration assistance for deals >$100K ARR\n- Reference customer: Globex saw 35% cost reduction\n\nCommon objections:\n- "Too expensive" → pivot to value per seat, show ROI calculator\n- "We\'re locked in" → offer bridge pricing during contract overlap\n\nSaved the pricing matrix. Want me to add more scenarios?',
                artifact: {
                  name: "Enterprise Pricing Matrix.csv",
                  type: "spreadsheet",
                },
                mcpServers: [
                  {
                    name: "Salesforce",
                    server: "salesforce-mcp",
                    action: "Read deal and pricing data",
                  },
                  {
                    name: "Clari",
                    server: "clari-mcp",
                    action: "Read competitive displacement data",
                  },
                ],
                actions: [
                  "Add more scenarios",
                  "Export to CSV",
                  "Share with team",
                ],
              },
              {
                id: "m3",
                role: "user",
                content:
                  "Add a section for competitive pricing intelligence — what are the main competitors charging?",
              },
              {
                id: "m4",
                role: "assistant",
                bot: BOTS.analyst,
                content:
                  "Competitive pricing landscape: Competitor A at $18/$14/$11 per seat (entry/mid-market/enterprise, higher base but less discounting). Competitor B at $12/$10/$8 (aggressive on price, weaker support). Competitor C at $20/$16/custom (premium positioning, strong brand). Competitor D has a free tier, $8 mid-market, $12 enterprise (usage-based, gets expensive at scale).\n\nWe're priced competitively in mid-market but slightly above Competitor B. Our enterprise tier is well-positioned against Competitor C. Competitor D's usage model means their enterprise costs often exceed ours at scale — good TCO comparison opportunity.\n\nUpdated the competitive pricing intel spreadsheet.",
                artifact: {
                  name: "Competitive Pricing Intel.csv",
                  type: "spreadsheet",
                },
                mcpServers: [
                  {
                    name: "Clari",
                    server: "clari-mcp",
                    action: "Read competitive pricing intelligence",
                  },
                ],
                actions: [
                  "Update battlecard",
                  "Share with team",
                  "Compare to last quarter",
                ],
              },
              {
                id: "m5",
                role: "user",
                content:
                  "Create a discount approval template for the sales team.",
              },
              {
                id: "m6",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  "Here's the discount approval template: Deal name, ACV, standard and requested price, discount %, and justification (competitive pressure, strategic account, or multi-year commit).\n\nApproval matrix: up to 10% needs AE manager approval, 10-20% VP Sales, 20-30% CRO plus finance review, 30%+ requires CEO. Required attachments: competitive quote (if displacement), ROI analysis, and multi-year commitment terms.\n\nTemplate saved and ready for the team.",
                artifact: {
                  name: "Discount Approval Template.doc",
                  type: "document",
                },
                mcpServers: [
                  {
                    name: "Salesforce",
                    server: "salesforce-mcp",
                    action: "Read historical discount approvals",
                  },
                ],
                actions: [
                  "Share with AEs",
                  "Save as template",
                  "Set up approval flow",
                ],
              },
            ],
          },
          {
            id: "s-35",
            title: "Wayne Enterprises proposal draft",
            updatedAt: "3d",
            unread: false,
            cost: "$0.31",
            messages: [
              {
                id: "m1",
                role: "user",
                content:
                  "Draft a proposal for Wayne Enterprises. $520K deal, 200 seats, 2-year commitment. They care about security and uptime SLAs.",
              },
              {
                id: "m2",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  "Here's the proposal draft. Executive summary: 200-seat enterprise deployment with dedicated support, 99.95% uptime SLA, and SOC 2 Type II compliance.\n\nPricing: 200 seats at $11/seat/mo = $26,400/mo, minus 15% for the 2-year commitment = $22,440/mo ($538,560 over 2 years). Includes dedicated CSM and TAM, 99.95% uptime SLA with financial credits, priority support (4-hour response), annual security review and pen test, and custom SSO integration (SAML/OIDC).\n\nWhy us over Competitor C: 40% lower TCO, SOC 2 Type II certified (they're still Type I), and native MCP support with no middleware required.\n\nWant me to personalize the case studies section?",
                artifact: {
                  name: "Proposal Template v3.doc",
                  type: "document",
                },
                mcpServers: [
                  {
                    name: "Salesforce",
                    server: "salesforce-mcp",
                    action: "Read Wayne Enterprises deal data",
                  },
                ],
                actions: [
                  "Personalize case studies",
                  "Send to reviewer",
                  "Update CRM",
                ],
              },
              {
                id: "m3",
                role: "user",
                content:
                  "Yes — use the Cyberdyne and Soylent Corp case studies. Wayne cares about security and scale.",
              },
              {
                id: "m4",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  "Added the case studies section. Cyberdyne (security-first, 150 seats, financial services): deployed agent platform with full audit logging and SSO, passed their internal security review in 2 weeks vs 6 weeks for Competitor B, 40% reduction in manual compliance checks. Soylent Corp (scaling, 300 seats, started at 80): runs 12 production agents across engineering, support, and ops, P99 API latency stayed under 100ms at 10x initial load, 60% faster incident resolution, NPS 72.\n\nBoth map to Wayne's priorities — Cyberdyne for security, Soylent for scale. Also added a Technical Architecture appendix showing our multi-tenant isolation (Wayne's CISO asked about this).\n\nProposal is 8 pages total. Ready for final review?",
                mcpServers: [
                  {
                    name: "Salesforce",
                    server: "salesforce-mcp",
                    action: "Read Cyberdyne and Soylent Corp account data",
                  },
                ],
              },
              {
                id: "m5",
                role: "user",
                content:
                  "Their legal team flagged the data residency section. Can you add a paragraph addressing EU data storage?",
              },
              {
                id: "m6",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  "Added a data residency section under the Security & Compliance heading:\n\nData Residency & Sovereignty\n\n> All customer data is stored in AWS us-east-1 by default, with EU region (eu-west-1, Frankfurt) available as an add-on. Agent configurations, conversation logs, and user metadata remain within the selected region with no cross-region replication unless explicitly configured.\n>\n> For Wayne Enterprises' EU operations, we recommend a dual-region setup: us-east-1 for North American users, eu-west-1 for EU users. Data routing is automatic based on user location. This configuration is included at no additional cost for Enterprise tier.\n>\n> We are GDPR-compliant with DPAs in place for all sub-processors (AWS, Stripe, Okta). A full data flow map is available upon request.\n\nI've also attached our standard DPA as Appendix B, since their legal team will need it for procurement. The proposal is now 9 pages and ready to send. Want me to email it to the Wayne Enterprises team?",
              },
            ],
          },
          {
            id: "s-36",
            title: "ROI calculator for mid-market",
            updatedAt: "1w",
            unread: false,
            cost: "$2.67",
            messages: [
              {
                id: "m1",
                role: "user",
                content:
                  "Build an ROI calculator the sales team can use for mid-market deals. Should show time-to-value and cost savings.",
              },
              {
                id: "m2",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  "Here's the ROI model. Inputs: number of developers, current tool spend (monthly), and avg hours/week on manual tasks.\n\nOutputs: manual workflow hours drop from 12h/dev/week to 3h (75% reduction), tool consolidation from 4 tools to 1 platform (~$8K/mo saved), time to deploy goes from 2 weeks to 2 hours (98% faster), and annual cost savings of $96K-$180K. Payback period is 2.1 months at 100 seats.\n\nI've built it as an interactive spreadsheet the AEs can fill in during discovery calls.",
                mcpServers: [
                  {
                    name: "Clari",
                    server: "clari-mcp",
                    action: "Read mid-market deal metrics and benchmarks",
                  },
                ],
                actions: [
                  "Share with AEs",
                  "Export to CSV",
                  "Add cumulative chart",
                ],
              },
              {
                id: "m3",
                role: "user",
                content:
                  "The payback period seems too optimistic. Where are the assumptions?",
              },
              {
                id: "m4",
                role: "assistant",
                bot: BOTS.analyst,
                content:
                  "Fair point. Assumptions: avg developer cost $85/hr fully loaded (Glassdoor + customer data), hours saved per dev 9h/week (average from 6 customer interviews), tool cost replaced $80/dev/mo (Datadog + PagerDuty + custom scripts), our platform cost $12/seat/mo (Business tier), adoption ramp 60% month 1 and 90% month 3 (our onboarding data).\n\nConservative scenario pushes payback to 3.5 months. I've added a toggle: Optimistic (2.1 mo), Realistic (3.5 mo), Conservative (5.2 mo). Default is Realistic.\n\nWant me to add a cumulative savings chart?",
                mcpServers: [
                  {
                    name: "Salesforce",
                    server: "salesforce-mcp",
                    action: "Read customer interview and onboarding data",
                  },
                ],
              },
              {
                id: "m5",
                role: "user",
                content:
                  "Yes, add the chart. Make sure it works for 20 to 500 seats.",
              },
              {
                id: "m6",
                role: "assistant",
                bot: BOTS.salesCopilot,
                content:
                  'Added a dynamic chart plotting cumulative savings vs. platform cost over 12 months:\n\n- 20 seats: breakeven month 4, $28K annual savings\n- 100 seats: breakeven month 3.5, $142K annual savings\n- 500 seats: breakeven month 2.5, $780K annual savings\n\nThe chart also shows a "without our platform" trendline. At 500 seats the gap is $65K/month by month 12 — very visual for prospects.\n\nSaved and shared with the sales team.',
              },
            ],
          },
        ],
      },
    ],
  },
];

export const MOCK_PROJECTS: ProjectFolder[] = [
  {
    id: "f-5",
    name: "Research",
    summary:
      "Investigating agent memory architectures for the enterprise knowledge base (50K docs). RAG with hybrid semantic chunking and 20% overlap emerged as the winning strategy — 84% recall, 74% precision. Fine-tuning deferred to a later phase for retrieval ranking improvements.",
    memories: [
      {
        id: "rm-1",
        content:
          "Hybrid semantic chunking with 20% overlap is the winner. 84% recall@5, 74% precision@5, 75ms latency. Fixed-size chunking is faster but misses context boundaries.",
        source: "Agent memory architectures chat",
        updatedAt: "3h ago",
      },
      {
        id: "rm-2",
        content:
          "RAG is the right starting point for 50K docs. Fast update latency (minutes vs days for fine-tuning), source citation capability is critical for enterprise trust.",
        source: "Agent memory architectures chat",
        updatedAt: "3h ago",
      },
      {
        id: "rm-3",
        content:
          "Episodic memory (conversations) and semantic memory (facts) need different retrieval strategies. Forgetting is a feature — aggressive pruning outperforms total recall.",
        source: "Agent memory architectures chat",
        updatedAt: "3h ago",
      },
    ],
    recentActions: [
      {
        id: "ra-1",
        description:
          "Ran benchmarks on 5 chunking strategies across 200 test queries",
        actor: "Claude",
        timestamp: "3h ago",
      },
      {
        id: "ra-2",
        description:
          "Generated RAG vs fine-tuning comparison for 50K doc corpus",
        actor: "Claude",
        timestamp: "3h ago",
      },
      {
        id: "ra-3",
        description: "Surveyed 3 key papers on agent memory architectures",
        actor: "Claude",
        timestamp: "3h ago",
      },
    ],
    suggestions: [
      {
        id: "rs-1",
        label: "Draft implementation RFC",
        description:
          "Benchmark results are in. Draft an RFC for the hybrid chunking implementation so the team can review before sprint planning.",
      },
      {
        id: "rs-2",
        label: "Test with production query patterns",
        description:
          "Benchmarks used synthetic queries. Running against actual user search logs would validate the results.",
      },
      {
        id: "rs-3",
        label: "Evaluate embedding model options",
        description:
          "Chunking strategy is decided. Next variable to optimize is the embedding model — compare OpenAI, Cohere, and local options.",
      },
      {
        id: "rs-4",
        label: "Estimate infrastructure costs for RAG pipeline",
        description:
          "Before sprint planning, get a cost estimate for the vector DB, embedding compute, and retrieval layer at 50K doc scale.",
      },
      {
        id: "rs-5",
        label: "Compare vector database options",
        description:
          "Pinecone, Weaviate, and pgvector are the main candidates. Run a quick comparison on cost, latency, and managed vs self-hosted.",
      },
    ],
    outputFiles: [
      {
        name: "Memory Architecture Survey.doc",
        type: "document",
        createdAt: "3h",
      },
      {
        name: "RAG vs Fine-tuning Comparison.doc",
        type: "document",
        createdAt: "1d",
      },
      { name: "Benchmark Results.csv", type: "spreadsheet", createdAt: "2d" },
    ],
    sessions: [
      {
        id: "s-8",
        title: "Agent memory architectures",
        updatedAt: "3h",
        unread: true,
        cost: "$1.23",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Summarize the key papers I've been reading on agent memory architectures.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.researchBot,
            content:
              "Based on your bookmarked papers, here are the highlights:\n\n1. Retrieval-Augmented Generation (RAG) at scale\n- Chunking strategy matters more than embedding model choice\n- Hybrid search (semantic + keyword) consistently outperforms pure vector search\n\n2. Long-context retrieval patterns\n- Claude 4's memory API supports structured recall with relevance scoring\n- Key insight: episodic memory (conversations) + semantic memory (facts) need different retrieval strategies\n\n3. Agent memory consolidation\n- Short-term working memory → long-term storage requires active summarization\n- Forgetting is a feature: agents that prune aggressively outperform those that remember everything\n\nI've saved the survey to your research files.",
            artifact: {
              name: "Memory Architecture Survey.doc",
              type: "document",
            },
            mcpServers: [
              {
                name: "Arxiv",
                server: "arxiv-mcp",
                action: "Read bookmarked research papers",
              },
              {
                name: "Pinecone",
                server: "pinecone-mcp",
                action: "Read vector embedding benchmarks",
              },
            ],
            actions: [
              "Compare RAG vs fine-tuning",
              "Share with team",
              "Dig deeper",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "Compare RAG vs fine-tuning for our use case — enterprise knowledge base with 50K docs.",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.researchBot,
            content:
              "Here's the comparison for a 50K document knowledge base. RAG has low setup cost (index docs, deploy retriever), minutes for update latency (re-index changed docs), high factual accuracy (retrieves source docs), medium reasoning depth (limited by context window), $0.02-0.05 per query, and high explainability (can cite source chunks). Fine-tuning has high setup cost (curate training data, train model), days for updates (retrain or LoRA), medium accuracy (can hallucinate facts), higher reasoning depth (internalizes domain patterns), $0.01-0.03 per query, and low explainability (black box).\n\nRecommendation: start with RAG. 50K docs is well within retrieval limits, you need fast updates (docs change weekly), and citing sources is critical for enterprise trust. Fine-tuning makes sense later to improve retrieval ranking.\n\nSaved the comparison.",
            artifact: {
              name: "RAG vs Fine-tuning Comparison.doc",
              type: "document",
            },
            actions: [
              "Run chunking benchmarks",
              "Draft implementation RFC",
              "Share with team",
            ],
          },
          {
            id: "m5",
            role: "user",
            content:
              "Run benchmarks on chunking strategies — compare fixed-size, semantic, and recursive splitting.",
          },
          {
            id: "m6",
            role: "assistant",
            bot: BOTS.analyst,
            content:
              "Benchmarks against your 200-question test suite: fixed 512 tokens got 72% recall / 58% precision at 45ms (fast but misses context boundaries), fixed 1024 got 68% / 62% at 52ms, semantic paragraph-based got 81% / 71% at 68ms (best overall, respects content structure), recursive splitting got 79% / 73% at 71ms, and hybrid semantic with 20% overlap won at 84% / 74% at 75ms.\n\nWinner: hybrid semantic chunking with 20% overlap. It captures context spanning paragraph boundaries without the noise of fixed-size chunks. The 30ms latency premium over fixed chunking is negligible at query time. Saved the full benchmark results.",
            artifact: {
              name: "Benchmark Results.csv",
              type: "spreadsheet",
            },
            tasks: [
              { label: "Loaded 50K document corpus", status: "completed" },
              {
                label: "Generated 5 chunking strategies",
                status: "completed",
              },
              {
                label: "Ran 200 test queries per strategy",
                status: "completed",
              },
              {
                label: "Computed recall and precision metrics",
                status: "completed",
              },
            ],
            mcpServers: [
              {
                name: "Pinecone",
                server: "pinecone-mcp",
                action: "Read chunking strategy benchmark results",
              },
            ],
            actions: [
              "Draft implementation RFC",
              "Test with production data",
              "Share results",
            ],
          },
        ],
      },
      {
        id: "s-37",
        title: "Vector database comparison",
        updatedAt: "1d",
        unread: false,
        cost: "$0.47",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Compare Pinecone, Weaviate, and pgvector for our RAG pipeline. We need something that scales to 50K docs and works with our existing Postgres stack.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.researchBot,
            content:
              "Comparison: Pinecone is managed-only with 12ms p50 latency, 20K max dimensions, metadata filters, ~$70/mo for 50K docs, no ops burden. Weaviate is self-hosted or cloud, 18ms latency, unlimited dimensions, GraphQL + hybrid filtering, free if self-hosted but medium ops burden. pgvector lives in your existing Postgres, 25ms latency, 2K max dimensions, SQL WHERE clauses, free, and low ops burden.\n\nRecommendation: pgvector. At 50K docs the performance gap is negligible, you avoid a new dependency, and your team already knows Postgres. Pinecone only makes sense past 1M docs or if you need sub-10ms latency.\n\nWant me to draft the pgvector schema?",
            mcpServers: [
              {
                name: "Pinecone",
                server: "pinecone-mcp",
                action: "Read latency benchmarks and pricing tiers",
              },
            ],
            actions: [
              "Draft pgvector schema",
              "Compare costs",
              "Share with team",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "Yes, draft the pgvector schema. We need to store document chunks with metadata for filtering.",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.researchBot,
            content:
              "Here's the schema:\n\n```sql\nCREATE EXTENSION IF NOT EXISTS vector;\n\nCREATE TABLE document_chunks (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  document_id UUID NOT NULL REFERENCES documents(id),\n  content TEXT NOT NULL,\n  embedding vector(1536),\n  chunk_index INTEGER NOT NULL,\n  metadata JSONB DEFAULT '{}',\n  created_at TIMESTAMPTZ DEFAULT now()\n);\n\nCREATE INDEX idx_chunks_embedding\n  ON document_chunks\n  USING ivfflat (embedding vector_cosine_ops)\n  WITH (lists = 100);\n\nCREATE INDEX idx_chunks_document\n  ON document_chunks (document_id);\n\nCREATE INDEX idx_chunks_metadata\n  ON document_chunks USING gin (metadata);\n```\n\nQuery example:\n```sql\nSELECT content, 1 - (embedding <=> $1) AS similarity\nFROM document_chunks\nWHERE metadata->>'team' = 'engineering'\nORDER BY embedding <=> $1\nLIMIT 5;\n```\n\nNotes:\n- `ivfflat` index with 100 lists is optimal for 50K docs. Switch to `hnsw` if you go past 500K.\n- 1536 dimensions matches OpenAI `text-embedding-3-small`. Adjust if using a different model.\n- The `metadata` JSONB column lets you filter by team, project, doc type, etc. without schema changes.\n\nSaved the schema file.",
            artifact: { name: "Vector DB Schema.doc", type: "document" },
            actions: [
              "Create migration script",
              "Run load test",
              "Open Jira ticket",
            ],
          },
        ],
      },
      {
        id: "s-38",
        title: "Prompt engineering patterns",
        updatedAt: "4d",
        unread: false,
        cost: "$1.56",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Catalog the prompt engineering patterns we're using across our agent implementations. I want to standardize our approach.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.researchBot,
            content:
              "6 patterns currently in use across your agents: system prompt layering (base personality, domain context, task instructions, output format — used in support and docs agents), chain-of-thought with verification (step-by-step reasoning with self-check — code review agent), few-shot with dynamic examples (examples from vector store based on query similarity — sales email drafter), tool-use orchestration (system prompt defines available tools and when to use each — data pipeline agent), guardrail sandwich (safety instructions at start and end of system prompt — customer-facing agents), and persona switching (different system prompts for different conversation phases — onboarding agent).\n\nPatterns 1, 4, and 5 should be standardized across all agents. Want me to draft the style guide?",
            mcpServers: [
              {
                name: "Pinecone",
                server: "pinecone-mcp",
                action: "Read agent prompt configurations",
              },
            ],
            actions: [
              "Draft style guide",
              "Share with team",
              "Create templates",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "Yes, draft the style guide. Focus on the patterns we should enforce vs. recommend.",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.researchBot,
            content:
              "Here's the Prompt Engineering Style Guide:\n\nREQUIRED (enforce in code review):\n\n1. System prompt layering — Every agent must use the standard 4-layer format:\n   - Layer 1: Base personality and tone\n   - Layer 2: Domain context (who the user is, what they're working on)\n   - Layer 3: Task instructions (what to do, constraints)\n   - Layer 4: Output format (markdown, JSON, etc.)\n\n2. Guardrail sandwich — All customer-facing agents must have safety instructions at both the start AND end of the system prompt. This prevents prompt injection from overriding safety constraints.\n\n3. Tool-use orchestration — Agents with tools must explicitly declare when to use each tool. No open-ended \"use whatever tools are available.\"\n\nRECOMMENDED (use when applicable):\n\n4. Chain-of-thought — For complex reasoning tasks (code review, data analysis). Not needed for simple Q&A.\n\n5. Few-shot examples — For tasks where output format matters (email drafting, report generation). Dynamic examples from vector store preferred over static.\n\n6. Persona switching — Only for multi-phase workflows (onboarding, sales discovery). Overcomplicates simple agents.\n\nI've included template prompts for each pattern. Saved as the style guide.",
            artifact: {
              name: "Prompt Engineering Style Guide.doc",
              type: "document",
            },
            actions: [
              "Share with team",
              "Add to onboarding",
              "Create linter rule",
            ],
          },
        ],
      },
      {
        id: "s-39",
        title: "Evaluation framework for agents",
        updatedAt: "1w",
        unread: false,
        cost: "$3.41",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "We need a framework for evaluating agent quality. How do we measure if an agent is actually good?",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.researchBot,
            content:
              "Here's a 4-dimension evaluation framework:\n\n1. Task completion rate\nDid the agent accomplish what was asked? Measured by human review on a sample of 100 interactions/week.\n- Target: >90% full completion, <5% failure\n\n2. Tool efficiency\nHow many tool calls to complete a task? Fewer is better — it means the agent is making good decisions.\n- Target: <3 tool calls per task on average\n\n3. Response quality (LLM-as-judge)\nUse a separate model to grade responses on accuracy, helpfulness, and tone. Cheaper than human eval at scale.\n- Target: >4.0/5.0 average score\n\n4. User satisfaction\nThumbsup/down on responses + monthly NPS survey of power users.\n- Target: >80% positive, NPS >40\n\nAutomated pipeline: Run evals nightly against a golden dataset of 200 test cases. Alert on regressions >5% on any dimension.\n\nWant me to set up the eval pipeline?",
            actions: [
              "Set up eval pipeline",
              "Create test cases",
              "Share with team",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "Set up the eval pipeline. What does the architecture look like?",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.analyst,
            content:
              'Here\'s the eval pipeline architecture:\n\nNightly run (2 AM UTC):\n1. Test harness pulls 200 golden test cases from a YAML file in the repo\n2. Each test case has: input prompt, expected behavior, and scoring criteria\n3. Agent runner executes each test case against the latest agent version\n4. LLM judge (Claude Haiku — cheap, fast) scores each response on accuracy, helpfulness, and tone\n5. Metrics collector computes aggregate scores across all 4 dimensions\n6. Alert system posts to #agent-quality if any dimension drops >5% from baseline\n\nGolden test case format:\n```yaml\n- id: tc-001\n  input: "What\'s our current ARR?"\n  expected_tools: ["salesforce_query"]\n  expected_behavior: "Returns current ARR figure with source"\n  scoring:\n    accuracy: "Must match Salesforce data within 24h"\n    tone: "Professional, concise"\n```\n\nDashboard: A Grafana board showing eval scores over time, per agent and per dimension. Regressions are immediately visible.\n\nCost: ~$2/night at 200 test cases using Haiku as the judge. Negligible.\n\nI\'ve saved the pipeline spec. Want me to create the first 50 test cases for the support agent?',
            artifact: { name: "Eval Pipeline Spec.doc", type: "document" },
            actions: [
              "Create first test cases",
              "Open Jira ticket",
              "Schedule review",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "f-6",
    name: "Events",
    summary:
      "Coordinating the Q2 AI Hackathon (June 12-14) and upcoming developer meetups. Hackathon planning is 80% complete — venue confirmed, judging rubric finalized, 47 participants registered. Sponsor outreach for three remaining slots is in progress.",
    suggestions: [
      {
        id: "ev-1",
        label: "Draft the hackathon announcement email",
        description:
          "Send invitations with event details and registration link.",
      },
      {
        id: "ev-2",
        label: "Finalize sponsor packages",
        description:
          "Three sponsor slots remaining — prepare outreach materials.",
      },
      {
        id: "ev-3",
        label: "Create the day-of logistics checklist",
        description: "AV setup, catering, badge printing, mentor scheduling.",
      },
      {
        id: "ev-4",
        label: "Set up the participant Slack channel",
        description:
          "Create a channel for pre-event communication and team formation.",
      },
    ],
    outputFiles: [
      { name: "Hackathon Plan.doc", type: "document", createdAt: "6h" },
      { name: "Judging Rubric.csv", type: "spreadsheet", createdAt: "22h" },
      { name: "Participant List.csv", type: "spreadsheet", createdAt: "1d" },
      { name: "Budget Tracker.csv", type: "spreadsheet", createdAt: "2d" },
      { name: "Venue Options.doc", type: "document", createdAt: "3d" },
      { name: "Sponsor Outreach.doc", type: "document", createdAt: "4d" },
    ],
    sessions: [
      {
        id: "s-9",
        title: "AI hackathon planning",
        updatedAt: "22h",
        unread: true,
        cost: "$0.53",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Help me plan the Q2 AI hackathon. 3 days, focused on agent-powered tools.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.eventBot,
            content:
              "Here's a draft plan for the Q2 AI Hackathon:\n\nDates: June 12-14 (Thu-Sat)\nVenue: Confirmed — Building C, floors 3-4\n\nCategories:\n1. Developer Productivity — tools that help engineers ship faster\n2. Customer Support Automation — agent-powered ticket resolution\n3. Internal Ops — automating repetitive back-office workflows\n\nJudging criteria:\n- Impact potential (30%)\n- Technical creativity (25%)\n- Demo quality (25%)\n- Feasibility for production (20%)\n\nTimeline:\n- Day 1: Kickoff + team formation + hacking\n- Day 2: Full hacking day, mentor office hours\n- Day 3: Morning polish, afternoon demos + judging\n\nI've saved this to `hackathon-planning.md`. Should I draft the sign-up form and announcement email?",
            mcpServers: [
              {
                name: "Google Calendar",
                server: "gcal-mcp",
                action: "Read venue availability and event dates",
              },
            ],
            actions: ["Draft announcement", "Send invites", "Book venue"],
          },
          {
            id: "m3",
            role: "user",
            content:
              "Yes, draft the announcement email. Keep it exciting but brief.",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.eventBot,
            content:
              "Here's the draft:\n\nSubject: Build the future in 3 days — Q2 AI Hackathon is here\n\n> Hey team,\n>\n> It's time. June 12-14, we're taking over Building C for three days of building, breaking, and shipping agent-powered tools.\n>\n> Three categories. One goal: build something that makes us better.\n>\n> Whether you want to automate support tickets, supercharge your dev workflow, or eliminate that spreadsheet you've been manually updating for months — this is your chance.\n>\n> No experience with AI required. Bring a problem, we'll help you build the solution.\n>\n> [Sign up here →]\n>\n> Teams of 2-5. Solo hackers welcome — we'll help you find a team on Day 1.\n>\n> See you there.\n\nWant me to send this to the events mailing list?",
            mcpServers: [
              {
                name: "Eventbrite",
                server: "eventbrite-mcp",
                action: "Read registration page and signup count",
              },
            ],
            actions: [
              "Send to mailing list",
              "Share on Slack",
              "Add to calendar",
            ],
          },
        ],
      },
      {
        id: "s-10",
        title: "Hackathon judging rubric",
        updatedAt: "2d",
        unread: false,
        cost: "$0.02",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Expand the judging criteria into a detailed rubric with scoring guidelines for each category.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.eventBot,
            content:
              "Here's the detailed judging rubric (each category scored 1-5):\n\nImpact Potential (30%)\n- 5: Solves a painful, widespread problem with clear ROI\n- 3: Useful improvement to an existing workflow\n- 1: Interesting technically but unclear real-world value\n\nTechnical Creativity (25%)\n- 5: Novel approach, clever use of agent capabilities\n- 3: Solid implementation of known patterns\n- 1: Basic integration with minimal agent functionality\n\nDemo Quality (25%)\n- 5: Polished, working end-to-end demo with edge cases handled\n- 3: Core flow works, some rough edges\n- 1: Mostly slides or broken demo\n\nProduction Feasibility (20%)\n- 5: Could ship to users within 2 weeks with minor polish\n- 3: Needs 1-2 months of engineering to be production-ready\n- 1: Proof of concept only, significant rework needed\n\nTotal score = weighted sum, max 5.0. Want me to create a scoring spreadsheet for the judges?",
            actions: [
              "Create scoring sheet",
              "Share with judges",
              "Add to agenda",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              'Yes, create the scoring spreadsheet. Also add a "people\'s choice" category.',
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.planningBot,
            content:
              "Done — here's the scoring setup:\n\nJudge Scorecard (per team):\n- 5 judges, each scores all 4 dimensions\n- Scores are averaged across judges, then weighted\n- Ties broken by Impact Potential score\n\nPeople's Choice Award:\n- All attendees (not just judges) vote for their favorite\n- One vote per person, submitted via a Google Form after demos\n- Separate from the technical categories — a team can win both\n- Prize: $500 + \"Fan Favorite\" trophy\n\nUpdated prize structure:\n- 1st place per category: $1,500\n- 2nd place per category: $1,000\n- 3rd place per category: $500\n- People's Choice: $500\n- Total: $9,500 (within the $15K budget)\n\nThe spreadsheet auto-calculates weighted scores and rankings. I've set up a tab per judge plus a summary tab. Ready to share with the judging panel.",
            artifact: { name: "Judging Rubric.csv", type: "spreadsheet" },
            mcpServers: [
              {
                name: "Google Calendar",
                server: "gcal-mcp",
                action: "Read judge availability and schedules",
              },
            ],
            actions: ["Share with judges", "Update budget", "Send invites"],
          },
        ],
      },
      {
        id: "s-40",
        title: "Sponsor outreach emails",
        updatedAt: "5d",
        unread: false,
        cost: "$0.24",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Draft sponsor outreach emails for the hackathon. We want to approach AWS, Anthropic, and Vercel for sponsorship.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.eventBot,
            content:
              "Here are three tailored outreach drafts:\n\nAWS:\n> Subject: Sponsorship opportunity — AI Agent Hackathon (200+ devs)\n>\n> We're hosting a 3-day AI hackathon focused on agent-powered tools. 200+ developers building on cloud infrastructure. Would love to offer AWS credits as prizes and feature your team as a sponsor.\n>\n> Sponsorship includes: logo placement, a 10-min demo slot, and access to participants for recruiting.\n\nAnthropic:\n> Subject: Partner with us on an agent-focused hackathon\n>\n> Our Q2 hackathon theme is agent-powered tools — Claude is already our team's go-to. We'd love to offer API credits to participants and have your team mentor during office hours.\n\nVercel:\n> Subject: Hackathon sponsorship — ship agent-powered apps on Vercel\n>\n> Most of our hackathon teams will deploy on Vercel. We'd love to co-sponsor with Pro tier credits and a \"Best Deployment\" category.\n\nWant me to personalize these with specific contact names from your network?",
            artifact: {
              name: "Sponsor Outreach.doc",
              type: "document",
            },
            actions: [
              "Send outreach emails",
              "Personalize contacts",
              "Set follow-up reminders",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "Anthropic replied — they're interested but want to know our sponsor tiers. Draft a package.",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.eventBot,
            content:
              'Here\'s a 3-tier package:\n\nGold ($5,000): Logo on all materials, 15-min keynote, dedicated booth, 5 mentor slots, named category sponsor (e.g., "Best Agent — powered by Anthropic")\n\nSilver ($2,500): Logo on materials, 10-min demo, 3 mentor slots, co-branded swag\n\nBronze ($1,000): Logo on website, 1 mentor slot, opening ceremony shoutout\n\nFor Anthropic, I\'d pitch Gold with the named category — "Best AI Agent powered by Claude" gives them brand association with winning projects.\n\nWant me to send this to their DevRel contact?',
            actions: [
              "Send to Anthropic",
              "Update budget",
              "Draft Gold package",
            ],
          },
          {
            id: "m5",
            role: "user",
            content:
              "Send it. AWS also got back — they want Gold tier. Update the budget.",
          },
          {
            id: "m6",
            role: "assistant",
            bot: BOTS.planningBot,
            content:
              "Sent to Anthropic's DevRel team.\n\nBudget updated with AWS Gold:\n\n| Category | Original | Updated |\n|----------|----------|---------|\n| Expenses | $15,000 | $16,500 |\n| Sponsor revenue | $0 | -$5,000 |\n| Net cost | $15,000 | $11,500 |\n\nIf Anthropic comes in at Gold too, net cost drops to $6,500 — frees up budget for video production of the demos or a nicer after-party. I'll update when we hear back.",
            mcpServers: [
              {
                name: "Eventbrite",
                server: "eventbrite-mcp",
                action: "Read sponsor registration confirmations",
              },
            ],
          },
        ],
      },
      {
        id: "s-41",
        title: "Venue logistics and budget",
        updatedAt: "1w",
        unread: false,
        cost: "$1.23",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Break down the hackathon budget. We have $15K approved. Also need to finalize catering and A/V setup.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.eventBot,
            content:
              "Here's the budget breakdown:\n\n| Category | Cost | Notes |\n|----------|------|-------|\n| Catering (3 days) | $6,500 | Breakfast + lunch + snacks for 200 |\n| Prizes | $3,000 | $1,500 / $1,000 / $500 per category |\n| A/V rental | $2,200 | Projectors, mics, streaming setup |\n| Swag (t-shirts) | $1,800 | 200 shirts @ $9 each |\n| Miscellaneous | $1,500 | Power strips, signage, supplies |\n| Total | $15,000 | On budget |\n\nCatering confirmed: Bay Area Bites — they did our last offsite and were great.\n\nA/V setup:\n- Main stage: 2 projectors + wireless mic for demos\n- 4 breakout rooms with monitors for team work\n- Livestream to #hackathon-live in Slack for remote folks\n\nVenue (Building C) is free since it's our space. Want me to send the catering order?",
            artifact: {
              name: "Budget Tracker.csv",
              type: "spreadsheet",
            },
            mcpServers: [
              {
                name: "Google Calendar",
                server: "gcal-mcp",
                action: "Read past event budgets and vendor contacts",
              },
              {
                name: "Eventbrite",
                server: "eventbrite-mcp",
                action: "Read participant registration count",
              },
            ],
            actions: ["Send catering order", "Book AV rental", "Share budget"],
          },
          {
            id: "m3",
            role: "user",
            content:
              "Bay Area Bites is $500 over what we used last time. Can we negotiate or find alternatives?",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.eventBot,
            content:
              "The increase is because we jumped from 120 to 200 attendees. Per-person cost actually went down ($32.50 vs $37 last time).\n\nOptions to reduce:\n1. Negotiate: Ask for 10% off for repeat business → saves $650. They've given this before.\n2. Drop Day 1 breakfast (people arrive at different times anyway) → saves $800\n3. Switch to a taco truck for Day 2 lunch → saves $400 and adds novelty\n\nAlternative caterers:\n- FoodieBox: $5,800 (cheaper but they only do boxed lunches — less energy)\n- Local Harvest: $6,200 (good quality, no breakfast option)\n\nMy recommendation: stick with Bay Area Bites, ask for the repeat-business discount, and drop Day 1 breakfast. Net savings: ~$1,450, bringing catering to $5,050.\n\nWant me to send the negotiation email?",
            actions: [
              "Send negotiation email",
              "Try alternative caterer",
              "Update budget",
            ],
          },
          {
            id: "m5",
            role: "user",
            content:
              "Go with the repeat discount and keep breakfast — people expect it. Send the order.",
          },
          {
            id: "m6",
            role: "assistant",
            bot: BOTS.eventBot,
            content:
              "Sent the order to Bay Area Bites with the repeat-business discount request. Expected final cost: ~$5,850 (down from $6,500).\n\nUpdated budget with the savings:\n\n| Category | Original | Revised |\n|----------|----------|---------|\n| Catering | $6,500 | $5,850 |\n| Everything else | $8,500 | $8,500 |\n| Total | $15,000 | $14,350 |\n| Buffer | $0 | $650 |\n\nThat $650 buffer is nice to have — last hackathon we had unexpected costs for extra power strips and an emergency monitor replacement. I'll confirm the order once they accept the discount (usually same-day reply).",
          },
        ],
      },
    ],
  },
  {
    id: "f-7",
    name: "Infrastructure",
    summary:
      "Active infrastructure workstreams: EKS 1.28→1.30 migration (planning phase), Terraform module refactor, and ongoing cost optimization. Identified $4,200/mo in AWS savings. Recent API outage (47 min) traced to misconfigured HPA threshold — postmortem published.",
    status: undefined,
    memories: [
      {
        id: "im-1",
        content:
          "EKS migration requires auditing deprecated APIs before cutover. Blue-green deployment strategy selected.",
        source: "K8s cluster migration plan chat",
        updatedAt: "4h ago",
      },
      {
        id: "im-2",
        content:
          "AWS cost savings identified: reserved instances, unused EBS volumes, and right-sizing EC2 instances. Total $4,200/mo.",
        source: "Cost optimization review chat",
        updatedAt: "3d ago",
      },
      {
        id: "im-3",
        content:
          "Monday's 47-minute API outage was caused by a misconfigured HPA threshold. Postmortem complete.",
        source: "Incident postmortem chat",
        updatedAt: "5d ago",
      },
    ],
    recentActions: [
      {
        id: "ia-1",
        description: "Drafted EKS 1.28→1.30 migration plan with phased cutover",
        actor: "Claude",
        timestamp: "4h ago",
      },
      {
        id: "ia-2",
        description:
          "Proposed Terraform restructure: networking, compute, data, observability modules",
        actor: "Claude",
        timestamp: "1d ago",
      },
      {
        id: "ia-3",
        description: "Found $4,200/mo in AWS cost savings across 3 categories",
        actor: "Claude",
        timestamp: "3d ago",
      },
      {
        id: "ia-4",
        description:
          "Wrote postmortem for Monday's API outage (HPA misconfiguration)",
        actor: "Claude",
        timestamp: "5d ago",
      },
    ],
    suggestions: [
      {
        id: "is-1",
        label: "Schedule EKS migration window",
        description:
          "Migration plan is drafted. Coordinate with the team to pick a maintenance window for the blue-green cutover.",
      },
      {
        id: "is-2",
        label: "Implement RI purchases",
        description:
          "The $4,200/mo savings are identified but not yet actioned. Reserved instance purchases need finance approval.",
      },
      {
        id: "is-3",
        label: "Add HPA alerting",
        description:
          "The outage was caused by a misconfigured HPA threshold. Adding alerts for scaling anomalies would catch this earlier.",
      },
      {
        id: "is-4",
        label: "Audit deprecated K8s APIs before migration",
        description:
          "EKS 1.30 removes several beta APIs. Run a compatibility scan to identify breaking changes before the cutover window.",
      },
      {
        id: "is-5",
        label: "Create Terraform PR for module split",
        description:
          "The networking/compute/data/observability module structure is agreed. Create the PR to unblock dependent infra work.",
      },
    ],
    outputFiles: [
      { name: "EKS Migration Plan.doc", type: "document", createdAt: "4h" },
      { name: "Terraform Module Map.doc", type: "document", createdAt: "1d" },
      {
        name: "AWS Cost Savings Report.csv",
        type: "spreadsheet",
        createdAt: "3d",
      },
      { name: "API Outage Postmortem.doc", type: "document", createdAt: "4d" },
      { name: "CDN Strategy Guide.doc", type: "document", createdAt: "5d" },
      { name: "HPA Config Audit.csv", type: "spreadsheet", createdAt: "6d" },
      {
        name: "Deprecated API Inventory.csv",
        type: "spreadsheet",
        createdAt: "1w",
      },
      { name: "Blue-Green Runbook.doc", type: "document", createdAt: "1w" },
      { name: "RI Purchase Approval.doc", type: "document", createdAt: "2w" },
    ],
    sessions: [
      {
        id: "s-11",
        title: "K8s cluster migration plan",
        updatedAt: "4h",
        unread: true,
        cost: "$0.74",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Draft a migration plan for EKS 1.28 to 1.30. We need to do this with zero downtime.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.infraBot,
            content:
              "Here's the phased migration plan:\n\nPhase 1: Audit (Week 1)\n- Run `kubectl deprecations` against all manifests\n- Identify deprecated APIs: `extensions/v1beta1`, `networking.k8s.io/v1beta1`\n- Scan Helm charts for hardcoded API versions\n- Estimated impact: 12 manifests need updating\n\nPhase 2: Prep (Week 2)\n- Update all manifests to use stable APIs\n- Test in staging cluster (already on 1.30)\n- Update Helm chart templates\n- Verify all admission webhooks are compatible\n\nPhase 3: Blue-Green Cutover (Week 3)\n- Spin up new 1.30 node group alongside existing 1.28 nodes\n- Cordon and drain 1.28 nodes gradually\n- Monitor pod scheduling and health checks\n- Rollback plan: re-enable 1.28 nodes if issues detected\n\nPhase 4: Cleanup (Week 4)\n- Decommission 1.28 node group\n- Update CI/CD to target 1.30\n- Document changes for the team\n\nTotal timeline: 4 weeks. Want me to create the Jira tickets?",
            artifact: { name: "EKS Migration Plan.doc", type: "document" },
            tasks: [
              {
                label: "Scanned current cluster API usage",
                status: "completed",
              },
              {
                label: "Identified 12 deprecated manifests",
                status: "completed",
              },
              { label: "Generated migration timeline", status: "completed" },
            ],
            mcpServers: [
              {
                name: "AWS EKS",
                server: "aws-eks-mcp",
                action: "Read cluster config and node groups",
              },
              {
                name: "Kubernetes",
                server: "k8s-mcp",
                action: "Read API deprecation status",
              },
            ],
            actions: [
              "Create Jira tickets",
              "Schedule maintenance",
              "Run audit",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "What's the rollback plan if something goes wrong during cutover?",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.securityBot,
            content:
              "Here's the detailed rollback procedure:\n\nTrigger criteria (any of these):\n- Pod failure rate >5% for 10 minutes\n- API server latency >500ms p99\n- Any critical service health check failing\n\nRollback steps (estimated: 8 minutes):\n1. Uncordon all 1.28 nodes: `kubectl uncordon -l kubernetes.io/version=1.28`\n2. Cordon all 1.30 nodes to stop new scheduling\n3. Drain 1.30 nodes with `--grace-period=30`\n4. Verify all pods rescheduled to 1.28 nodes\n5. Page on-call and post in #incidents\n\nKey safeguard: We keep 1.28 nodes running for 48 hours after cutover before decommissioning. This gives us a warm rollback path without reprovisioning.\n\nI've also added PodDisruptionBudgets to all critical services so the drain respects availability requirements. Want me to update the migration doc with this?",
            actions: [
              "Update migration doc",
              "Create runbook",
              "Schedule review",
            ],
          },
        ],
      },
      {
        id: "s-12",
        title: "Terraform module refactor",
        updatedAt: "1d",
        unread: false,
        cost: "$0.53",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Our Terraform is a mess — one giant module with 2,400 lines. Suggest a better structure.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.infraBot,
            content:
              "Here's a proposed module structure:\n\n```\ninfra/\n├── modules/\n│   ├── networking/     # VPC, subnets, security groups, NAT\n│   ├── compute/        # EKS, node groups, ASGs\n│   ├── data/           # RDS, ElastiCache, S3 buckets\n│   └── observability/  # CloudWatch, Grafana, alerting\n├── environments/\n│   ├── staging/        # tfvars + backend config\n│   └── production/     # tfvars + backend config\n└── shared/             # IAM roles, KMS keys, DNS\n```\n\nBenefits:\n- Each module is independently plannable and applyable\n- Blast radius is limited — a networking change can't accidentally touch the database\n- Teams can own specific modules\n- Staging and production share the same module code, different variables\n\nMigration approach: Extract one module at a time using `terraform state mv`. Start with networking since it has the fewest dependencies.\n\nWant me to create the directory structure and start with the networking module?",
            artifact: { name: "Terraform Module Map.doc", type: "document" },
            mcpServers: [
              {
                name: "AWS",
                server: "aws-mcp",
                action: "Read Terraform state and resource inventory",
              },
            ],
            actions: [
              "Create directory structure",
              "Open Jira ticket",
              "Share with team",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "Yes, start with networking. What resources move into that module?",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.infraBot,
            content:
              "Here are the 14 resources moving to the networking module:\n\nVPC & Subnets:\n- `aws_vpc.main`\n- `aws_subnet.public[0-2]` (3 AZs)\n- `aws_subnet.private[0-2]` (3 AZs)\n\nRouting:\n- `aws_internet_gateway.main`\n- `aws_nat_gateway.main`\n- `aws_route_table.public`\n- `aws_route_table.private`\n- `aws_route_table_association` (6 total)\n\nSecurity:\n- `aws_security_group.alb`\n- `aws_security_group.eks_nodes`\n\nModule outputs (consumed by compute and data modules):\n- `vpc_id`\n- `public_subnet_ids`\n- `private_subnet_ids`\n- `eks_node_sg_id`\n\nI've drafted the `terraform state mv` commands. The key risk is the security group references — compute and data modules will need to import these as data sources or accept them as variables. I'd recommend the variable approach for cleaner dependency management.\n\nReady to generate the state move script?",
            mcpServers: [
              {
                name: "AWS",
                server: "aws-mcp",
                action: "Read VPC, subnet, and security group configurations",
              },
            ],
          },
        ],
      },
      {
        id: "s-13",
        title: "Cost optimization review",
        updatedAt: "3d",
        unread: false,
        cost: "$0.18",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Review our AWS spend for the last 3 months. We're over budget and I need to find savings before the finance review.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.infraBot,
            content:
              'I\'ve analyzed your AWS Cost Explorer data for the last 90 days:\n\nTotal spend: $47,200/mo (budget: $42,000/mo — 12% over)\n\nTop 3 savings opportunities:\n\n| Category | Current | Savings | Action |\n|----------|---------|---------|--------|\n| EC2 Reserved Instances | $18,400/mo | $2,200/mo | Convert 8 on-demand to 1-year RI |\n| Unused EBS volumes | $890/mo | $890/mo | 23 unattached volumes — delete |\n| Right-size EC2 | $12,100/mo | $1,100/mo | 6 instances running <15% CPU |\n| Total | | $4,190/mo | |\n\nAdditional findings:\n- 4 stopped instances still incurring EBS charges ($340/mo)\n- NAT Gateway data transfer is 3x higher than expected — likely a misconfigured service\n- CloudWatch log retention set to "never" — switch to 30 days saves ~$180/mo\n\nThe RI purchases alone get you back under budget. Want me to generate the purchase orders?',
            artifact: {
              name: "AWS Cost Savings Report.csv",
              type: "spreadsheet",
            },
            tasks: [
              {
                label: "Pulled 90-day Cost Explorer data",
                status: "completed",
              },
              {
                label: "Analyzed EC2 utilization metrics",
                status: "completed",
              },
              {
                label: "Identified unattached EBS volumes",
                status: "completed",
              },
              { label: "Calculated RI savings", status: "completed" },
            ],
            mcpServers: [
              {
                name: "AWS",
                server: "aws-mcp",
                action: "Read Cost Explorer and EC2 utilization data",
              },
              {
                name: "Datadog",
                server: "datadog-mcp",
                action: "Read infrastructure utilization metrics",
              },
            ],
            actions: [
              "Generate purchase orders",
              "Delete unused volumes",
              "Share report",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "What's the deal with the NAT Gateway charges? That seems like the biggest surprise.",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.infraBot,
            content:
              'Good catch — I dug into the NAT Gateway traffic:\n\nNAT Gateway spend: $2,840/mo (up from $900/mo in January)\n\nRoot cause: The batch processing service (`data-pipeline-worker`) is pulling S3 data through the NAT Gateway instead of using a VPC endpoint. Every batch job downloads 2-4GB from S3, and it runs 60x/day.\n\nThe math:\n- 60 jobs × 3GB avg × $0.045/GB = $8.10/day through NAT\n- With S3 VPC endpoint: $0 (free for gateway endpoints)\n- Monthly savings: ~$240 in data transfer + reduced NAT processing fees\n\nFix: Add an S3 VPC Gateway Endpoint to the private subnets. It\'s a one-line Terraform change:\n```hcl\nresource "aws_vpc_endpoint" "s3" {\n  vpc_id       = aws_vpc.main.id\n  service_name = "com.amazonaws.us-west-2.s3"\n}\n```\n\nThe remaining NAT increase ($1,700) is legitimate growth — more API calls to external services. That\'s proportional to the user growth we\'ve seen.\n\nWant me to create the PR for the VPC endpoint?',
            mcpServers: [
              {
                name: "AWS",
                server: "aws-mcp",
                action: "Read NAT Gateway traffic flow logs",
              },
            ],
          },
        ],
      },
      {
        id: "s-14",
        title: "Incident postmortem — API outage",
        updatedAt: "5d",
        unread: false,
        cost: "$0.31",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Write the postmortem for Monday's API outage. It was 47 minutes of downtime.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.infraBot,
            content:
              "Here's the postmortem:\n\n# Incident Postmortem: API Outage — April 28, 2026\n\nDuration: 47 minutes (14:23–15:10 UTC)\nSeverity: SEV-1\nImpact: All API requests returned 503. ~12,000 requests failed. 340 unique users affected.\n\nTimeline:\n- 14:23 — PagerDuty alert: API error rate >50%\n- 14:28 — On-call confirms all API pods are in CrashLoopBackOff\n- 14:35 — Root cause identified: HPA scaled pods to 0 due to misconfigured `minReplicas`\n- 14:42 — Manual scale-up initiated: `kubectl scale deployment api --replicas=4`\n- 14:50 — Pods healthy, traffic restoring\n- 15:10 — Error rate back to baseline, incident resolved\n\nRoot cause:\nA config change on Friday set HPA `minReplicas: 0` instead of `minReplicas: 2`. During a low-traffic window Monday afternoon, HPA scaled to zero. When traffic returned, there were no pods to serve requests.\n\nContributing factors:\n- No validation on HPA minReplicas in CI\n- The config change wasn't reviewed by an infra engineer\n- No alert for \"zero ready pods\" on critical deployments",
            artifact: { name: "API Outage Postmortem.doc", type: "document" },
            mcpServers: [
              {
                name: "Datadog",
                server: "datadog-mcp",
                action: "Read incident timeline and error rate metrics",
              },
              {
                name: "AWS",
                server: "aws-mcp",
                action: "Read HPA configuration and pod status",
              },
            ],
            actions: [
              "Add action items",
              "Share with team",
              "Open Jira ticket",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "Add the action items section. What are we doing to prevent this?",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.securityBot,
            content:
              'Here are the action items:\n\nImmediate (this week):\n- [x] Fix HPA minReplicas to 2 for all critical services — Done\n- [ ] Add OPA policy: reject HPA configs where `minReplicas < 1` for production namespace\n- [ ] Create PagerDuty alert: "zero ready pods" on api, auth, and worker deployments\n\nShort-term (next 2 weeks):\n- [ ] Add CI check that validates HPA configs against a minimum-replicas policy\n- [ ] Require infra team approval for any changes to HPA or resource configs (CODEOWNERS)\n- [ ] Add runbook for "all pods down" scenario to the on-call handbook\n\nLong-term (Q3):\n- [ ] Implement PodDisruptionBudgets on all critical services\n- [ ] Add synthetic monitoring that exercises the full API path every 60 seconds\n- [ ] Quarterly game day to practice incident response\n\nOwner: Platform team\nReview date: May 12 (2 weeks)\n\nI\'ve updated the postmortem doc with these items. Want me to create the Linear tickets?',
            actions: [
              "Create Linear tickets",
              "Schedule review",
              "Add to runbook",
            ],
          },
        ],
      },
      {
        id: "s-30",
        title: "CDN cache invalidation strategy",
        updatedAt: "1w",
        unread: false,
        cost: "$0.74",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "We're getting stale content complaints from users. How should we handle CDN cache invalidation?",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.infraBot,
            content:
              "Here's a tiered caching strategy:\n\nStatic assets (JS, CSS, images):\nUse content-hashed filenames (e.g., `app.a3f8b2.js`). Cache forever (`max-age=31536000, immutable`). New deploys produce new hashes, so users always get fresh bundles without explicit invalidation.\n\nAPI responses:\nUse surrogate keys (Fastly/CloudFront tags). Each response is tagged with its resource type:\n```\nSurrogate-Key: servers server-123 user-456\n```\nWhen a server config changes, purge all responses tagged `server-123`. This is surgical — you don't invalidate unrelated cached responses.\n\nHTML pages:\nShort TTL (`max-age=60, stale-while-revalidate=300`). Users get cached pages for 60 seconds, then a background revalidation fetches fresh content. They never see a loading spinner, but content is at most 60 seconds stale.\n\nDashboard/real-time data:\n`no-cache` with `ETag` or `Last-Modified`. Browser always revalidates, but the server returns 304 Not Modified if nothing changed — saving bandwidth without sacrificing freshness.",
            artifact: { name: "CDN Strategy Guide.doc", type: "document" },
            actions: [
              "Implement surrogate keys",
              "Create runbook",
              "Share with team",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "How do we implement the surrogate key purging? We're on CloudFront.",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.infraBot,
            content:
              'CloudFront doesn\'t support surrogate keys natively, but here\'s how to get equivalent behavior:\n\nOption 1: CloudFront cache policies + invalidation API\n- Tag cache entries with path patterns\n- On mutation, call `CreateInvalidation` with specific paths:\n```typescript\nawait cloudfront.createInvalidation({\n  DistributionId: DIST_ID,\n  InvalidationBatch: {\n    Paths: { Items: ["/api/v2/servers/123", "/api/v2/servers"], Quantity: 2 },\n    CallerReference: Date.now().toString()\n  }\n});\n```\n- Pros: native, no extra infra\n- Cons: limited to 3,000 free invalidations/month\n\nOption 2: Lambda@Edge cache buster\n- Add a version hash to the cache key via a Lambda@Edge origin request function\n- Store the current version in DynamoDB or Parameter Store\n- To invalidate: bump the version number → all cache keys change → fresh content\n- Pros: instant, unlimited, no per-path cost\n- Cons: adds ~5ms latency, DynamoDB lookup on every request\n\nMy recommendation: Option 1 for now — your traffic volume puts you well under the 3,000/month limit. Switch to Option 2 if you outgrow it.\n\nWant me to implement the invalidation helper function?',
          },
        ],
      },
    ],
  },
  {
    id: "f-8",
    name: "Product Roadmap",
    summary:
      "Q3 planning is underway — RICE scoring complete for 23 feature candidates, top 8 selected for the quarter. Key bets: agentic tool marketplace, workspace collaboration, and enterprise SSO. Sprint 14 retro identified velocity drag from unclear acceptance criteria.",
    suggestions: [
      {
        id: "pr-1",
        label: "Draft the Q3 roadmap presentation",
        description:
          "Prepare slides for the all-hands with prioritized features and timelines.",
      },
      {
        id: "pr-2",
        label: "Write acceptance criteria for the top 3 features",
        description:
          "Address the velocity issue identified in the Sprint 14 retro.",
      },
      {
        id: "pr-3",
        label: "Summarize competitive landscape changes",
        description:
          "Update the competitive analysis with recent product launches.",
      },
      {
        id: "pr-4",
        label: "Plan the enterprise SSO design sprint",
        description:
          "Schedule a 3-day design sprint with eng and design leads.",
      },
    ],
    outputFiles: [
      { name: "Q3 RICE Scorecard.csv", type: "spreadsheet", createdAt: "5h" },
      {
        name: "Competitive Landscape Q2.doc",
        type: "document",
        createdAt: "2d",
      },
      { name: "User Feedback Themes.doc", type: "document", createdAt: "4d" },
      { name: "Sprint 14 Retro Notes.doc", type: "document", createdAt: "1w" },
    ],
    sessions: [
      {
        id: "s-15",
        title: "Q3 feature prioritization",
        updatedAt: "6h",
        unread: true,
        cost: "$0.12",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Prioritize the Q3 feature candidates using RICE scoring. We have 8 items on the list and can only commit to 3-4.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.planningBot,
            content:
              "Here's the RICE analysis for all 8 candidates:\n\n| Feature | Reach | Impact | Confidence | Effort | RICE Score |\n|---------|-------|--------|------------|--------|------------|\n| Agent marketplace | 5,000 users | 3 (high) | 80% | 4 weeks | 1,500 |\n| Enterprise SSO | 2,000 users | 3 (high) | 90% | 3 weeks | 900 |\n| Bulk server import | 1,400 users | 2 (medium) | 80% | 1.5 weeks | 747 |\n| Usage analytics dashboard | 3,000 users | 2 (medium) | 70% | 3 weeks | 700 |\n| Custom agent templates | 1,200 users | 2 (medium) | 60% | 2 weeks | 360 |\n| Webhook notifications | 800 users | 2 (medium) | 80% | 1 week | 640 |\n| Multi-region support | 600 users | 3 (high) | 50% | 6 weeks | 75 |\n| On-prem deployment | 200 users | 3 (high) | 40% | 8 weeks | 15 |\n\nRecommended Q3 slate: Agent marketplace, Enterprise SSO, Bulk import, Webhooks. These four fit in the quarter and cover the top customer requests.",
            artifact: { name: "Q3 RICE Scorecard.csv", type: "spreadsheet" },
            mcpServers: [
              {
                name: "Linear",
                server: "linear-mcp",
                action: "Read feature requests and effort estimates",
              },
              {
                name: "Productboard",
                server: "productboard-mcp",
                action: "Read customer feature votes and reach data",
              },
            ],
            actions: [
              "Create sprint plan",
              "Share with leads",
              "Adjust scoring",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "SSO is a hard requirement from 3 enterprise prospects. Can we pull it into the first half of Q3?",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.planningBot,
            content:
              "Yes — revised timeline front-loading SSO. July (Sprint 15-16): Enterprise SSO ships by July 18 (3 weeks), Webhook notifications as a parallel quick win (1 week). August (Sprint 17-18): Agent marketplace gets full team focus (4 weeks), Bulk import runs parallel with one engineer (1.5 weeks). September: buffer for polish, bug fixes, launch prep, and marketplace GA launch with marketing push.\n\nThis gets SSO into prospect hands by mid-July. Wayne Enterprises and Massive Dynamic both flagged it as a blocker — having it ready for their Q3 procurement cycles could accelerate both deals. Updated the RICE scorecard with the timeline. Want me to create the sprint plan?",
            mcpServers: [
              {
                name: "Linear",
                server: "linear-mcp",
                action: "Read sprint capacity and scheduling data",
              },
            ],
          },
        ],
      },
      {
        id: "s-16",
        title: "Competitive analysis update",
        updatedAt: "2d",
        unread: false,
        cost: "$0.08",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Update the competitive landscape. I heard Competitor A launched something new and B got a certification. What do we know?",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.analyst,
            content:
              "Here's the latest competitive intel:\n\nCompetitor A — \"Orchestration Studio\"\n- Launched a visual workflow builder for agent orchestration\n- Demo looks polished but it's a no-code tool — power users will hit limits quickly\n- No MCP support — locked into their proprietary protocol\n- Pricing unchanged ($18-$14/seat)\n- Our angle: Our agent SDK gives full programmatic control. Show prospects the difference between \"drag-and-drop\" and \"production-grade.\"\n\nCompetitor B — SOC 2 Type II\n- Achieved SOC 2 Type II certification (we're still Type I)\n- This matters for enterprise deals — 4 of our prospects have asked about it\n- They also dropped pricing 20% across all tiers ($12→$10, $10→$8)\n- Our angle: We're 3 months from Type II. Price drop signals margin pressure — their support quality may decline.\n\nCompetitor C — Quiet quarter\n- No major launches. Rumored layoffs in their sales org.\n- Two of their enterprise customers reached out to us for evaluation.\n- Our angle: Stability narrative. We're growing, they're contracting.",
            artifact: {
              name: "Competitive Landscape Q2.doc",
              type: "document",
            },
            mcpServers: [
              {
                name: "Productboard",
                server: "productboard-mcp",
                action: "Read competitive intelligence notes",
              },
            ],
            actions: ["Update battlecard", "Share with sales", "Dig deeper"],
          },
          {
            id: "m3",
            role: "user",
            content:
              "What should we prioritize in response? Anything we need to accelerate?",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.planningBot,
            content:
              "Three recommended moves:\n\n1. Accelerate SOC 2 Type II (high priority)\nCompetitor B now has it and we don't. This is a procurement checkbox for enterprise buyers. We're 3 months out — can we compress to 2 months by dedicating a compliance engineer full-time?\n\n2. Update the battlecard for Competitor B's price drop\nThe sales team needs talking points by Monday. Key message: lower price ≠ lower TCO. Our all-inclusive pricing (support, SLA, unlimited API calls) beats their à la carte model at scale.\n\n3. Capitalize on Competitor C's instability\nThe two inbound enterprise leads should get white-glove treatment. Offer a migration incentive (3 months free) and fast-track their evaluation. This is a time-limited window.\n\nI would NOT react to Competitor A's orchestration launch. Our SDK approach is stronger for serious users, and matching their no-code tool would dilute our positioning. Let them have the low-code segment.\n\nWant me to draft the battlecard updates?",
            actions: [
              "Draft battlecard updates",
              "Accelerate SOC 2",
              "Schedule review",
            ],
          },
        ],
      },
      {
        id: "s-17",
        title: "User feedback synthesis",
        updatedAt: "4d",
        unread: false,
        cost: "$1.04",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Synthesize the user interview notes from the last 2 weeks. We did 12 interviews — what themes are emerging?",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.planningBot,
            content:
              'I\'ve analyzed all 12 interview transcripts. Here are the top themes ranked by frequency:\n\n1. Onboarding friction (mentioned by 9/12)\n- "It took us 3 weeks to get our first agent running" — VP Eng, Cyberdyne\n- "The docs assume you already know MCP" — DevOps Lead, Oscorp\n- Users want a guided setup wizard, not just documentation\n\n2. Team collaboration gaps (mentioned by 7/12)\n- No way to share agent configurations across teams\n- "We have 4 teams building agents in silos" — CTO, Soylent Corp\n- Request: shared agent library with version control\n\n3. Cost visibility (mentioned by 6/12)\n- "I have no idea what each agent costs to run" — Finance, Wayne Enterprises\n- Need per-agent and per-team usage dashboards\n- Budget alerts before hitting limits\n\n4. Reliability concerns (mentioned by 5/12)\n- Agent failures are hard to debug\n- "When it breaks, I don\'t know why" — Engineer, Stark Industries\n- Request: better logging, execution traces, error explanations\n\nSurprise finding: 4 users independently asked for an "agent marketplace" where they could discover and install pre-built agents. This validates the Q3 roadmap decision.',
            artifact: { name: "User Feedback Themes.doc", type: "document" },
            tasks: [
              {
                label: "Processed 12 interview transcripts",
                status: "completed",
              },
              {
                label: "Extracted 47 unique feedback items",
                status: "completed",
              },
              { label: "Clustered into 4 themes", status: "completed" },
            ],
            mcpServers: [
              {
                name: "Productboard",
                server: "productboard-mcp",
                action: "Read user interview transcripts",
              },
              {
                name: "Linear",
                server: "linear-mcp",
                action: "Read feature request tickets",
              },
            ],
            actions: [
              "Write feature specs",
              "Share with team",
              "Schedule design sprint",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "The onboarding friction is concerning. What quick wins can we do before the marketplace launch?",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.analyst,
            content:
              'Three quick wins that don\'t require major engineering:\n\n1. Interactive quickstart (1 week)\nReplace the current docs-based onboarding with a step-by-step wizard in the app. Pre-populate with a sample agent config, let users modify and deploy in under 5 minutes.\n\n2. Template gallery (3 days)\nShip 5 pre-built agent templates: support bot, code reviewer, data pipeline monitor, docs updater, and sales assistant. Users can fork and customize instead of starting from scratch.\n\n3. Better error messages (2 days)\nThe top 10 error messages are cryptic. Rewrite them to include: what went wrong, why, and what to do about it. Example: instead of "Connection refused" → "Could not connect to MCP server at {url}. Check that the server is running and the URL is correct."\n\nAll three can ship before the marketplace launch in August. The template gallery also feeds into marketplace — those 5 templates become the first marketplace listings.\n\nWant me to write the specs for these?',
          },
        ],
      },
      {
        id: "s-18",
        title: "Sprint retrospective notes",
        updatedAt: "1w",
        unread: false,
        cost: "$0.12",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Capture the retro notes from today's session. We covered what went well, what didn't, and action items.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.planningBot,
            content:
              "Here's the Sprint 14 retrospective summary:\n\nWhat went well:\n- Shipped marketplace beta on time (June 30 target, landed June 28)\n- Zero SEV-1 incidents this sprint\n- New hire (Priya) merged her first PR on day 3\n- Customer NPS up 4 points (38 → 42)\n\nWhat didn't go well:\n- PR review turnaround averaged 18 hours (target: 4 hours)\n- 3 flaky tests blocked CI for 2 days — team lost 6 engineer-hours waiting\n- Sprint scope creep: 2 unplanned items added mid-sprint, bumped the webhooks feature\n\nAction items:\n1. PR review SLA: Set a 4-hour review window. If no reviewer after 4h, auto-assign to the tech lead. — Owner: Alex\n2. Flaky test quarantine: Move known flaky tests to a separate suite that doesn't block merges. Fix them in a dedicated session Friday afternoon. — Owner: Mike\n3. Scope freeze: No new items after sprint planning without PM + TL approval. Unplanned work goes to next sprint or gets swapped 1:1. — Owner: Sarah\n\nTeam mood: 7.2/10 (up from 6.8 last sprint). Energy is good but review delays are frustrating people.",
            artifact: { name: "Sprint 14 Retro Notes.doc", type: "document" },
            mcpServers: [
              {
                name: "Linear",
                server: "linear-mcp",
                action: "Read sprint velocity and PR review metrics",
              },
            ],
            actions: [
              "Create action items",
              "Share with team",
              "Set reminders",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "Compare this to the last 3 retros. Are we trending in the right direction?",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.analyst,
            content:
              "Trend across the last 4 sprints: velocity steady up (34, 38, 41, 43 pts), PR review time getting worse (12, 14, 16, 18 hrs), SEV-1 incidents volatile (1, 0, 2, 0), scope changes concerning (0, 1, 3, 2), team mood positive (6.5, 7.0, 6.8, 7.2), unplanned work needs attention (5%, 8%, 15%, 12%).\n\nGood news: velocity up 26% over 4 sprints, mood is the highest it's been, zero SEV-1s in 2 of 4 sprints. Concern: PR review time has increased every sprint, correlating with team growth from 5 to 7 — more PRs, same reviewers. The 4-hour SLA should help, but you may also want code ownership areas to distribute reviews.\n\nScope creep spiked in Sprint 13 and is still elevated. The scope freeze policy should address this — check back in Sprint 15.",
            mcpServers: [
              {
                name: "Linear",
                server: "linear-mcp",
                action: "Read historical sprint velocity and scope data",
              },
            ],
            actions: [
              "Set up code ownership",
              "Schedule follow-up",
              "Share trends",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "f-9",
    name: "Hiring",
    summary:
      "Recruiting for 3 open roles: Senior Backend Engineer, Staff ML Engineer, and DevRel Lead. 12 candidates in pipeline for the backend role — 4 at onsite stage. Systems design rubric updated to include agentic architecture questions. Target: fill all roles by end of Q3.",
    suggestions: [
      {
        id: "hr-1",
        label: "Prep interview packets for Thursday onsites",
        description:
          "Compile scorecards, system design problems, and interviewer assignments.",
      },
      {
        id: "hr-2",
        label: "Draft the Staff ML Engineer job description",
        description:
          "Model it after the backend JD with ML-specific requirements.",
      },
      {
        id: "hr-3",
        label: "Analyze sourcing channel effectiveness",
        description:
          "Compare referral vs LinkedIn vs job board conversion rates.",
      },
      {
        id: "hr-4",
        label: "Update the candidate pipeline report",
        description:
          "Add new candidates and update stage progression for existing ones.",
      },
    ],
    outputFiles: [
      {
        name: "Senior Backend Engineer JD.doc",
        type: "document",
        createdAt: "1d",
      },
      {
        name: "Systems Design Rubric.csv",
        type: "spreadsheet",
        createdAt: "3d",
      },
      {
        name: "Candidate Pipeline Report.csv",
        type: "spreadsheet",
        createdAt: "5d",
      },
    ],
    sessions: [
      {
        id: "s-19",
        title: "Senior engineer job description",
        updatedAt: "1d",
        unread: false,
        cost: "$0.89",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Draft a JD for senior backend engineer on the platform team. We need someone who can lead the agent infrastructure work.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.hrBot,
            content:
              "Here's the draft:\n\nSenior Backend Engineer — Platform Team\n\nAbout the role:\nYou'll design and build the infrastructure that powers our AI agent platform — the systems that deploy, orchestrate, and monitor thousands of agent instances across customer environments.\n\nWhat you'll do:\n- Architect scalable agent orchestration services (Go, gRPC, Kubernetes)\n- Design and optimize the MCP server runtime for multi-tenant deployments\n- Build observability tooling for agent health, performance, and cost tracking\n- Lead technical design reviews and mentor junior engineers\n\nWhat we're looking for:\n- 5+ years building distributed systems at scale\n- Strong Go experience (or similar systems language)\n- Deep Kubernetes knowledge — you've operated production clusters\n- Experience with API design (REST, gRPC, or GraphQL)\n- Bonus: familiarity with AI/ML infrastructure or agent frameworks\n\nWhat we offer:\n- Comp range: $195K-$245K + equity\n- Remote-first, async culture\n- Small team (7 engineers), high impact\n\nTone is direct and avoids buzzwords. Want me to adjust the comp range or add anything?",
            artifact: {
              name: "Senior Backend Engineer JD.doc",
              type: "document",
            },
            mcpServers: [
              {
                name: "Greenhouse",
                server: "greenhouse-mcp",
                action: "Read existing job descriptions and comp bands",
              },
            ],
            actions: [
              "Post to job boards",
              "Send to hiring manager",
              "Adjust comp range",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "Good, but make it clear we want someone who can eventually lead the platform team. Add a growth path.",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.hrBot,
            content:
              "Added this section:\n\nGrowth path:\nThis role has a clear trajectory to Staff Engineer or Engineering Manager within 12-18 months. The platform team is growing from 3 → 7 engineers this year, and we're looking for someone who can help shape the team's technical direction.\n\nIn your first 90 days, you'll:\n- Ship a meaningful improvement to the agent runtime (we'll pick it together)\n- Lead your first design review\n- Build relationships across product and sales to understand customer pain points\n\nIn your first year, you'll:\n- Own the agent orchestration architecture end-to-end\n- Mentor 1-2 junior engineers\n- Represent the platform team in roadmap planning\n\nI've also softened the \"5+ years\" to \"significant experience\" — some of the best candidates we've hired had 3-4 years of dense experience that outweighed 7 years of shallow work. The JD is updated and ready for Lever.",
          },
        ],
      },
      {
        id: "s-20",
        title: "Interview rubric — systems design",
        updatedAt: "3d",
        unread: false,
        cost: "$0.89",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Create a systems design interview rubric. We need consistency across interviewers — everyone's grading differently.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.hrBot,
            content:
              "Here's a structured rubric with 5 dimensions, each scored 1-4:\n\n1. Problem Scoping (25%)\n- 4: Asks clarifying questions, identifies constraints, defines scope before designing\n- 3: Mostly scopes well, misses 1-2 constraints\n- 2: Jumps into design too quickly, assumes requirements\n- 1: Doesn't scope, builds the wrong thing\n\n2. Architecture (25%)\n- 4: Clean component separation, appropriate tech choices, considers trade-offs\n- 3: Reasonable architecture, minor gaps in component design\n- 2: Monolithic thinking, unclear boundaries, questionable tech choices\n- 1: No coherent architecture\n\n3. Scalability & Performance (20%)\n- 4: Proactively addresses bottlenecks, proposes caching/sharding/async strategies\n- 3: Handles scale when prompted, reasonable approaches\n- 2: Struggles with scale, misses obvious bottlenecks\n- 1: No consideration for scale\n\n4. Data Modeling (15%)\n- 4: Schema design supports query patterns, considers consistency vs. availability\n- 3: Workable schema, minor inefficiencies\n- 2: Schema doesn't support key access patterns\n- 1: No data model discussed\n\n5. Communication (15%)\n- 4: Thinks out loud, draws clear diagrams, explains trade-offs\n- 3: Communicates well with occasional prompting\n- 2: Hard to follow, doesn't explain reasoning\n- 1: Silent or disorganized\n\nHire bar: Average ≥ 3.0, no dimension below 2.",
            artifact: {
              name: "Systems Design Rubric.csv",
              type: "spreadsheet",
            },
            mcpServers: [
              {
                name: "Greenhouse",
                server: "greenhouse-mcp",
                action: "Read past interview scorecards and feedback",
              },
            ],
            actions: [
              "Share with interviewers",
              "Add sample questions",
              "Schedule calibration",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "Can you also suggest 3 good systems design questions tailored to our domain?",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.hrBot,
            content:
              'Here are three questions calibrated for senior backend candidates:\n\nQuestion 1: Agent Orchestrator (45 min)\n"Design a system that deploys, monitors, and scales AI agent instances across multiple customer tenants. Each agent can have different resource requirements and SLA levels."\n- Tests: multi-tenancy, resource scheduling, observability\n- Good answers mention: K8s operators, resource quotas, health checks, noisy neighbor isolation\n\nQuestion 2: Real-time MCP Gateway (45 min)\n"Design a gateway that routes tool-call requests from AI models to MCP servers. The system needs to handle 10K concurrent connections with <100ms p99 latency."\n- Tests: connection management, load balancing, protocol design\n- Good answers mention: connection pooling, circuit breakers, WebSocket vs. SSE trade-offs\n\nQuestion 3: Usage Metering Pipeline (30 min)\n"Design a system that tracks per-customer API usage in real-time for billing. Must handle 50K events/second and be eventually consistent within 5 minutes."\n- Tests: event streaming, aggregation, exactly-once processing\n- Good answers mention: Kafka/Kinesis, time-window aggregation, idempotency\n\nEach question maps to real work on our platform, so you\'re also evaluating domain fit.',
          },
        ],
      },
      {
        id: "s-21",
        title: "Candidate pipeline review",
        updatedAt: "5d",
        unread: false,
        cost: "$4.12",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Pull the latest from Lever and summarize where we stand on the senior backend engineer search.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.hrBot,
            content:
              "Here's the pipeline snapshot:\n\n| Stage | Count | Notes |\n|-------|-------|-------|\n| Sourced | 45 | 30 outbound, 15 inbound |\n| Screen completed | 12 | 27% pass rate |\n| Technical interview | 6 | 2 this week |\n| Systems design | 3 | All strong |\n| Final round | 2 | Details below |\n| Offer | 0 | — |\n\nFinal round candidates:\n\nCandidate A — Sarah L.\n- Background: 6 years at Stripe, built their payment routing infra\n- Strengths: distributed systems expertise, strong communicator\n- Risk: has a competing offer from Datadog (deadline: Friday)\n- Rubric scores: 3.8 avg across all interviewers\n\nCandidate B — Marcus R.\n- Background: 4 years at Cloudflare, Workers runtime team\n- Strengths: deep K8s and runtime experience, exactly our stack\n- Risk: wants to stay in NYC (we're remote-first, so fine, but no local team)\n- Rubric scores: 3.6 avg\n\nBoth are strong hires. Sarah is the slightly stronger candidate but Marcus is a better domain fit.",
            artifact: {
              name: "Candidate Pipeline Report.csv",
              type: "spreadsheet",
            },
            tasks: [
              { label: "Synced with Lever API", status: "completed" },
              { label: "Compiled interviewer scorecards", status: "completed" },
              { label: "Generated pipeline summary", status: "completed" },
            ],
            mcpServers: [
              {
                name: "Greenhouse",
                server: "greenhouse-mcp",
                action: "Read candidate pipeline and interview scorecards",
              },
              {
                name: "LinkedIn",
                server: "linkedin-mcp",
                action: "Read candidate profile details",
              },
            ],
            actions: [
              "Draft offer letter",
              "Schedule final round",
              "Update scorecard",
            ],
          },
          {
            id: "m3",
            role: "user",
            content:
              "Sarah's competing offer expires Friday. What should our offer look like?",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.analyst,
            content:
              "Here's a competitive offer package for Sarah:\n\nBase salary: $235K (top of band — she's at the senior-to-staff boundary)\nEquity: 0.15% over 4 years (1-year cliff) — ~$150K at current valuation\nSigning bonus: $25K (to offset Datadog's potential counter)\nStart date: June 16 (gives 2 weeks notice)\n\nWhy this works:\n- Datadog's standard senior offer is $220-$240K base + RSUs. Our equity upside is significantly higher as a growth-stage company.\n- The signing bonus signals urgency and commitment.\n- Total comp year 1: ~$297K vs. Datadog's likely ~$290-$310K.\n\nTalking points for the call:\n- She'd be the most senior platform engineer — high impact, not a cog\n- Agent infrastructure is the most interesting systems work in tech right now\n- She'd help build the team, not just join it\n\nRecommendation: Make the call today. Have the written offer ready to send immediately after she verbally accepts. Competing-offer situations are won by speed.\n\nWant me to draft the offer letter?",
            mcpServers: [
              {
                name: "LinkedIn",
                server: "linkedin-mcp",
                action: "Read market compensation benchmarks",
              },
            ],
            actions: [
              "Draft offer letter",
              "Schedule call today",
              "Update pipeline",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "f-10",
    name: "Security & Compliance",
    summary:
      "SOC 2 Type II audit scheduled for August — gap analysis identified 6 controls needing remediation, 4 now resolved. Pen test completed with 2 medium-severity findings (both patched). GDPR data flow mapping is 90% complete. Quarterly access review wrapping up this week.",
    suggestions: [
      {
        id: "sc-1",
        label: "Close the remaining 2 SOC 2 control gaps",
        description:
          "Logging retention policy and incident response SLA documentation.",
      },
      {
        id: "sc-2",
        label: "Schedule the pre-audit readiness review",
        description:
          "Walk through evidence collection with the auditor before August.",
      },
      {
        id: "sc-3",
        label: "Complete the GDPR data flow map",
        description: "Last 10% covers third-party sub-processor data flows.",
      },
      {
        id: "sc-4",
        label: "Draft the Q2 security summary for leadership",
        description:
          "Compile pen test results, access review outcomes, and audit readiness.",
      },
    ],
    outputFiles: [
      { name: "SOC 2 Gap Analysis.csv", type: "spreadsheet", createdAt: "8h" },
      {
        name: "Pen Test Remediation Plan.doc",
        type: "document",
        createdAt: "2d",
      },
      { name: "GDPR Data Flow Map.doc", type: "document", createdAt: "4d" },
      {
        name: "Q2 Access Review Report.csv",
        type: "spreadsheet",
        createdAt: "6d",
      },
    ],
    sessions: [
      {
        id: "s-22",
        title: "SOC 2 Type II audit prep",
        updatedAt: "8h",
        unread: true,
        cost: "$0.53",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "We need SOC 2 Type II by end of Q3. What gaps do we have?",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.securityBot,
            content:
              "Audited your controls against Type II requirements. Already compliant (Type I carryover): access controls and authentication, encryption at rest and in transit, change management process — all passed.\n\nGaps to close: 6 months continuous monitoring evidence (running now, deadline Sep 30), formal incident response plan (1 week, due June 15), vendor risk assessments for 3 vendors (2 weeks, due June 30), business continuity/DR plan (1 week, due June 15), and security awareness training (3 days, due June 10).\n\nTimeline risk: monitoring started April 1, so the earliest certification is October 1.",
            artifact: { name: "SOC 2 Gap Analysis.csv", type: "spreadsheet" },
            tasks: [
              {
                label: "Reviewed current Type I controls",
                status: "completed",
              },
              {
                label: "Mapped Type II delta requirements",
                status: "completed",
              },
              {
                label: "Assessed monitoring evidence timeline",
                status: "completed",
              },
            ],
            mcpServers: [
              {
                name: "Vanta",
                server: "vanta-mcp",
                action: "Read compliance control status",
              },
              {
                name: "AWS CloudTrail",
                server: "cloudtrail-mcp",
                action: "Read monitoring evidence logs",
              },
            ],
            actions: ["Close gaps", "Schedule pre-audit", "Share with team"],
          },
          {
            id: "m3",
            role: "user",
            content:
              "Can we compress the monitoring window? 3 enterprise deals are blocked on this.",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.infraBot,
            content:
              "The 6-month window is a hard requirement — auditors need to observe controls operating effectively over time.\n\nWhat you CAN do to unblock deals now:\n\n1. Bridge letter from your auditor — Confirms you're on track for Type II by October. Many procurement teams accept this.\n2. Share your Type I report — Demonstrates controls exist.\n3. Contractual commitment — \"Will achieve SOC 2 Type II by Q4 2026 or customer may terminate without penalty.\"\n\nI'd recommend option 1 + 3 for Wayne Enterprises and Massive Dynamic. Want me to draft the contract clause?",
          },
        ],
      },
      {
        id: "s-23",
        title: "Penetration test results",
        updatedAt: "2d",
        unread: false,
        cost: "$0.05",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "The pen test report just came back from NCC Group. Summarize the findings and create a remediation plan.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.securityBot,
            content:
              "Pen test summary: overall moderate risk. No critical or high findings — good result for a first external pen test. 4 findings: CORS misconfiguration allowing credential theft (medium, CVSS 6.5), missing rate limiting on auth endpoints (medium, CVSS 5.3), verbose error messages leaking stack traces (medium, CVSS 5.0), and missing security headers (low, CVSS 3.1).\n\nFinding 1: CORS returns `Access-Control-Allow-Origin: *` with credentials — any website could make authenticated requests. Finding 2: `/auth/token` has no rate limiting — brute-force at ~1,000 req/sec is possible.",
            artifact: {
              name: "Pen Test Remediation Plan.doc",
              type: "document",
            },
            mcpServers: [
              {
                name: "Vanta",
                server: "vanta-mcp",
                action: "Read vulnerability scan results",
              },
            ],
            actions: [
              "File remediation tickets",
              "Schedule pen test",
              "Share report",
            ],
          },
          {
            id: "m3",
            role: "user",
            content: "How quickly can we fix these?",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.securityBot,
            content:
              "All four can be fixed this week: CORS fix (restrict Allow-Origin to app domain, 2 hours, ship today), rate limiting (add 10 req/min per IP to auth endpoints, 4 hours, tomorrow), verbose errors (strip stack traces in production, 3 hours, tomorrow), missing headers (add X-Content-Type-Options, 30 min, today). Total ~1.5 engineering days. Ship the CORS fix first — it's most urgent. Then request a retest letter from NCC Group confirming remediation (~$2-3K). Want me to draft the PRs?",
          },
        ],
      },
      {
        id: "s-24",
        title: "GDPR data mapping",
        updatedAt: "4d",
        unread: false,
        cost: "$1.56",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "We're getting GDPR questions from EU prospects. Map our PII data flows so we can answer their DPA requests.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.securityBot,
            content:
              "PII data flow map: PostgreSQL stores email, name, and org (account lifetime, us-west-2). Redis stores session tokens and user ID (24 hours, us-west-2). S3 audit logs store IP addresses and user actions (90 days, us-west-2). Stripe handles email and payment info (per Stripe policy, Stripe EU).\n\nSub-processors requiring DPAs: Stripe (signed), AWS (signed), Okta (not signed), SendGrid (not signed), Sentry (not signed)\n- SendGrid — DPA not signed\n- Sentry — DPA not signed",
            artifact: { name: "GDPR Data Flow Map.doc", type: "document" },
            mcpServers: [
              {
                name: "AWS CloudTrail",
                server: "cloudtrail-mcp",
                action: "Read data storage and access patterns",
              },
              {
                name: "Vanta",
                server: "vanta-mcp",
                action: "Read sub-processor DPA status",
              },
            ],
            actions: [
              "Sign missing DPAs",
              "Update data map",
              "Share with legal",
            ],
          },
          {
            id: "m3",
            role: "user",
            content: "What do we need to do to be fully GDPR compliant?",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.infraBot,
            content:
              'GDPR checklist:\n\nDone:\n- [x] Encryption at rest and in transit\n- [x] Privacy policy published\n- [x] DPA with AWS and Stripe\n- [x] Right to access (data export in settings)\n\nNeeds attention:\n- [ ] Sign DPAs with Okta, SendGrid, Sentry (1 week — just paperwork)\n- [ ] Self-serve "delete my account" flow (2 weeks engineering)\n- [ ] Data processing records, Article 30 (3 days)\n- [ ] Appoint a DPO or privacy lead\n- [ ] EU region deployment option (Q4 roadmap)\n\nBiggest gap: Right-to-deletion. Currently a user emails support and an engineer manually deletes. Not scalable, technically non-compliant. The DPA signing is the quickest win — all three vendors have standard DPAs online.',
            actions: ["Sign DPAs now", "Build deletion flow", "Appoint DPO"],
          },
        ],
      },
      {
        id: "s-25",
        title: "Access review Q2",
        updatedAt: "1w",
        unread: false,
        cost: "$2.67",
        messages: [
          {
            id: "m1",
            role: "user",
            content:
              "Run the quarterly access review. Pull accounts from Okta, AWS, and GitHub and flag anything wrong.",
          },
          {
            id: "m2",
            role: "assistant",
            bot: BOTS.securityBot,
            content:
              "Q2 access review: 142 accounts audited across Okta (68), AWS IAM (34), GitHub (40). Found 8 stale accounts (former employees with active AWS/GitHub despite Okta removal), 3 over-privileged users (engineers with prod admin who only need read), 1 shared credential (deploy-bot AWS key shared across 3 services), and 2 GitHub accounts without MFA (contractors).\n\nOver-privileged to downgrade: alex.w from AWS Admin to PowerUser, priya.s from AWS Admin to ReadOnly (frontend team), mike.r from GitHub org owner to maintainer",
            artifact: {
              name: "Q2 Access Review Report.csv",
              type: "spreadsheet",
            },
            tasks: [
              { label: "Pulled Okta user directory", status: "completed" },
              {
                label: "Exported AWS IAM users and policies",
                status: "completed",
              },
              { label: "Audited GitHub org members", status: "completed" },
              {
                label: "Cross-referenced with HR active list",
                status: "completed",
              },
            ],
            mcpServers: [
              {
                name: "AWS CloudTrail",
                server: "cloudtrail-mcp",
                action: "Read IAM user policies and access keys",
              },
              {
                name: "Vanta",
                server: "vanta-mcp",
                action: "Read employee access compliance status",
              },
            ],
            actions: [
              "Revoke stale accounts",
              "Downgrade privileges",
              "Export report",
            ],
          },
          {
            id: "m3",
            role: "user",
            content: "The shared deploy-bot key is concerning. What's the fix?",
          },
          {
            id: "m4",
            role: "assistant",
            bot: BOTS.infraBot,
            content:
              "Agreed — shared long-lived credentials are a top risk. The key was created 14 months ago and never rotated.\n\nFix is to move to IAM roles with no keys: CI/CD uses GitHub Actions OIDC to assume an IAM role, deploy scripts use ECS task roles, and monitoring uses EC2 instance profiles. Each service gets its own least-privilege role.\n\nTimeline: 2-3 days. After migration, deactivate the key (wait 1 week), then delete. Add policy: no long-lived IAM keys in production. This also satisfies the SOC 2 individual accountability requirement.",
            mcpServers: [
              {
                name: "AWS CloudTrail",
                server: "cloudtrail-mcp",
                action: "Read IAM key age and rotation history",
              },
            ],
            actions: [
              "Create IAM roles PR",
              "Deactivate old key",
              "Update policy doc",
            ],
          },
        ],
      },
    ],
  },
];
