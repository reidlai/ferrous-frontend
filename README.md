# ferrous-frontend

> **Svelte 5 Reactive Resolution Studio & Multi-Screen Workbench for FerrousCX**  
> Modern enterprise web frontend powered by [Svelte 5 Runes](https://svelte.dev/), [shadcn-svelte](https://shadcn-svelte.com/), Tailwind CSS v4, and an RxJS unidirectional reactive streaming bridge.

[![Framework: Svelte 5](https://img.shields.io/badge/framework-Svelte%205%20(Runes)-orange.svg)](https://svelte.dev/)
[![Components: shadcn-svelte](https://img.shields.io/badge/ui-shadcn--svelte-black.svg)](https://shadcn-svelte.com/)
[![Styling: Tailwind CSS v4](https://img.shields.io/badge/styling-Tailwind%20CSS%20v4-blue.svg)](https://tailwindcss.com/)
[![DevSecOps: Frontend CI](https://img.shields.io/badge/DevSecOps-Tier%202%20Container%20CI-brightgreen.svg)](#devsecops--ci-standards)

---

## 🎯 Architectural Role

`ferrous-frontend` delivers the operational operator interface and human-in-the-loop (HITL) workbench for FerrousCX:

1. **Screen 0 Operator Authentication Gate:** Secure login interface integrating Kanidm PKCE OAuth2 authentication with pre-provisioned roles (`customer_specialist`, `operations_manager`, `system_admin`).
2. **Top Application Menu Bar (`Menubar`):** Global navigation housing operational controls, active agent status, and direct shortcuts to Screen 5 (`/benchmarks`) and Screen 6 (`/pipeline-performance`).
3. **3-Column Resolution Studio:**
   - **Left Sidebar:** Active order queue, SLA risk badges, carrier delay alerts, and navigation links.
   - **Middle Operational Canvas (Screens 1–4):** Active order timeline, carrier SLA radar, customer sentiment badges, and interactive traffic simulator dock.
   - **Right AI Sidecar (Screen 1):** Transparent agent thought stream, tool invocation telemetry pills (<3ms), and sandboxed `HitlProposalCard` for operator approval of courtesy credits (capped at $20).
4. **Screen 5 Copilot (Agent) Benchmarking Studio (`/benchmarks`):** Real-time leaderboard evaluating LLM providers (TTFT, token/s, cost, pass-rate) reading from Delta Lake.
5. **Screen 6 Historical Pipeline Performance Studio (`/pipeline-performance`):** Real-time monitoring of Iggy broker ingestion and Arroyo Delta Lake commit throughput.
6. **RxJS-to-Runes Reactive Bridge:** Unidirectional event-driven bridge mapping Server-Sent Events (`/api/v1/events/stream`) into Svelte 5 `$state` and `$derived` runes with preempt-and-abort cancellation.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Top Application Menu Bar                        │
│ [FerrousCX]  [Orders]  [SLA Radar]  [Benchmarks]  [Pipeline]  [Admin]  │
├──────────────┬──────────────────────────┬──────────────────────────────┤
│ Left Sidebar │ Middle Content Panel     │ Right AI Sidecar             │
│ (Order Queue)│ (Operational Canvas)     │ (Transparent Workbench)      │
│              │                          │                              │
│ • Order #101 │ Order #101 Details       │ ▶ Thought Process (1.2s)     │
│   [DELAYED]  │ Status: In Transit       │ ⚡ Tool: query_lakehouse     │
│ • Order #102 │ Carrier: Correios        │    Latency: 2.1ms            │
│ • Order #103 │ Customer: Frustrated     │ "Carrier delayed shipment."  │
│              │ [Contact Carrier]        │ ┌──────────────────────────┐ │
│              │                          │ │ [Approve $15 Credit]     │ │
│              │                          │ └──────────────────────────┘ │
└──────────────┴──────────────────────────┴──────────────────────────────┘
```

---

## 🔌 Port Mappings & Network Topology

| Service | Port | Protocol | Purpose |
| :--- | :---: | :---: | :--- |
| **Vite Dev Server** | `5173` | HTTP | Local HMR development environment |
| **Production Web Server** | `3000` / `80` | HTTP / HTTP2 | Static asset delivery via unprivileged Nginx |

---

## 🛠️ Developer Quickstart

```bash
# Install dependencies
pnpm install

# Launch Vite development server
pnpm dev

# Build production bundle
pnpm build

# Preview production build
pnpm preview
```

---

## 🛡️ DevSecOps & CI Standards

- Package Management: `pnpm` with frozen lockfile enforcement.
- Static Analysis: `svelte-check`, `eslint`, `prettier`.
- Production Container: Multi-stage Dockerfile (`node:22-alpine` builder + `nginxinc/nginx-unprivileged:alpine-slim` runtime, non-root UID 101, `hadolint` clean, 0 HIGH/CRITICAL CVEs).
