#!/usr/bin/env bash
# Netlify build script — genera supabase-config.js desde env vars.
#
# En Netlify > Site configuration > Environment variables añade:
#   SUPABASE_URL  = https://gsfdssedvkdcjhkbvcfd.supabase.co
#   SUPABASE_KEY  = sb_publishable_1h2NFDfWOovZaSJFOA4yhg_Z8dzUFlQ

set -e

URL="${SUPABASE_URL:-}"
KEY="${SUPABASE_KEY:-}"

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "⚠️  SUPABASE_URL o SUPABASE_KEY no definidos — config vacía."
  URL=""; KEY=""
fi

cat > supabase-config.js << EOF
// Auto-generado por Netlify build — NO COMMITEAR
window.SUPABASE_CONFIG = {
  url:     '${URL}',
  anonKey: '${KEY}'
};
EOF

echo "✅  supabase-config.js generado."
