# GodMode API Documentation

## Overview

GodMode provides a RESTful API for managing knowledge bases, documents, and AI-powered processing. This document covers all available endpoints, authentication, and usage examples.

## Base URL

```
http://localhost:3005/api
```

## Authentication

### Bearer Token Authentication

Most endpoints require authentication via Bearer token in the `Authorization` header:

```http
Authorization: Bearer <your-access-token>
```

### API Key Authentication

For programmatic access, you can use API keys:

```http
X-API-Key: gm_<your-api-key>
```

## Response Format

All responses are JSON with this structure:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## Authentication Endpoints

### Check Auth Status

```http
GET /api/auth/status
```

Returns whether Supabase authentication is configured.

**Response:**
```json
{
  "configured": true
}
```

### Register

```http
POST /api/auth/register
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

### Login

```http
POST /api/auth/login
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "access_token": "eyJ...",
    "refresh_token": "...",
    "expires_at": 1234567890
  },
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

### Logout

```http
POST /api/auth/logout
```

**Response:**
```json
{
  "success": true
}
```

### Forgot Password

```http
POST /api/auth/forgot-password
```

**Body:**
```json
{
  "email": "user@example.com"
}
```

---

## User Endpoints

### Get Profile

```http
GET /api/user/profile
```

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "profile": {
    "username": "johndoe",
    "display_name": "John Doe",
    "avatar_url": null,
    "role": "user",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Update Profile

```http
PUT /api/user/profile
```

**Body:**
```json
{
  "username": "johndoe",
  "display_name": "John Doe"
}
```

### List User Projects

```http
GET /api/user/projects
```

**Response:**
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "My Project",
      "description": "...",
      "user_role": "owner",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## Project Endpoints

### List Projects

```http
GET /api/projects
```

**Response:**
```json
{
  "projects": [
    {
      "id": "3ab44397",
      "name": "Default Project",
      "factsCount": 10,
      "questionsCount": 5
    }
  ]
}
```

### Get Project Stats

```http
GET /api/projects/:id/stats
```

**Response:**
```json
{
  "stats": {
    "members": 3,
    "comments": 15,
    "recentActivity": 42,
    "sync": {
      "health_status": "healthy",
      "pending_count": 0
    }
  }
}
```

### Create Project (Supabase)

```http
POST /api/supabase-projects
```

**Body:**
```json
{
  "name": "New Project",
  "description": "Project description"
}
```

---

## Project Members

### List Members

```http
GET /api/projects/:id/members
```

**Response:**
```json
{
  "members": [
    {
      "user_id": "uuid",
      "role": "owner",
      "username": "johndoe",
      "display_name": "John Doe",
      "joined_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Add Member

```http
POST /api/projects/:id/members
```

**Body:**
```json
{
  "userId": "uuid",
  "role": "write"
}
```

### Update Member Role

```http
PUT /api/projects/:id/members/:userId
```

**Body:**
```json
{
  "role": "admin"
}
```

### Remove Member

```http
DELETE /api/projects/:id/members/:userId
```

---

## Invitations

### List Invites

```http
GET /api/projects/:id/invites
```

### Create Invite

```http
POST /api/projects/:id/invites
```

**Body:**
```json
{
  "role": "write",
  "email": "invitee@example.com",
  "expiresInHours": 48
}
```

**Response:**
```json
{
  "success": true,
  "invite": {
    "id": "uuid",
    "token": "abc123...",
    "expires_at": "2024-01-03T00:00:00Z"
  }
}
```

### Accept Invite

```http
POST /api/invites/:token/accept
```

### Revoke Invite

```http
DELETE /api/invites/:id
```

---

## Activity Log

### Get Project Activity

```http
GET /api/projects/:id/activity
```

**Query Parameters:**
- `limit` (default: 50)
- `offset` (default: 0)

**Response:**
```json
{
  "activity": [
    {
      "id": "uuid",
      "action": "content.created",
      "actor_id": "uuid",
      "target_type": "fact",
      "target_id": "fact-123",
      "metadata": {},
      "created_at": "2024-01-01T12:00:00Z"
    }
  ]
}
```

---

## Comments

### List Comments

```http
GET /api/projects/:id/comments
```

**Query Parameters:**
- `targetType` - entity type (fact, question, document)
- `targetId` - entity ID
- `includeThreads` (default: true)

### Create Comment

```http
POST /api/projects/:id/comments
```

**Body:**
```json
{
  "targetType": "fact",
  "targetId": "fact-123",
  "content": "This is a comment with @username mention",
  "parentId": null
}
```

### Update Comment

```http
PUT /api/comments/:id
```

### Delete Comment

```http
DELETE /api/comments/:id
```

### Resolve Comment

```http
POST /api/comments/:id/resolve
```

---

## Notifications

### List Notifications

```http
GET /api/notifications
```

**Query Parameters:**
- `unreadOnly` (default: false)
- `limit` (default: 50)

### Get Unread Count

```http
GET /api/notifications/unread-count
```

### Mark as Read

```http
PUT /api/notifications/:id/read
```

### Mark All as Read

```http
PUT /api/notifications/read-all
```

---

## Search

### Global Search

```http
GET /api/search
```

**Query Parameters:**
- `q` - search query (required)
- `projectId` - limit to project
- `types` - comma-separated (users,comments,projects)

### Mention Suggestions

```http
GET /api/projects/:id/mentions
```

**Query Parameters:**
- `prefix` - text after @ symbol

---

## API Keys (Enterprise)

### List API Keys

```http
GET /api/projects/:id/api-keys
```

### Create API Key

```http
POST /api/projects/:id/api-keys
```

**Body:**
```json
{
  "name": "CI/CD Key",
  "description": "For automated deployments",
  "permissions": ["read", "write"],
  "rateLimitPerMinute": 60,
  "expiresAt": "2025-01-01T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "apiKey": {
    "id": "uuid",
    "key": "gm_abc123...",
    "name": "CI/CD Key"
  }
}
```

> **Important:** The full key is only shown once at creation time.

### Revoke API Key

```http
DELETE /api/api-keys/:id
```

---

## Webhooks (Enterprise)

### List Webhooks

```http
GET /api/projects/:id/webhooks
```

### Create Webhook

```http
POST /api/projects/:id/webhooks
```

**Body:**
```json
{
  "name": "Slack Notifications",
  "url": "https://hooks.slack.com/...",
  "events": ["content.created", "content.updated"],
  "customHeaders": {
    "X-Custom": "value"
  }
}
```

### Test Webhook

```http
POST /api/webhooks/:id/test
```

### Delete Webhook

```http
DELETE /api/webhooks/:id
```

### Webhook Events

| Event | Description |
|-------|-------------|
| `content.created` | New fact/document created |
| `content.updated` | Content modified |
| `content.deleted` | Content removed |
| `member.added` | Team member joined |
| `member.removed` | Team member left |
| `comment.created` | New comment added |

### Webhook Payload Format

```json
{
  "event": "content.created",
  "timestamp": "2024-01-01T12:00:00Z",
  "project_id": "uuid",
  "data": {
    "id": "entity-id",
    "type": "fact",
    "content": "..."
  }
}
```

### Signature Verification

Webhooks include an HMAC-SHA256 signature in the `X-Webhook-Signature` header:

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return signature === expected;
}
```

---

## Audit Export (Enterprise)

### List Export Jobs

```http
GET /api/projects/:id/audit-exports
```

### Create Export Job

```http
POST /api/projects/:id/audit-exports
```

**Body:**
```json
{
  "dateFrom": "2024-01-01",
  "dateTo": "2024-12-31",
  "format": "json",
  "filters": {
    "actions": ["content.created", "content.updated"]
  }
}
```

### Download Export

```http
GET /api/audit-exports/:id/download
```

---

## Graph Sync

### Get Sync Status

```http
GET /api/projects/:id/sync/status
```

**Response:**
```json
{
  "status": {
    "health_status": "healthy",
    "pending_count": 0,
    "last_sync_at": "2024-01-01T12:00:00Z",
    "error_count_24h": 0
  }
}
```

### Get Sync Statistics

```http
GET /api/projects/:id/sync/stats
```

### Get Dead Letters

```http
GET /api/projects/:id/sync/dead-letters
```

### Retry Dead Letter

```http
POST /api/sync/dead-letters/:id/retry
```

### Resolve Dead Letter

```http
POST /api/sync/dead-letters/:id/resolve
```

---

## Rate Limiting

API endpoints are rate limited:

| Tier | Requests/min | Requests/day |
|------|-------------|--------------|
| Free | 60 | 1,000 |
| Pro | 300 | 10,000 |
| Enterprise | 1,000 | Unlimited |

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1704067200
```

---

## Error Handling

### Common Errors

**401 Unauthorized**
```json
{
  "error": "Authentication required",
  "code": "AUTH_REQUIRED"
}
```

**403 Forbidden**
```json
{
  "error": "Insufficient permissions",
  "code": "PERMISSION_DENIED"
}
```

**429 Too Many Requests**
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMITED",
  "retryAfter": 60
}
```

---

## SDKs & Examples

### cURL Example

```bash
# Login
curl -X POST http://localhost:3005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Get projects (with auth)
curl http://localhost:3005/api/projects \
  -H "Authorization: Bearer eyJ..."
```

### JavaScript Example

```javascript
const BASE_URL = 'http://localhost:3005/api';

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return res.json();
}

async function getProjects(token) {
  const res = await fetch(`${BASE_URL}/projects`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.json();
}
```

---

## Changelog

### v1.0.0 (2024-01)
- Initial API release
- Authentication (register, login, logout)
- Projects, Members, Invites
- Comments with mentions
- Notifications
- API Keys & Webhooks
- Audit Export
- Graph Sync
