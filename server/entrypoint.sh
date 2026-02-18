#!/bin/sh
chown -R appuser:appgroup /app/data
exec su -s /bin/sh appuser -c "npx tsx server/index.ts"
