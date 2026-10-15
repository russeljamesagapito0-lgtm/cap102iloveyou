# Backup and restore

Weekly job: `.github/workflows/weekly-backup.yml` (Mondays 02:00 PH, also runnable by hand from the Actions tab).
Output: encrypted `.tar.gz.gpg` artifact, kept 90 days.

Repo secrets needed:
- `SUPABASE_DB_URL`: Supabase > Connect > Session pooler URI (runners are IPv4 only, the direct URI is IPv6)
- `BACKUP_PASSPHRASE`: long random string, also store it in your password manager

Restore:
```
gpg -d rootcare-backup-YYYY-MM-DD.tar.gz.gpg | tar -xzf -
psql "$NEW_DB_URL" -f rootcare-backup-YYYY-MM-DD-auth-users.sql
psql "$NEW_DB_URL" -f rootcare-backup-YYYY-MM-DD-public.sql
```
Try a restore on a scratch Supabase project once so you know it works.
