# Krisp Webhook Setup Guide

This guide explains how to connect your Krisp account to GodMode.

## Prerequisites

- A Krisp account with transcription enabled
- Access to GodMode with a user account

## Step 1: Enable Krisp Integration in GodMode

1. Click on your avatar in the top-right corner
2. Select **Profile**
3. Go to the **Integrations** tab
4. Click **Enable Krisp Integration** (if not already enabled)

## Step 2: Copy Your Credentials

In the Integrations tab, you'll see two important fields:

### Webhook URL
```
https://your-godmode-domain.com/api/webhooks/krisp/[your-unique-token]
```

Click the copy button next to the URL.

### Authorization Token
```
kw_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Click the eye icon to reveal the token, then copy it.

## Step 3: Configure Krisp

1. Open **Krisp** application
2. Go to **Settings** > **Webhooks**
3. Click **Create Webhook** or **Add Webhook**
4. Fill in the fields:
   - **Webhook URL**: Paste the URL from Step 2
   - **Authorization Header**: Paste the token from Step 2
5. **Select Events**:
   - [x] Transcript created
   - [x] Notes generated
   - [ ] Transcript shared (optional)
6. Click **Save**

## Step 4: Test the Integration

1. Start a test meeting with Krisp transcription enabled
2. End the meeting after a few seconds
3. Check GodMode - the transcript should appear in your transcripts list

## Troubleshooting

### Transcript not appearing

1. **Check webhook status**: In GodMode Profile > Integrations, verify the webhook is **Active**
2. **Check last event**: The "Total Transcripts" counter should increase after each meeting
3. **Check quarantine**: If speakers aren't identified, the transcript goes to quarantine

### Transcript in Quarantine

Transcripts with generic speaker names (Speaker 1, Speaker 2, etc.) are quarantined.

To resolve:
1. Open the transcript
2. Map each speaker to a contact
3. Click **Retry Processing**

Or wait - Krisp sometimes updates speaker names after the meeting ends.

### Wrong Project Assignment

If a transcript was assigned to the wrong project:
1. Open the transcript
2. Click **Reassign Project**
3. Select the correct project

## Security Notes

- **Webhook Token**: This is unique to your account. Never share it.
- **Regenerate**: If you suspect the token was compromised, click "Regenerate Credentials"
- **Disable**: You can temporarily disable the integration without losing your token

## Project Matching Logic

GodMode uses this logic to assign transcripts to projects:

1. **Identify Speakers**: Match speaker names to contacts in your projects
2. **Count Matches**: Count how many speakers belong to each project
3. **Threshold Check**: At least 70% of speakers must be in a project
4. **Tie Detection**: If two projects have equal matches, requires manual assignment

### Example

Meeting with speakers: Alice, Bob, Charlie

- Alice is a contact in Project A
- Bob is a contact in Project A
- Charlie is a contact in Project B

Result: 66% in Project A, 33% in Project B
-> Goes to **Ambiguous** status (below 70% threshold)
-> Requires manual assignment

## Speaker Mappings

You can create speaker mappings to help with future matching:

1. Go to Profile > Integrations > View Transcripts
2. Open a quarantined transcript
3. Map "Speaker 1" to an actual contact
4. Check "Apply to future transcripts"

This creates a mapping that will automatically apply to future transcripts.
