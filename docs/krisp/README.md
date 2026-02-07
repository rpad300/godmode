# Krisp AI Meeting Assistant Integration

This module integrates Krisp AI Meeting Assistant with GodMode, allowing automatic import of meeting transcriptions.

## Overview

The integration works via webhooks: when a meeting ends in Krisp, it sends a webhook to GodMode with the transcript and meeting metadata.

### Features

- **Automatic Transcript Import**: Meeting transcripts are automatically imported when available
- **Speaker Identification**: Matches speaker names to contacts in GodMode
- **Project Assignment**: Automatically assigns transcripts to projects based on identified speakers
- **Quarantine System**: Transcripts with unidentified speakers are quarantined for manual review
- **Retry Mechanism**: Periodic retry of quarantined transcripts

## Architecture

```
Krisp Cloud --> Webhook --> GodMode Server --> Process --> Documents
                              |
                              v
                     krisp_transcripts table
                              |
                     +--------+--------+
                     |                 |
                 Quarantine       Process Now
                     |                 |
                 Manual Review    Upload to Project
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `krisp_user_webhooks` | Webhook configuration per user |
| `krisp_transcripts` | Transcript metadata and processing state |
| `krisp_speaker_mappings` | Speaker name to contact mappings |
| `krisp_sync_state` | MCP sync state (admin) |

## Transcript Status Flow

```
pending --> quarantine (has unidentified speakers)
        --> ambiguous (project not clear)
        --> matched (ready to process)

quarantine --> matched (after speakers identified)
           --> skipped (manually discarded)

ambiguous --> matched (after manual assignment)
          --> skipped (manually discarded)

matched --> processed (uploaded to GodMode)
        --> failed (upload error)
```

## API Endpoints

### Webhook (Public)

- `POST /api/webhooks/krisp/:token` - Receive Krisp webhook events

### Authenticated Endpoints

#### Webhook Management
- `GET /api/krisp/webhook` - Get webhook configuration
- `POST /api/krisp/webhook` - Create/get webhook
- `POST /api/krisp/webhook/regenerate` - Regenerate credentials
- `PUT /api/krisp/webhook/toggle` - Enable/disable webhook
- `PUT /api/krisp/webhook/events` - Update enabled events

#### Transcripts
- `GET /api/krisp/transcripts` - List transcripts
- `GET /api/krisp/transcripts/summary` - Get summary counts
- `GET /api/krisp/transcripts/:id` - Get single transcript
- `POST /api/krisp/transcripts/:id/assign` - Assign to project
- `POST /api/krisp/transcripts/:id/skip` - Discard transcript
- `POST /api/krisp/transcripts/:id/retry` - Force retry

#### Speaker Mappings
- `GET /api/krisp/mappings` - List mappings
- `POST /api/krisp/mappings` - Create mapping
- `DELETE /api/krisp/mappings/:id` - Delete mapping

## Files

### Backend

| File | Description |
|------|-------------|
| `src/krisp/index.js` | Module exports |
| `src/krisp/WebhookHandler.js` | Process incoming webhooks |
| `src/krisp/SpeakerMatcher.js` | Match speakers to contacts |
| `src/krisp/TranscriptProcessor.js` | Process and upload transcripts |
| `src/krisp/QuarantineWorker.js` | Retry quarantined transcripts |

### Frontend

| File | Description |
|------|-------------|
| `src/frontend/services/krisp.ts` | API client |
| `src/frontend/components/modals/ProfileModal.ts` | Integrations tab |

### Database

| File | Description |
|------|-------------|
| `supabase/migrations/074_krisp_integration.sql` | Database schema |

## Configuration

No environment variables required. The integration uses the existing Supabase connection.

## Related Documentation

- [Webhook Setup Guide](./webhook-setup.md)
