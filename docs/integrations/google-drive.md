# Google Drive Integration

Store uploads and transcripts in Google Drive. Uploads use a system-level service account; reads (download, thumbnail, Team Analysis) use project-level credentials with fallback to system.

## Overview

- **Uploads**: System service account. Files go to project folders under a configurable root folder.
- **Storage**: Document records use `filepath: gdrive:<FileID>`.
- **Reads**: Project secret `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` (or system fallback).

## Architecture

- **Write path**: POST `/api/upload` → check system config + project `settings.googleDrive.folders` → upload to Drive → insert document with `gdrive:<FileID>`.
- **Read path**: Download/thumbnail/Team Analyzer detect `gdrive:` → `getDriveClientForRead(projectId)` → download from Drive.

## Configuration

### System (superadmin)

1. **Admin Panel → Google Drive**: Enable, set **Root Folder ID**, paste **System Service Account JSON**, Save.
2. **Bootstrap all projects**: Creates per-project folders (uploads, newtranscripts, archived, exports) under the root and saves IDs in `projects.settings.googleDrive`.

### Project credentials (for read/download)

- Add secret: scope `project`, name `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`, value = full JSON key (e.g. via Admin → Secrets or API).
- If not set, the system falls back to the system service account for read.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/system/google-drive` | State for UI: `enabled`, `rootFolderId`, `hasSystemCredentials`, `bootstrappedAt`. |
| POST | `/api/system/google-drive` | Body: `enabled`, `rootFolderId?`, `serviceAccountJson?`. |
| POST | `/api/system/google-drive/bootstrap-all` | Create folder structure for all projects. |

## Key files

| File | Purpose |
|------|---------|
| `src/integrations/googleDrive/drive.js` | `getDriveClientForSystem`, `getDriveClientForRead`, `uploadFile`, `downloadFile`, `ensureFolder`. |
| `src/features/googleDrive/routes.js` | GET/POST config, POST bootstrap-all. |
| `src/features/files/routes.js` | Upload branch: Drive when enabled + project has folder IDs. |
| `src/features/documents/routes.js` | Download and thumbnail: `gdrive:` → stream from Drive. |
| `src/team-analysis/TeamAnalyzer.js` | `getTranscriptsForPerson`: load content from `gdrive:` via Drive. |
| `src/processor.js` | `processAllContentFirst`: include pending docs with `gdrive:` filepath; download to temp and process. |

## Troubleshooting

- **"File not found" / "Download failed"**  
  Project has no `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` (and system fallback may be disabled or missing). Add project secret or ensure system credentials exist.

- **"Google Drive upload failed"**  
  System credentials missing or invalid; or bootstrap not run so `projects.settings.googleDrive.folders` has no IDs. Run Bootstrap all projects and check Root Folder ID.

- **Missing Google Drive credentials in getDriveClientForProject**  
  Log message when project read is attempted without project or system credentials. Configure project secret or system secret.

## Audit

- **Config save** (POST `/api/system/google-drive`): audited via `system_config` trigger (key `google_drive`).
- **Bootstrap** (POST `/api/system/google-drive/bootstrap-all`): explicit entry in `config_audit_log` with `config_key: google_drive_bootstrap`, `new_value: { bootstrappedAt, projectsCount, failedCount }`. Visible in Admin → Config Audit.

## Data

- **system_config**: key `google_drive`, value `{ enabled, rootFolderId }`; key `google_drive_last_bootstrap` for last bootstrap metadata.
- **secrets**: `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` (scope system and optionally project).
- **projects.settings**: `googleDrive: { projectFolderId, folders: { uploads, newtranscripts, archived, exports }, bootstrappedAt }`.
- **documents**: `filepath: "gdrive:<FileID>"` for Drive-stored files.
- **config_audit_log**: bootstrap actions with `config_key: google_drive_bootstrap`.
