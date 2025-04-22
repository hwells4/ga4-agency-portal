# FOR AI ASSISTANCE: REPOSITORY CONTEXT
> **IMPORTANT:** This document is part of **Repository #2: GA4 Agency Portal & Credential Backend**. This is the Next.js web application that provides the agency user interface, authentication, client management, and secure credential storage. It is NOT Repository #1 (the MCP Server that handles GA4 API interactions via fastmcp). This repository is responsible for the agency-facing portal, database, and internal credential API that the MCP server will call.

---

# Product Requirements Document: GA4 MCP Service (SaaS)

**Version:** 1.1  
**Date:** [Current Date]  
**Author:** AI Assistant (based on user interaction)

## Table of Contents
- [Introduction & Overview](#introduction--overview)
- [Goals](#goals)
- [Target Audience](#target-audience)
- [Scope](#scope)
- [Key Technologies & Libraries](#key-technologies--libraries)
- [Assumptions](#assumptions)
- [Requirements (Phased Rollout)](#requirements-phased-rollout)
  - [Phase 1: MVP - Core End-to-End Flow](#phase-1-minimum-viable-product-mvp---core-end-to-end-flow)
  - [Phase 2: Multi-Client Agency Support & Portal V1](#phase-2-multi-client-agency-support--portal-v1)
  - [Phase 3: Enhanced GA4 Interaction & UX](#phase-3-enhanced-ga4-interaction--ux)
  - [Phase 4: Scalability, Monitoring & Advanced Features](#phase-4-scalability-monitoring--advanced-features)
- [Technical Architecture Overview](#technical-architecture-overview)
- [Security Considerations](#security-considerations-summary)
- [Non-Functional Requirements](#non-functional-requirements)
- [Success Metrics](#success-metrics)
- [Open Questions & Future Considerations](#open-questions--future-considerations)

## Introduction & Overview

**Product Name:** GA4 MCP Service (SaaS) (Internal Name, Branding TBD)

**Purpose:** To provide marketing agencies and their end-users with a seamless, conversational interface to query and analyze Google Analytics 4 (GA4) data via AI chat clients (e.g., Cursor, Claude), leveraging the Model Context Protocol (MCP). The service operates on a SaaS model, allowing agencies to manage multiple client connections securely.

**Problem:** GA4 data access is often cumbersome, requiring UI navigation or API expertise. Agencies managing multiple clients need a centralized, secure, and efficient way to query data across different GA4 properties without complex setup for each end-user.

**Solution:** A two-component SaaS application:

1. **Hosted MCP Server (Python/fastmcp):** 
   - A backend service that exposes GA4 query capabilities via the MCP protocol over an SSE endpoint
   - Receives requests, fetches credentials securely from the backend
   - Interacts with the GA4 Data API and returns structured results

2. **Agency Portal & Credential Backend (Node.js/Next.js):**
   - A full-stack web application (potentially bootstrapped using mckaywrigley/mckays-app-template)
   - Provides agency user authentication
   - UI for managing client records (identifiers, GA4 Property IDs)
   - Secure storage/management of GA4 credentials (Service Accounts)
   - Internal API for the MCP server to fetch credentials

End-user client configuration (Cursor, Claude) is done via a single command using `npx install-mcp` pointing to the hosted MCP Server's SSE URL.

## Goals

1. **Simplify GA4 Data Access:** Enable conversational GA4 data querying within AI chat clients.
2. **Secure Multi-Client Management:** Provide agencies a secure platform to manage connections and credentials for multiple distinct client GA4 properties.
3. **Streamline Agency Workflow:** Offer a centralized hub for managing GA4 access configuration for the MCP service.
4. **Reduce Setup Friction:** Ensure end-users can connect their client application via a single, easily generated command-line execution.
5. **Ensure Security:** Implement robust security for agency authentication, credential storage, and internal service communication.
6. **Provide Actionable Insights:** Return GA4 data clearly structured for LLM interpretation and potential downstream processing.
7. **Create a Scalable Service:** Design an architecture that scales to accommodate growing numbers of agencies, clients, and requests.

## Target Audience

- **Primary:** Digital Marketing Agencies managing GA4 properties for multiple end-clients.
- **Secondary:** End-users (Marketers, Analysts) within these agencies using AI chat clients supporting MCP.

## Scope

### In Scope (Overall)

#### Repo 1 (MCP Server)
- Python fastmcp application
- GA4 Data API (runReport) interaction logic
- Secure internal API client to fetch credentials
- SSE endpoint hosting

#### Repo 2 (Portal/Backend)
- Next.js application
- Agency authentication (Clerk)
- Database (PostgreSQL via Supabase/Drizzle) for Agency/Client/Credential metadata
- Secure credential storage integration (Secrets Manager or equivalent)
- Agency UI for client/credential management
- Secure internal API endpoint for credential retrieval
- `npx install-mcp` command generation logic

#### Other
- Returning structured JSON/tabular data from GA4 API calls via MCP
- (Future Phases) Additional GA4 API tools, data visualization, reporting tools within the MCP server

### Out of Scope (Initially)
- Direct Google login integration for GA4 credential linking (focus on Service Account uploads)
- Complex NLP within the MCP server
- GA4 Management API access via MCP
- Advanced agency/user roles in the portal
- Billing/Subscription management integration (though the template might have Stripe hooks)

## Key Technologies & Libraries

### MCP Server (Repo 1)
- Python (>=3.10)
- fastmcp (>=2.x recommended for latest features)
- google-analytics-data (Official Google Client Library)
- httpx (or similar, for calling the internal credential API)
- **Deployment:** Docker, Railway/Cloud Run/etc. (ASGI compatible host)

### Agency Portal & Backend (Repo 2)
- Node.js / TypeScript
- Next.js (App Router)
- React
- Tailwind CSS
- Shadcn UI (Component Library)
- Clerk (Authentication)
- PostgreSQL (Database, e.g., via Supabase)
- Drizzle ORM
- **Secrets Management:** AWS Secrets Manager, Google Secret Manager, HashiCorp Vault, or equivalent database encryption
- Potentially starting from mckaywrigley/mckays-app-template
- **Deployment:** Vercel/Railway/etc. (Node.js hosting)

### Client Configuration
- install-mcp (via npx)
- Node.js/npm (required on end-user machine)

## Assumptions

- Agencies will provide valid Service Account credentials for each client GA4 property.
- GA4 API costs are the responsibility of the credential owner's Google Cloud project.
- End-users have Node.js/npm/npx installed for the setup command.
- Target MCP clients (Cursor, Claude) work correctly with install-mcp configured URLs.
- mckays-app-template provides a suitable foundation for the Agency Portal's auth, DB, and basic UI structure.

## Requirements (Phased Rollout)

### Phase 1: Minimum Viable Product (MVP) - Core End-to-End Flow

**Goal:** Validate the core architecture: A hosted fastmcp server querying GA4 for one hardcoded client/credential via an internal API call to a minimal backend, configurable via install-mcp.

#### Functional Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| (R1) F1.1 | Hosted MCP Server | Deploy basic fastmcp server via SSE |
| (R1) F1.2 | Core GA4 Query Tool | query_ga4_report tool exists.<br>**Inputs:** client_identifier, metrics, dimensions, dates, etc.<br>**Logic:** Calls internal API (F1.6) with client_identifier to get (hardcoded MVP) property_id & creds reference. Uses these to call GA4 runReport. Returns structured JSON or error. |
| (R2) T1.5 | Basic Portal Backend | Set up Next.js project (from template) |
| (R2) T1.6 | Minimal Internal Credential API | Implement one internal API endpoint (e.g., /api/internal/get-creds) in the Next.js app. For MVP, this endpoint can return hardcoded test property_id and credential data/reference when called (ignoring client_identifier input initially). Needs basic security (e.g., a simple shared secret header check). |
| (R1) T1.4 | Internal API Client | Implement logic within the MCP server (query_ga4_report) to call the internal API (F1.6) securely (using the shared secret) |
| (R1) F1.4 | SSE Endpoint | Public HTTPS URL for the deployed MCP server |
| (User) F1.5 | Manual Client Setup Test | Manually construct and execute the npx install-mcp '<SSE_URL>' ... command locally to configure Cursor/Claude and verify connection/query flow |

#### Technical Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| (R1) T1.1 | fastmcp library | Use fastmcp library |
| (R2) T1.6 | Basic Next.js setup | Basic Next.js app setup, Drizzle/DB optional for MVP if using hardcoded credentials in API |
| (R1) T1.3 | Deployment configuration | Deployment configured for SSE |
| (R2) S1.3 | Secure API endpoint | Secure internal API endpoint (at least HTTPS + shared secret header) |

#### Security Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| (R1) S1.1 | HTTPS for SSE | Public SSE endpoint uses HTTPS |
| (R2) S1.2 | Credential handling structure | No real credentials stored yet, but structure for future secure handling should be considered |

### Phase 2: Multi-Client Agency Support & Portal V1

**Goal:** Enable agencies to onboard, manage multiple clients/credentials via the portal, and have the MCP server use these dynamic credentials.

#### Functional Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| (R2) F2.1 | Agency Portal V1 | Implement core web UI based on template:<br>- Agency Login/Signup (Clerk)<br>- Dashboard to list configured Agency Clients<br>- Form to add/edit Agency Clients (Client Name, **Client Identifier**, **GA4 Property ID**)<br>- **Trigger Nango connection flow** for each client and store the resulting **Nango Connection ID** associated with the client record.<br>- Display connection status (e.g., "Connected", "Needs Authentication")<br>- **(Post-Connection): Implement a mechanism (e.g., polling a status endpoint) to reliably detect when the Nango webhook has successfully updated the backend record before triggering property fetching.**<br>- Generate the npx install-mcp ... command (points to the single SSE URL) |
| (R2) F2.2 | Credential Backend | Implement full database schema (Agencies, AgencyClients, Credentials using Drizzle) and backend logic (Next.js Server Actions) for CRUD operations. **Database schema includes `nango_connection_id` field for each AgencyClient.** |
| (R2) T2.4 | Secure Internal Credential API (Get Connection Details) | Enhance the internal API (e.g., `/api/internal/get-connection-details`) to:<br>- Accept `client_identifier`<br>- Perform secure lookup in the database for the correct `property_id` and `nango_connection_id`<br>- Implement robust authentication/authorization (ensure only the MCP server can call)<br>- **Return BOTH `property_id` and `nango_connection_id`.** |
| (R1) F2.3 | Update MCP Query Tool | Update `query_ga4_report` to accept `client_identifier`. Call the secure internal API (T2.4) to get `property_id` and `nango_connection_id`. Use the `nango_connection_id` to **call the public Nango API** to fetch the access token. Use the token and `property_id` for the GA4 call. Implement robust error handling for credential lookup failures (internal and Nango). |
| (R2) F2.4 | Agency Data Isolation | Ensure DB queries and API logic strictly enforce agency boundaries |

#### Technical Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| (R2) T2.1 | Portal backend logic | Full implementation of Portal backend logic |
| (R2) T2.2 | Drizzle schema | Drizzle schema implementation and migrations (including `nango_connection_id`) |
| (R2) T2.3 | Secure credential flow | **Secure storage of Nango Connection IDs** and associated metadata in the database. |
| (R1/R2) T4.5 | API Security | Implement proper internal API security mechanism (Shared Secret Header) |
| **(R1) T2.5** | **Nango API Client (Repo 1)** | **Implement client in Repo 1 to call the public Nango API (`/connection/{id}`) to fetch credentials using a connection ID.** |

#### Security Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| (R2) S2.1 | Portal authentication | Secure Agency Portal authentication |
| (R2) S2.2 | Data isolation | Enforce data isolation between agencies |
| (R2) S2.3 | Credential handling | **Secure handling of Nango Connection IDs** and associated metadata. |
| (R1/R2) S2.4 | Secure communication | Secure communication channel between MCP server and internal credential API |
| **(R1) S2.5** | **Nango API Security (Repo 1)** | **Securely store and use `NANGO_SECRET_KEY` from environment variables when calling the public Nango API. Do not log the key.** |

### Phase 3: Enhanced GA4 Interaction & UX

**Goal:** Improve usability, add more GA4 tools, basic visualization/export.

#### Functional Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| (R2) F3.1 | Portal UX Improvements | Connection testing, clearer status, better error messages during setup |
| (R1) F3.2 | Add GA4 Helper Tools | list_available_fields(client_identifier), get_realtime_overview(client_identifier) |
| (R1) F3.3 | Basic Visualization Tool | create_bar_chart(data, x_column, y_column) tool returning fastmcp.Image (PNG) |
| (R1) F3.4 | Basic Export Tool | export_data_csv(data) tool returning CSV string |

#### Technical Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| (R1) T3.1 | GA4 APIs Integration | Integrate GA4 getMetadata, runRealtimeReport APIs |
| (R1) T3.2 | Pandas Integration | Integrate pandas |
| (R1) T3.3 | Visualization Libraries | Integrate matplotlib/seaborn |

#### Security Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| (R1) S3.1 | Input validation | Consider input validation/limits for visualization tools |

### Phase 4: Scalability, Monitoring & Advanced Features

**Goal:** Ensure service robustness, provide monitoring, add advanced features.

#### Functional Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| (R1) F4.1 | User Feedback | Implement user feedback for queued/delayed requests if queuing (T4.1) is added |
| (R2) F4.2 | Monitoring View | Basic monitoring view in Agency Portal |
| (R1) F4.3 | Advanced Visualization | (Optional) Add more chart types, PDF report generation tool |
| (R1/R2) F4.4 | MCP Authentication | (Optional) Implement authentication for the public MCP SSE endpoint |

#### Technical Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| (R1) T4.1 | Task Queue | Implement task queue (Celery/RQ) for GA4 API calls if needed for rate limiting/concurrency |
| (R1) T4.2 | Horizontal Scaling | Configure horizontal scaling for MCP server deployment |
| (R1/R2) T4.3 | Monitoring & Alerting | Implement comprehensive server-side monitoring and alerting (infra + application level) |
| (R1) T4.4 | PDF Integration | Integrate PDF libraries if needed |

#### Security Requirements

| ID | Requirement | Description |
|----|-------------|-------------|
| (R1/R2) S4.1 | Key Management | Securely manage keys if MCP endpoint auth is added |
| S4.2 | Security Reviews | Regular security reviews |

## Technical Architecture Overview

- **Repo 1 (MCP Server):** Python/fastmcp. Handles MCP protocol, defines GA4 tools, **calls Internal Connection Details API (Repo 2) to get mapping**, **calls public Nango API for token**, calls GA4 Data API. Runs via SSE.
- **Repo 2 (Portal/Backend):** Node.js/Next.js/React (based on mckays-app-template). Handles Agency Auth (Clerk), Agency/Client/Credential CRUD via Server Actions **(including storing Property ID <-> Nango Connection ID mapping)**, uses Postgres/Drizzle, provides secure Internal Connection Details API endpoint for Repo 1.
- **Database:** PostgreSQL (e.g., Supabase).
- **Secrets:** Cloud Provider Secrets Manager or equivalent secure storage. **Repo 1 needs Nango Secret Key.**
- **Client Config:** npx install-mcp.

## Security Considerations Summary

- Credential Security (Storage & Retrieval) is paramount **(focus on Nango Connection ID handling in Repo 2)**.
- Secure transport (HTTPS) for all external endpoints (SSE, Portal, **Nango API**).
- Secure communication & authentication between MCP Server and Internal Credential API.
- **Secure handling and usage of Nango Secret Key in Repo 1.**
- Secure Agency Portal authentication (via Clerk).
- Strict multi-tenant data isolation/authorization.
- GA4 API Rate Limit handling.
- Regular dependency updates and security audits.

## Non-Functional Requirements

- High Availability for both services.
- Reasonable latency for GA4 queries (acknowledging GA4 API variability).
- Scalability for concurrent users and agencies.
- Clear, usable Agency Portal onboarding.
- Robust error handling and logging in both services.

## Success Metrics

- **MVP:** End-to-end GA4 query successful via AI client configured with install-mcp. Internal API communication functional.
- **Phase 2:** # Agencies onboarded, # Clients configured, successful credential storage/retrieval rate, low setup-related support requests.
- **Phase 3:** Usage rate of helper/visualization tools.
- **Overall:** Active usage, query success rate, performance metrics, positive agency feedback.

## Open Questions & Future Considerations

- Specific internal API authentication mechanism (shared secret, JWT?).
- Detailed schema design for credential storage (store full JSON vs. reference?).
- Error handling strategy for GA4 API quota exhaustion.
- Choice of task queue if needed for rate limiting.
- Need for billing/subscription integration (template has Stripe).
- Long-term credential rotation/refresh strategy.
- Dynamic Property Discovery via Service Account: Should the service allow querying any property accessible by a single uploaded service account key? This would require integrating the GA4 Admin API (for discovery) and potentially modifying the MCP client interaction model (e.g., requiring property ID in queries), contrasting with the current design of mapping client_identifiers to specific properties in the portal.
