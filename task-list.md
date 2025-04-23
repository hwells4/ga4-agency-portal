# FOR AI ASSISTANCE: REPOSITORY CONTEXT
> **IMPORTANT:** This document is part of **Repository #2: GA4 Agency Portal & Credential Backend**. This is the Next.js web application that provides the agency user interface, authentication, client management, and secure credential storage. It is NOT Repository #1 (the MCP Server that handles GA4 API interactions via fastmcp). This repository is responsible for the agency-facing portal, database, and internal credential API that the MCP server will call.

---

# GA4 MCP Service (SaaS) - Development Task List

## Table of Contents
- [Project Overview](#project-overview)
- [Repository Structure](#repository-structure)
- [Task Status Legend](#task-status-legend)
- [Phase 1: MVP - Core End-to-End Flow](#phase-1-mvp---core-end-to-end-flow)
  - [Repository 1: ga4-mcp-server (Python/fastmcp)](#repo1-phase1)
  - [Repository 2: ga4-agency-portal (Node.js/Next.js)](#repo2-phase1)
  - [Integration & E2E Testing](#integration-phase1)
- [Phase 2: Multi-Client Agency Support & Portal V1](#phase-2-multi-client-agency-support--portal-v1)
  - [Repository 2: Portal Enhancements](#repo2-phase2)
  - [Repository 1: MCP Server Updates](#repo1-phase2)
  - [Integration Testing](#integration-phase2)
- [Phase 3: Enhanced GA4 Interaction & UX](#phase-3-enhanced-ga4-interaction--ux)
- [Phase 4: Scalability, Monitoring & Advanced Features](#phase-4-scalability-monitoring--advanced-features)
- [Cross-Reference to PRD Requirements](#cross-reference-to-prd-requirements)

## Project Overview <a name="project-overview"></a>

**Goal:** Create a hosted MCP service allowing conversational GA4 data access via AI clients, with secure multi-client credential management for agencies.

## Repository Structure <a name="repository-structure"></a>

1. **ga4-mcp-server (Python/fastmcp)**
   - Handles MCP protocol and GA4 API interaction
   - Defines GA4 tools via Model Context Protocol
   - Communicates with the credential backend securely

2. **ga4-agency-portal (Node.js/Next.js)**
   - Handles agency UI, authentication, and credential management
   - Provides internal API for credential retrieval
   - Manages client configuration and security

## Task Status Legend <a name="task-status-legend"></a>

| Status | Description |
|--------|-------------|
| 🔄 | Not Started |
| ⏳ | In Progress |
| ✅ | Completed |
| 🚫 | Blocked |

## Phase 1: MVP - Core End-to-End Flow <a name="phase-1-mvp---core-end-to-end-flow"></a>

**Goal:** Establish a minimal working system with a hosted MCP server connecting to a basic backend API (returning hardcoded test credentials) to query GA4 for one test client, configurable via install-mcp.

### Repository 1: ga4-mcp-server (Python/fastmcp) <a name="repo1-phase1"></a>

#### Setup & Dependencies

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| 1.1 | Initialize project structure | Set up Python project using src layout | T1.1 | None | ✅ |
| 1.2 | Setup virtual environment | Create virtual environment using uv venv | T1.1 | 1.1 | ✅ |
| 1.3 | Install core dependencies | Run: `uv pip install fastmcp google-analytics-data httpx python-dotenv` | T1.1 | 1.2 | ✅ |
| 1.4 | Create base files | Create main.py, tools.py, ga4_client_adapter.py, internal_api_client.py | T1.1 | 1.3 | ✅ |

#### Internal API Client (internal_api_client.py)

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| 1.5 | Define fetch_connection_details function | `async def fetch_connection_details(client_identifier: str, api_url: str, api_secret: str) -> dict \| None`. **Should return dict with `property_id` and `nango_connection_id`.** | T1.4 | 1.4 | ✅ |
| 1.6 | Implement HTTP GET request | Use httpx to make HTTP GET to api_url | T1.4 | 1.5 | ✅ |
| 1.7 | Add security header | Add X-Internal-Secret header using api_secret | S1.3 | 1.6 | ✅ |
| 1.8 | Implement error handling | Handle HTTP errors (401, 404, 500) and connection errors | T1.4 | 1.6 | ✅ |
| 1.9 | Parse JSON response | Parse successful JSON response, return dict with `property_id`, `nango_connection_id` or None | T1.4 | 1.8 | ✅ |

#### GA4 Client Adapter (ga4_client_adapter.py)

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| 1.10 | Define execute_ga4_run_report function | `async def execute_ga4_run_report(access_token: str, property_id: str, report_request_args: dict) -> dict \| str` | F1.2 | 1.4 | ✅ |
| 1.11 | Initialize GA4 client | Implement BetaAnalyticsDataClient initialization **using `google.oauth2.credentials.Credentials(token=access_token)`** | F1.2 | 1.10 | ✅ |
| 1.12 | Construct RunReportRequest | Build request payload from property_id and report_request_args | F1.2 | 1.11 | ✅ |
| 1.13 | Execute GA4 API call | Call client.run_report within try/except block | F1.2 | 1.12 | ✅ |
| 1.14 | Parse response | Convert RunReportResponse to structured format | F1.2 | 1.13 | ✅ |
| 1.15 | Add error handling | Handle GoogleAPIError exceptions with user-friendly messages | F1.2 | 1.13 | ✅ |
| 1.15.1 | Add `google-auth` dependency | Add `google-auth` to `pyproject.toml` for token handling | T2.5 (Implicit) | 1.3 | ✅ |

#### Core GA4 MCP Tool (tools.py)

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| 1.16 | Define query_ga4_report tool | Create function decorated with @mcp.tool() | F1.2 | 1.4 | ✅ |
| 1.17 | Define tool parameters | **Add parameter `client_identifier: str`**. Other params: metrics, dimensions, date_range, etc. | F1.2 | 1.16 | ✅ |
| 1.18 | Read environment variables | **Get Internal API URL/Secret**, **Nango Base URL/Secret/Integration ID** from env vars | F1.2 | 1.17 | ✅ |
| 1.19 | Call fetch_connection_details | Use **internal_api_client** to get **`property_id`, `nango_connection_id`, `nango_provider_config_key`** via `/api/internal/get-creds`, handle errors | F1.2, T2.4 | 1.9, 1.18, 2.18.4 | ✅ |
| 1.20 | Extract connection data | Parse `property_id`, `nango_connection_id`, `nango_provider_config_key` from internal API response | F1.2 | 1.19 | ✅ |
| 1.20.1 | Call Nango API Client | **Use `nango_client.fetch_nango_credentials` with fetched `nango_connection_id`+`key` to get `access_token`, handle errors** | F2.3, T2.5 | 1.20, 1.35 | ✅ |
| 1.21 | Prepare request arguments | Build report_request_args dict from tool parameters | F1.2 | 1.20 | ✅ |
| 1.22 | Call GA4 adapter | Execute `ga4_client_adapter.execute_ga4_run_report` **passing `access_token` and `property_id`** | F1.2 | 1.15, 1.20.1, 1.21 | ✅ |
| 1.23 | Return formatted result | Return data/error as JSON string | F1.2 | 1.22 | ✅ |

#### Server Main (main.py)

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| 1.24 | Import dependencies | Import FastMCP and query_ga4_report tool | F1.1 | 1.23 | ✅ |
| 1.25 | Instantiate FastMCP | Create mcp = FastMCP(...) instance | F1.1 | 1.24 | ✅ |
| 1.26 | Register tools | Add query_ga4_report to server | F1.1 | 1.25 | ✅ |
| 1.27 | Implement main block | Create if __name__ == "__main__" block | F1.1 | 1.26 | ✅ |
| 1.28 | Configure from env vars | Read PORT and HOST from environment variables | F1.1 | 1.27 | ✅ |
| 1.29 | Run SSE server | Call mcp.run(transport="sse", host=host, port=port) | T1.3 | 1.28 | ✅ |

#### Deployment & Configuration

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| 1.30 | Create dependency file | Create requirements.txt or pyproject.toml | F1.1 | 1.3 | ✅ |
| 1.31 | Create Dockerfile | Prepare Dockerfile for deployment | F1.1 | 1.30 | ✅ |
| 1.32 | Deploy to hosting | Deploy to platform like Railway | F1.1 | 1.31 | ✅ |
| 1.33 | Configure environment | Set **INTERNAL_API_URL**, **INTERNAL_API_SECRET**, **NANGO_BASE_URL**, **NANGO_SECRET_KEY**, **NANGO_INTEGRATION_ID** on hosting | F1.1 | 1.32 | ✅ |
| 1.34 | Document SSE URL | Record the public HTTPS SSE URL for client setup | F1.4 | 1.33 | ✅ |
| 1.35 | Create Nango API Client | Create `src/nango_client.py` with `fetch_nango_credentials` to call public Nango API | T2.5 | 1.4 | ✅ |

### Repository 2: ga4-agency-portal (Node.js/Next.js) <a name="repo2-phase1"></a>

#### Setup & Dependencies

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| 2.1 | Initialize Next.js project | Clone template or create new project | T1.5 | None | ✅ |
| 2.2 | Install dependencies | Run npm install | T1.5 | 2.1 | ✅ |
| 2.3 | Configure environment | Setup basic .env.local file | T1.5 | 2.2 | ✅ |

#### Internal Credential API

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| 2.4 | Create API endpoint | Add route.ts in `app/api/internal/get-creds/` | T1.6 | 2.3 | ✅ |
| 2.5 | Implement security check | Verify X-Internal-Secret header against env var | S1.3 | 2.4 | ✅ |
| 2.6 | Return hardcoded response | For MVP, return test **`propertyId` AND test `nangoConnectionId`** JSON | T1.6 | 2.5 | 🚫 |
| 2.7 | Add placeholder comments | Document future DB/credential handling plans | S1.2 | 2.6 | ✅ |

#### Deployment & Configuration

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| 2.8 | Deploy Next.js app | Deploy to platform like Vercel/Railway | T1.5 | 2.7 | ✅ |
| 2.9 | Configure environment | Set INTERNAL_API_SHARED_SECRET on hosting | S1.3 | 2.8 | ✅ |
| 2.10 | Secure API endpoint | Restrict access to MCP server if possible | S1.3 | 2.9 | ✅ |

### Integration & E2E Testing <a name="integration-phase1"></a>

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| 3.1 | Verify deployments | Ensure both services are running | F1.1, T1.5 | 1.34, 2.10 | ✅ |
| 3.2 | Configure shared secrets | Use same secret value in both environments | S1.3 | 1.33, 2.9 | ✅ |
| 3.3 | Create install-mcp command | Construct command with SSE URL | F1.5 | 1.34 | 🔄 |
| 3.4 | Configure AI client | Run command to configure Cursor/Claude | F1.5 | 3.3 | ✅ |
| 3.5 | Test query flow | Perform test query with client_identifier | F1.5 | 3.4 | ✅ |
| 3.6 | Verify logs & response | Check logs in both services, verify response | F1.5 | 3.5 | ✅ |

## Phase 2: Multi-Client Agency Support & Portal V1 <a name="phase-2-multi-client-agency-support--portal-v1"></a>

### Repository 2: Portal Enhancements <a name="repo2-phase2"></a>

#### Database Setup

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| 2.11 | Configure Drizzle ORM | Set up connection to PostgreSQL/Supabase | T2.2 | 2.10 | ✅ |
| 2.12 | Define database schemas | Create schemas for Agencies, AgencyClients, Credentials. **Ensure AgencyClients schema includes `property_id` and `nango_connection_id`, `nango_provider_config_key`** | T2.2 | 2.11 | ✅ |
| 2.13 | Run migrations | Execute npx drizzle-kit generate/migrate | T2.2 | 2.12 | 🔄 |

#### Authentication & Backend Logic

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| 2.14 | Configure Clerk auth | Set up authentication with Clerk | F2.1, S2.1 | 2.10 | ✅ |
| 2.15 | Implement Server Actions | Create CRUD operations in actions/db/ | F2.2 | 2.13 | 🔄 |
| 2.16 | Add Nango connection handling | Implement **Nango connection flow trigger** and storage of `nango_connection_id` in DB | T2.3, S2.3 | 2.15 | ✅ |
| 2.17 | Enforce data isolation | Add agency boundary checks to all queries | F2.4, S2.2 | 2.15 | 🔄 |
| 2.17.1 | Fix Clerk Middleware | Update `middleware.ts` to correctly protect portal API routes | S2.1 | 2.14 | ✅ |

#### Internal Credential API Enhancement

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| 2.18 | Enhance API endpoint | Use existing `/api/internal/get-creds` route for real database lookups | T2.4 | 2.17 | ✅ |
| 2.18.1 | Accept client_identifier | Use passed client_identifier for lookups | T2.4 | 2.18 | ✅ |
| 2.18.2 | Implement DB lookup | Query database for client to get **`property_id`, `nango_connection_id`, and `nango_provider_config_key`** | T2.4 | 2.18.1 | ✅ |
| 2.18.3 | Return connection details | Format and return actual `property_id`, `nango_connection_id`, and `nango_provider_config_key` | T2.4 | 2.18.2 | ✅ |
| 2.18.4 | Add error handling | Handle not found, unauthorized, etc. | T2.4 | 2.18.3 | ✅ |
| 2.18.5 | Create Status Check API | Add `GET /api/nango/check-status/[agencyClientId]` route | F2.1 (Implied) | 2.13 | ✅ |

#### Agency Portal UI

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| 2.19 | Create Portal UI | Build Next.js pages with Shadcn UI | F2.1 | 2.17 | 🔄 |
| 2.19.1 | Build Agency Dashboard | List view of agency clients | F2.1 | 2.19 | 🔄 |
| 2.19.2 | Create Client Form | Add/Edit form for client configuration **(Must include input for ga4PropertyId)** | F2.1 | 2.19.1 | 🔄 |
| 2.19.3 | Add Nango connection trigger | **Add UI to trigger Nango connection flow** for a specific client record (needs UI work) | F2.1 | 2.19.2 | 🔄 |
| 2.19.4 | Show connection status | Display validation status for Nango connections (needs UI work) | F2.1 | 2.19.3 | 🔄 |
| 2.19.5 | Add setup command generator | Create "Copy Setup Command" button | F2.1 | 2.19.4 | 🔄 |

#### Testing

| ID   | Task                      | Description                                                                     | PRD Ref         | Dependencies | Status |
|------|---------------------------|---------------------------------------------------------------------------------|-----------------|--------------|--------|
| 2.20 | Write backend tests       | Test Server Actions and API logic                                               | F2.2, T2.4      | 2.18         | 🔄      |
| 2.21 | Test Portal UI            | Manually test the complete UI flow                                              | F2.1            | 2.19.5       | 🔄      |
| 2.22 | **Test Nango Connection**   | **Verify `fetchGa4PropertiesAction` works after Nango connection/webhook/polling** | F2.1, F2.2      | 2.16, 2.24.2 | ✅      |
| 2.23 | **Verify Nango Webhook**  | **Confirm Nango webhook successfully triggers callback & DB update.**           | F2.2, T2.3      | 2.16, 2.18.4 | ✅      |
| 2.24 | Implement Connection Polling| **Add frontend logic to poll `/api/nango/check-status` for webhook completion status.** (Implemented in test component) | F2.1 (Implied)  | 2.18.5, 2.23 | ✅      |
| 2.24.1 | Debug Build Errors | Resolved persistent build error for dynamic route handler signature (required `"use server"` + `await params`) | N/A | 2.18.5 | ✅ |
| 2.24.2 | Debug Runtime Errors | Resolved 401 polling errors (Middleware, fetch credentials) and Nango ID mismatch | N/A | 2.24, 2.17.1 | ✅ |

### Repository 1: MCP Server Updates <a name="repo1-phase2"></a>

| ID   | Task                             | Description                                                                    | PRD Ref | Dependencies | Status |
|------|----------------------------------|--------------------------------------------------------------------------------|---------|--------------|--------|
| 1.35 | Update query_ga4_report          | **MCP Tool updated to call Internal API, then Nango API for token** | F2.3    | 2.18.4       | ✅      |
| 1.36 | Add credential error handling    | Handle cases where internal API or Nango API calls fail                        | F2.3    | 1.35         | ✅      |
| 1.37 | Write credential tests           | Add tests for dynamic credential handling via internal API and Nango calls     | F2.3    | 1.36         | 🔄      |

### Integration Testing <a name="integration-phase2"></a>

| ID     | Task                                       | Description                                                                     | PRD Ref         | Dependencies | Status |
|--------|--------------------------------------------|---------------------------------------------------------------------------------|-----------------|--------------|--------|
| 3.7    | Perform E2E test with multiple clients     | Test complete flow with real credentials                                        | F2.3, F2.4      | 1.37, 2.21   | 🔄      |
| 3.7.1  | Configure test clients                     | Add 2-3 test clients with valid properties/credentials **(requires UI/actions)**  | F2.1            | 3.7          | 🔄      |
| 3.7.2  | Test client-specific queries               | Verify correct property selection based on client_identifier **(requires Repo 1)**| F2.3            | 3.7.1        | 🔄      |

## Phase 3: Enhanced GA4 Interaction & UX <a name="phase-3-enhanced-ga4-interaction--ux"></a>

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| P3.1 | Add GA4 helper tools | Implement list_available_fields, get_realtime_overview | F3.2 | 1.37 | 🔄 |
| P3.2 | Add pandas dependency | Install and integrate pandas for data manipulation | T3.2 | P3.1 | 🔄 |
| P3.3 | Create visualization tool | Implement create_bar_chart using matplotlib | F3.3, T3.3 | P3.2 | 🔄 |
| P3.4 | Create export tool | Implement export_data_csv | F3.4 | P3.2 | 🔄 |
| P3.5 | Enhance Portal UI/UX | Improve feedback, error messages, and user experience | F3.1 | 2.21 | 🔄 |

## Phase 4: Scalability, Monitoring & Advanced Features <a name="phase-4-scalability-monitoring--advanced-features"></a>

| ID | Task | Description | PRD Ref | Dependencies | Status |
|----|------|-------------|---------|--------------|--------|
| P4.1 | Research task queuing | Evaluate Celery+Redis for rate limiting | T4.1 | P3.5 | 🔄 |
| P4.2 | Configure horizontal scaling | Enable scaling for MCP server | T4.2 | P4.1 | 🔄 |
| P4.3 | Set up monitoring | Implement comprehensive monitoring for both services | T4.3 | P4.2 | 🔄 |
| P4.4 | Add MCP authentication (optional) | Add optional auth to public MCP endpoint | F4.4, S4.1 | P4.3 | 🔄 |
| P4.5 | Create advanced visualizations (optional) | Add more chart types and PDF reports | F4.3, T4.4 | P3.3 | 🔄 |

## Cross-Reference to PRD Requirements <a name="cross-reference-to-prd-requirements"></a>

### Functional Requirements

| PRD ID | Description | Implemented In Tasks |
|--------|-------------|---------------------|
| F1.1 | Hosted MCP Server | 1.24-1.29, 1.32 |
| F1.2 | Core GA4 Query Tool | 1.10-1.23 |
| F1.4 | SSE Endpoint | 1.34 |
| F1.5 | Manual Client Setup Test | 3.3-3.6 |
| F2.1 | Agency Portal V1 | 2.14, 2.19-2.19.5 |
| F2.2 | Credential Backend | 2.15-2.16 |
| F2.3 | Update MCP Query Tool | 1.35-1.36 |
| F2.4 | Agency Data Isolation | 2.17 |
| F3.1 | Portal UX Improvements | P3.5 |
| F3.2 | Add GA4 Helper Tools | P3.1 |
| F3.3 | Basic Visualization Tool | P3.3 |
| F3.4 | Basic Export Tool | P3.4 |
| F4.1 | User Feedback | P4.1 |
| F4.2 | Monitoring View | P4.3 |
| F4.3 | Advanced Visualization | P4.5 |
| F4.4 | MCP Authentication | P4.4 |

### Technical Requirements

| PRD ID | Description | Implemented In Tasks |
|--------|-------------|---------------------|
| T1.1 | fastmcp library | 1.1-1.4 |
| T1.3 | Deployment configuration | 1.29-1.33 |
| T1.4 | Internal API Client | 1.5-1.9 |
| T1.5 | Basic Portal Backend | 2.1-2.3 |
| T1.6 | Minimal Internal Credential API | 2.4-2.7 |
| T2.1 | Portal backend logic | 2.14-2.17 |
| T2.2 | Drizzle schema | 2.11-2.13 |
| T2.3 | Secure credential flow | 2.16 |
| T2.4 | Secure Internal Credential API | 2.18-2.18.4 |
| T3.1 | GA4 APIs Integration | P3.1 |
| T3.2 | Pandas Integration | P3.2 |
| T3.3 | Visualization Libraries | P3.3 |
| T4.1 | Task Queue | P4.1 |
| T4.2 | Horizontal Scaling | P4.2 |
| T4.3 | Monitoring & Alerting | P4.3 |
| T4.4 | PDF Integration | P4.5 |

### Security Requirements

| PRD ID | Description | Implemented In Tasks |
|--------|-------------|---------------------|
| S1.1 | HTTPS for SSE | 1.32-1.34 |
| S1.2 | Credential handling structure | 2.7 |
| S1.3 | Secure API endpoint | 1.7, 2.5, 2.10 |
| S2.1 | Portal authentication | 2.14 |
| S2.2 | Data isolation | 2.17 |
| S2.3 | Credential handling | 2.16 |
| S2.4 | Secure communication | 1.7, 2.5 |
| S3.1 | Input validation | P3.3, P3.4 |
| S4.1 | Key Management | P4.4 |

## Phase X: Multi-Property Refactor <a name="phase-x-multi-property-refactor"></a>
**Goal:** Adapt the system to handle multiple GA4 properties accessible via a single Nango connection.
*Note: Some initial multi-property schema aspects were added in Phase 2, but this phase focuses on the full refactor and UX.*

| ID   | Task                             | Description                                                                                                 | Repo | Dependencies | Status |
|------|----------------------------------|-------------------------------------------------------------------------------------------------------------|------|--------------|--------|
| X.1  | Refactor Schema                  | Remove/Relax `ga4PropertyId` constraint from `agencyClientsTable`. Rename to `propertyId` if needed.        | R2   | 2.12         | 🔄      |
| X.2  | Update Internal API              | Modify `/api/internal/get-creds` to *not* query or return `property_id`.                                  | R2   | 2.18.4, X.1  | 🔄      |
| X.3  | Update MCP Tool `query_ga4_report`| Add required `property_id: str` parameter. Use this user-provided ID for the GA4 API call.                  | R1   | 1.36, X.2    | 🔄      |
| X.4  | (Optional) Implement Discovery Tool | Create `list_ga4_properties(client_identifier: str)` tool using GA4 Admin API via Nango credentials.   | R1   | X.2          | 🔄      |
| X.5  | Update Portal Property Handling  | Implement UI/backend logic for fetching, displaying, and potentially selecting/storing properties post-Nango. | R2   | 2.24.2       | 🔄      |


## Phase Y: Enhanced Onboarding Flow <a name="phase-y-enhanced-onboarding"></a>
**Goal:** Implement a smoother user onboarding experience that automatically creates initial records, guides GA4 connection, and allows bulk property selection/naming.

| ID   | Task                                  | Description                                                                                 | Repo | Dependencies      | Status |
|------|---------------------------------------|---------------------------------------------------------------------------------------------|------|-------------------|--------|
| Y.1  | Backend: Auto-create Profile/Agency   | Implement Clerk webhook (`organization.created`) handler to create `Agency` record.       | R2   | 2.12 (Confirmed)  | ✅      |
| Y.2  | Backend: GA4 Property Discovery Action| Create `discoverGa4PropertiesAction` using Nango token & GA4 Admin API.                     | R2   | 2.16,googleapis   | 🔄      |
| Y.3  | Frontend/Backend: Trigger Discovery   | Call `discoverGa4PropertiesAction` after successful Nango connection confirmation.            | R2   | 2.24.2, Y.2       | 🔄      |
| Y.4  | Frontend: Property Selection UI       | Create modal/form (`PropertySelectionForm`) to display properties, allow selection & naming.| R2   | Y.3               | 🔄      |
| Y.5  | Backend: Bulk Client Creation Action  | Create `bulkCreateAgencyClientsAction` to save selected properties to `agencyClientsTable`. | R2   | X.1 (Modify Schema), Y.4 | 🔄      |
| Y.6  | Frontend: Connect UI to Bulk Action   | Wire up `PropertySelectionForm` submission to call `bulkCreateAgencyClientsAction`.           | R2   | Y.4, Y.5          | 🔄      |