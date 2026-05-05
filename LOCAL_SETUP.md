# Cerebro Local Setup

- Database name: `cerebro`
- Database user: `root`
- Database password: `root123`

## Start locally

Run the PHP built-in server from the project root:

```bash
export GOOGLE_CLIENT_ID="your-google-web-client-id.apps.googleusercontent.com"
php -S 127.0.0.1:8000
```

Then open:

`http://127.0.0.1:8000`

## Database

The database already matches the app config in `api/config.php`.

If you need to re-import the schema:

```bash
mysql -uroot -proot123 < sql/schema.sql
```

If your database already exists and you only need the auth changes:

```bash
mysql -uroot -proot123 cerebro < sql/migrate_google_auth.sql
```

## Google Sign-In

- Create a Google web OAuth client in Google Cloud Console.
- Add `http://127.0.0.1:8000` to the allowed JavaScript origins.
- Export `GOOGLE_CLIENT_ID` before starting the PHP server.
- Full setup guide: [GOOGLE_AUTH_SETUP.md](/home/hitesh/hitesh/projects/cerebro/GOOGLE_AUTH_SETUP.md)
