#!/bin/sh
# Only check top-level data dir (Dockerfile already sets recursive ownership)
if [ ! -w /app/data ]; then
  chown appuser:appgroup /app/data
fi
chmod 644 /app/vertex-sa-key.json 2>/dev/null || true
exec su -s /bin/sh appuser -c "node --max-old-space-size=4096 -r tsx/esm server/index.ts"
