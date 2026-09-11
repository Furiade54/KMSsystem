#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BASE_COMPOSE="docker-compose.prod.yml"
ENV_FILE=".env.prod"

log() { echo -e "\033[1;34m[kms]\033[0m $*"; }
ok()  { echo -e "\033[1;32m[ok]\033[0m  $*"; }
warn(){ echo -e "\033[1;33m[warn]\033[0m $*"; }
err() { echo -e "\033[1;31m[err]\033[0m $*" >&2; }

usage() {
  cat <<EOF
Uso: $0 <comando> [opciones]

Modos de BD (según DB_MODE en .env.prod):
  external  MSSQL fuera de Docker (IP pública / otro servidor) — DEFECTO
  local     MSSQL dentro de Docker en esta VPS (overlay docker-compose.local-db.yml)

Comandos:
  up            Levanta stack completo (build + up -d)
  down          Detiene y elimina contenedores (mantiene volúmenes)
  restart       Reinicia servicios
  logs          Muestra logs en vivo
  ps | status   Estado de los contenedores
  build         Fuerza rebuild sin cache
  clean         Elimina imágenes dangling
  backup-db     Genera .bak de la BD KMS en ./backups
  restore-db <ruta.bak>   Restaura un .bak en la BD KMS
  shell-backend Abre shell en el backend
  shell-db      Abre sqlcmd en la BD (usa contenedor efímero si DB_MODE=external)
EOF
}

require_env() {
  if [ ! -f "$ENV_FILE" ]; then
    err "No existe $ENV_FILE. Copia .env.prod.example -> $ENV_FILE y edítalo."
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  DB_MODE="${DB_MODE:-external}"
  case "$DB_MODE" in
    external|local) ;;
    *) err "DB_MODE='$DB_MODE' inválido. Usa 'external' o 'local' en $ENV_FILE."; exit 1 ;;
  esac

  if [ "$DB_MODE" = "local" ]; then
    COMPOSE_FILES="-f ${BASE_COMPOSE} -f docker-compose.local-db.yml"
  else
    COMPOSE_FILES="-f ${BASE_COMPOSE}"
  fi
}

dc() {
  docker compose $COMPOSE_FILES --env-file "$ENV_FILE" "$@"
}

sqlcmd_external() {
  INSTANCE_PART=""
  if [ -n "${SQL_INSTANCE_NAME:-}" ]; then
    INSTANCE_PART="\\${SQL_INSTANCE_NAME}"
  fi
  docker run --rm -i mcr.microsoft.com/mssql/server:2022-latest \
    /opt/mssql-tools18/bin/sqlcmd \
      -S "${SQL_SERVER}${INSTANCE_PART},${SQL_PORT:-1433}" \
      -U "${SQL_USER:-sa}" \
      -P "${SQL_PASSWORD}" \
      -C \
      "$@"
}

backup_external() {
  local out="$1"
  log "Backup BD externa ${SQL_SERVER}:${SQL_PORT:-1433} / ${SQL_DATABASE:-KMS} -> ${out}"
  local tmpname="kms-backup-$(date +%s).bak"
  sqlcmd_external -Q "BACKUP DATABASE [${SQL_DATABASE:-KMS}] TO DISK = N'/tmp/${tmpname}' WITH COPY_ONLY, NOFORMAT, NOINIT, NAME = N'KMS-Full', SKIP, NOREWIND, NOUNLOAD, STATS = 10"
  warn "⚠️  En modo DB_MODE=external, el BACKUP se generó en EL SERVIDOR SQL REMOTO en la ruta por defecto del servidor SQL."
  warn "     Para descargarlo necesitas acceso al servidor SQL. Como alternativa usa SSMS o un script sqlcmd desde la propia máquina del SQL Server."
  log "Consulta SQL ejecutada. Puedes restaurar desde una ruta accesible por el servidor SQL Server."
}

backup_local() {
  local out="$1"
  log "Backup BD local (kms-db) -> ${out}"
  docker exec kms-db /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P "${SQL_PASSWORD}" -C \
    -Q "BACKUP DATABASE [${SQL_DATABASE:-KMS}] TO DISK = N'/var/opt/mssql/data/kms-tmp.bak' WITH NOFORMAT, NOINIT, NAME = N'KMS-Full', SKIP, NOREWIND, NOUNLOAD, STATS = 10"
  docker cp kms-db:/var/opt/mssql/data/kms-tmp.bak "$out"
  docker exec kms-db rm -f /var/opt/mssql/data/kms-tmp.bak
  ok "Backup creado: ${out} ($(du -h "$out" | cut -f1))"
}

cmd="${1:-}"
shift || true

case "$cmd" in
  up)
    require_env
    log "DB_MODE=$DB_MODE — Construyendo y levantando stack..."
    dc up -d --build --remove-orphans
    ok "Stack levantado. Esperando healthchecks..."
    sleep 3
    dc ps
    ;;
  down)
    require_env
    log "DB_MODE=$DB_MODE — Deteniendo stack (volúmenes preservados)..."
    dc down
    ok "Stack detenido."
    ;;
  restart)
    require_env
    log "DB_MODE=$DB_MODE — Reiniciando stack..."
    dc restart
    ;;
  logs)
    require_env
    dc logs -f --tail=200 "$@"
    ;;
  ps|status)
    require_env
    dc ps
    ;;
  build)
    require_env
    log "DB_MODE=$DB_MODE — Reconstruyendo imágenes sin cache..."
    dc build --no-cache
    ;;
  clean)
    log "Eliminando imágenes dangling..."
    docker image prune -f
    ok "Limpieza terminada."
    ;;
  backup-db)
    require_env
    mkdir -p ./backups
    stamp="$(date +%Y%m%d-%H%M%S)"
    out="./backups/kms-backup-${DB_MODE}-${stamp}.bak"
    if [ "$DB_MODE" = "local" ]; then backup_local "$out"
    else backup_external "$out"; fi
    ;;
  restore-db)
    require_env
    bak="${1:-}"
    if [ -z "$bak" ] || [ ! -f "$bak" ]; then
      err "Uso: $0 restore-db <ruta-al-archivo.bak>"
      exit 1
    fi
    warn "Esto SOBREESCRIBIRÁ la base ${SQL_DATABASE:-KMS}. ¿Continuar? (s/N)"
    read -r confirm
    [ "$confirm" != "s" ] && { log "Cancelado."; exit 0; }
    if [ "$DB_MODE" = "local" ]; then
      log "Copiando $bak al contenedor kms-db..."
      docker cp "$bak" kms-db:/var/opt/mssql/data/restore.bak
      log "Restaurando..."
      docker exec kms-db /opt/mssql-tools18/bin/sqlcmd \
        -S localhost -U sa -P "${SQL_PASSWORD}" -C \
        -Q "ALTER DATABASE [${SQL_DATABASE:-KMS}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
            RESTORE DATABASE [${SQL_DATABASE:-KMS}] FROM DISK = N'/var/opt/mssql/data/restore.bak' WITH REPLACE, RECOVERY;
            ALTER DATABASE [${SQL_DATABASE:-KMS}] SET MULTI_USER;"
      docker exec kms-db rm -f /var/opt/mssql/data/restore.bak
    else
      warn "⚠️  Modo external: el archivo .bak debe existir EN el servidor SQL remoto (o en un recurso SMB al que SQL tenga acceso)."
      warn "     Ajusta la ruta DISK = N'RUTA\\EN\\EL\\SERVIDOR\\SQL\\archivo.bak' a una ruta visible por el servidor MSSQL."
      log "Ejecutando RESTORE desde la ruta indicada al servidor SQL... (cambia manualmente la DISK si no es visible)"
      sqlcmd_external -Q "ALTER DATABASE [${SQL_DATABASE:-KMS}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                          RESTORE DATABASE [${SQL_DATABASE:-KMS}] FROM DISK = N'${bak}' WITH REPLACE, RECOVERY;
                          ALTER DATABASE [${SQL_DATABASE:-KMS}] SET MULTI_USER;"
    fi
    ok "Restore finalizado. Reinicia backend con './deploy.sh restart' para refrescar conexiones."
    ;;
  shell-backend)
    require_env
    docker exec -it kms-backend bash
    ;;
  shell-db)
    require_env
    if [ "$DB_MODE" = "local" ]; then
      docker exec -it kms-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${SQL_PASSWORD}" -C -d "${SQL_DATABASE:-KMS}"
    else
      log "sqlcmd conectando a ${SQL_SERVER}:${SQL_PORT:-1433} ..."
      sqlcmd_external -d "${SQL_DATABASE:-KMS}"
    fi
    ;;
  "")
    usage
    ;;
  *)
    err "Comando desconocido: $cmd"
    usage
    exit 1
    ;;
esac
