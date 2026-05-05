# Google Auth Setup

This project uses Google Identity Services on the frontend and verifies the returned Google ID token on the backend.

## Current Implementation

- Frontend renders a Google sign-in entry point and sends the returned credential to `POST /api/auth/google`
- Backend verifies the Google ID token against Google in `api/auth/google.php`
- Backend requires `GOOGLE_CLIENT_ID` from the environment in `api/config.php`
- This implementation does **not** use `GOOGLE_CLIENT_SECRET`
- This implementation does **not** require an OAuth redirect URI for the current sign-in flow

## Prerequisites

- Google Cloud project
- Local PHP server running at `http://127.0.0.1:8000`
- MySQL database available for the app

## 1. Create The Google OAuth Client

In Google Cloud Console:

1. Open or create a project
2. Go to `Google Auth platform`
3. Configure the consent screen if prompted
4. Go to `Clients`
5. Click `Create client`
6. Choose `Web application`
7. Give it a name such as `Cerebro Local`

## 2. Fill The Google Cloud Fields

Use these values for local development.

### Authorized JavaScript origins

Add:

- `http://127.0.0.1:8000`
- `http://localhost:8000`
- `http://localhost`

### Authorized redirect URIs

Not required for the current implementation.

Reason: the app is not using a server-side OAuth callback route. It receives a Google ID token in the browser and posts that token to the backend for verification.

## 3. Copy The Client ID

After the OAuth client is created, copy the generated client ID. It will look like:

```text
123456789012-abcdefg123456.apps.googleusercontent.com
```

## 4. Export The Environment Variable

Start the local server from the same shell where the environment variable is exported:

```bash
export GOOGLE_CLIENT_ID="your-google-web-client-id.apps.googleusercontent.com"
php -S 127.0.0.1:8000
```

Open:

`http://127.0.0.1:8000`

## 5. Apply The Database Migration

If your database was created before Google auth was added, run:

```bash
mysql -uroot -proot123 cerebro < sql/migrate_google_auth.sql
```

If you are rebuilding from scratch instead:

```bash
mysql -uroot -proot123 < sql/schema.sql
```

## 6. Verify The Setup

Open:

`http://127.0.0.1:8000/api/auth/session`

Expected result:

```json
{
  "success": true,
  "authenticated": false,
  "google_configured": true,
  "google_client_id": "your-client-id.apps.googleusercontent.com",
  "user": null
}
```

If `google_configured` is `false`, the server process does not have `GOOGLE_CLIENT_ID`.

## Troubleshooting

### Google sign-in area says not configured

Cause:

- `GOOGLE_CLIENT_ID` was not exported before starting PHP

Fix:

```bash
export GOOGLE_CLIENT_ID="your-google-web-client-id.apps.googleusercontent.com"
php -S 127.0.0.1:8000
```

### Google popup/button appears but sign-in fails

Common causes:

- You opened `localhost` but only allowed `127.0.0.1` in Google Cloud
- You opened `127.0.0.1` but only allowed `localhost` in Google Cloud
- You copied the wrong client ID

Fix:

- Add both `http://127.0.0.1:8000` and `http://localhost:8000`
- Restart the PHP server after exporting the correct `GOOGLE_CLIENT_ID`

### Backend returns audience mismatch

Cause:

- The Google credential belongs to a different OAuth client than the one in `GOOGLE_CLIENT_ID`

Fix:

- Make sure the client ID in Google Cloud matches the one exported locally

### User creation fails after Google sign-in

Cause:

- The database migration was not applied

Fix:

```bash
mysql -uroot -proot123 cerebro < sql/migrate_google_auth.sql
```

## Production Note

For production, create a separate Google OAuth client or add your deployed site origin to the same client.

Typical production values go into `Authorized JavaScript origins`, for example:

- `https://yourdomain.com`
- `https://www.yourdomain.com`

Keep local and production origins aligned with the actual URL used in the browser.
