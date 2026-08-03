MyParcelDelivery.in — Source Code Backup

Backup date: 2026-07-29 (Asia/Kolkata)
Live site version at backup time: 85
Live domain: https://myparceldelivery.in

Included:
- Public website and responsive design
- Vendor, master, and customer panels
- Backend API routes
- Database schema and Drizzle migrations
- Cloudflare worker/server code
- Tests, build scripts, configuration, logos, and public assets

Not included for security:
- Hosted secret values, passwords, PINs, access tokens, or API secrets
- Live D1 database records
- Live R2 customer/parcel videos
- Generated dependencies and build caches (node_modules, dist, .vinext, .sites-runtime)

Restore summary:
1. Extract the ZIP.
2. Install dependencies with npm ci.
3. Recreate the hosted D1/R2 resources and apply the included migrations.
4. Re-enter required secret environment values in the hosting settings.
5. Build and deploy from the extracted source.

Important:
This archive protects the website's complete recoverable source code and
database structure. Live operational data and secret settings require separate
exports/backups because they are not stored inside source code.
