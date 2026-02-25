#!/bin/bash
# Force trust auth for all connections (dev only)
cat > "$PGDATA/pg_hba.conf" << 'EOF'
local   all             all                                     trust
host    all             all             0.0.0.0/0               trust
host    all             all             ::1/128                 trust
EOF
