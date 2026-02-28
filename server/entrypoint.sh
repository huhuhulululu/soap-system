#!/bin/sh
chown -R appuser:appgroup /app/data
chmod 644 /app/vertex-sa-key.json 2>/dev/null || true
exec su -s /bin/sh appuser -c "npx tsx server/index.ts"
