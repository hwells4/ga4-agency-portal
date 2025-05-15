# Migrating to Self-Hosted Nango

## Overview

This document outlines the process of migrating the GA4 Agency Portal from using Nango's hosted service to a self-hosted Nango instance. This migration will provide greater control over the OAuth integration and credential storage while maintaining all existing functionality.

## Background

The GA4 Agency Portal currently uses Nango's hosted service for:
1. OAuth connections to Google Analytics accounts
2. Securely storing access tokens
3. Refreshing tokens automatically
4. Providing a user-friendly connection UI

Migrating to a self-hosted version maintains these capabilities while giving us full control over the infrastructure.

## Required Changes

### 1. Environment Variables

Update the following environment variables in `.env.local`:

```
# Current
NANGO_SECRET_KEY=your_current_hosted_nango_key

# Add new variables
NANGO_BASE_URL=https://your-self-hosted-nango-instance.com
NEXT_PUBLIC_NANGO_BASE_URL=https://your-self-hosted-nango-instance.com
NEXT_PUBLIC_NANGO_PUBLIC_KEY=your_self_hosted_nango_public_key
```

### 2. Frontend Nango Client Configuration

Update the client-side Nango initialization in `app/agency/settings/connections/_components/connect-nango-button.tsx`:

```typescript
// Current implementation
const nango = new Nango()

// Updated implementation
const nango = new Nango({
  publicKey: process.env.NEXT_PUBLIC_NANGO_PUBLIC_KEY,
  baseUrl: process.env.NEXT_PUBLIC_NANGO_BASE_URL
})
```

### 3. Server-Side Nango Client Configuration

Update the server-side Nango initialization in `actions/nango-actions.ts`:

```typescript
// Current implementation
const nango = new Nango({
  secretKey: process.env.NANGO_SECRET_KEY!
})

// Updated implementation
const nango = new Nango({
  secretKey: process.env.NANGO_SECRET_KEY!,
  baseUrl: process.env.NANGO_BASE_URL
})
```

### 4. MCP Server Environment Variables (if applicable)

While not part of this repository, the MCP server (Python) also needs the updated Nango base URL:

```
NANGO_BASE_URL=https://your-self-hosted-nango-instance.com
```

## Self-Hosted Nango Configuration

### 1. Set Up Nango Instance

Follow the [official Nango self-hosting documentation](https://docs.nango.dev/self-host/overview) to deploy your Nango instance with:

- Docker Compose or Kubernetes
- PostgreSQL database for Nango
- Proper network configuration for secure access

### 2. Configure OAuth Provider

In your self-hosted Nango dashboard:

1. Create a new provider configuration for Google Analytics:
   - Name: `google-analytics`
   - Provider: Google
   - Required scopes: 
     - `https://www.googleapis.com/auth/analytics`
     - `https://www.googleapis.com/auth/analytics.readonly`
   
2. Set up your OAuth credentials:
   - Client ID: Your Google OAuth client ID
   - Client Secret: Your Google OAuth client secret
   - Redirect URI: `https://your-self-hosted-nango-instance.com/oauth/callback`

3. Configure webhook notifications:
   - Set the callback URL to: `https://your-ga4-agency-portal.com/api/nango/callback`

## Testing Plan

After implementing these changes, verify the migration with:

1. **Connection Test**: Initiate a new Google Analytics connection from the portal UI
2. **Property Discovery**: Confirm GA4 properties are successfully retrieved after connection
3. **API Validation**: Ensure the internal API `/api/internal/get-creds` returns correct Nango connection IDs
4. **End-to-End Test**: Test the MCP server's ability to fetch credentials and query GA4

## Rollback Plan

If issues arise, you can revert to the hosted Nango service by:

1. Restoring the original environment variables
2. Removing the `baseUrl` parameter from Nango client initializations
3. Ensuring MCP server environment variables are reverted

## Additional Notes

- No database schema changes are required since we store only Nango connection references
- The internal API structure remains unchanged
- Existing connected accounts should continue working after migrating their connection records 