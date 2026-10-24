#!/usr/bin/env bash
# Cluster Postgres local y descartable para desarrollo (no toca el servicio del sistema).
set -euo pipefail
DIR="${PGDATA_DIR:-$HOME/Dev/.cannabis-club-pgdata}"
PORT="${PGPORT_LOCAL:-55433}"
export LC_ALL=C LANG=C
case "${1:-start}" in
  start)
    if [ ! -d "$DIR" ]; then
      initdb -D "$DIR" -U "$(whoami)" --auth=trust -E UTF8 >/dev/null
    fi
    if ! pg_ctl -D "$DIR" status >/dev/null 2>&1; then
      pg_ctl -D "$DIR" -o "-p $PORT -k $DIR" -l "$DIR/server.log" start >/dev/null
    fi
    sleep 1
    psql -h 127.0.0.1 -p "$PORT" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='cannabis_club_dev'" | grep -q 1 || createdb -h 127.0.0.1 -p "$PORT" cannabis_club_dev
    echo "postgres listo en 127.0.0.1:$PORT (db cannabis_club_dev)"
    ;;
  stop) pg_ctl -D "$DIR" stop -m fast ;;
  *) echo "uso: $0 [start|stop]"; exit 1 ;;
esac
