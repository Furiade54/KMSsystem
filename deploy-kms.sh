#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# KMSsystem - Deploy automático (v2)
# ============================================================
#
# Script ESPECÍFICO del servidor /home/ist/KMSsystem (rama main).
# No necesita parámetros. Se ejecuta simplemente con:
#   chmod +x deploy-kms.sh && ./deploy-kms.sh
#
# Mejoras v2 sobre v1:
#   - Detección automática docker compose (plugin) vs docker-compose (legacy)
#   - Early exit si el servidor ya está al día (no rebuilda / reinicia en vano)
#   - Espera healthcheck real en bucle (timeout 60s) en lugar de sleep fijo 10s
#   - Prune automático de imágenes Docker huérfanas solo si todo OK (evita
#     llenar /var/lib/docker de imágenes viejas tras varios deploys)
#   - Logs resumen del backend: confirma que corrieron ensurePermissionCatalog
#     y syncSystemRoleDefaults (sin errores SQL)
#   - Verificación HTTP final (curl al proxy por el puerto 80) — no solo docker ps
#
# Intencionalmente NO tiene:
#   - rollback automático en caso de fallo (corresponde al admin)
#   - dependencia de jq ni de tools externas no instaladas por defecto
#   - detección automática de PROJECT_DIR (hardcodeado por ser específico VPS)

PROJECT_DIR="/home/ist/KMSsystem"
COMPOSE_FILE="docker-compose.prod.yml"
BRANCH="main"

# Healthcheck loop
HEALTH_TIMEOUT_SECONDS=60
HEALTH_POLL_EVERY_SECONDS=3

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log()     { echo -e "${BLUE}[KMS]${NC} $1"; }
success() { echo -e "${GREEN}[OK ]${NC} $1"; }
warning() { echo -e "${YELLOW}[!  ]${NC} $1"; }
error()   { echo -e "${RED}[ERR]${NC} $1"; }

# ------------------------------------------------------------
# Manejo de errores
# ------------------------------------------------------------

trap 'error "El despliegue se detuvo en la línea $LINENO."' ERR

# ------------------------------------------------------------
# 0. Detección binario Docker Compose
# ------------------------------------------------------------

detect_docker_compose() {
    if docker compose version >/dev/null 2>&1; then
        echo "docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        echo "docker-compose"
    else
        return 1
    fi
}

DC="$(detect_docker_compose || true)"
if [ -z "$DC" ]; then
    error "No se encontró 'docker compose' (plugin) ni 'docker-compose' (standalone)."
    error "Instala Docker Compose y vuelve a intentarlo."
    exit 1
fi

dc() {
    # shellcheck disable=SC2086
    $DC -f "$COMPOSE_FILE" "$@"
}

# ------------------------------------------------------------
# 1. Verificaciones iniciales
# ------------------------------------------------------------

log "Iniciando despliegue de KMSsystem (v2)..."
log "Usando: $DC"

if [[ ! -d "$PROJECT_DIR" ]]; then
    error "No existe el directorio: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

if [[ ! -d ".git" ]]; then
    error "El directorio no parece ser un repositorio Git."
    exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
    error "No existe $COMPOSE_FILE"
    exit 1
fi

if ! command -v git >/dev/null 2>&1; then
    error "Git no está instalado."
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    error "Docker no está instalado."
    exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
    warning "curl no está disponible — se saltará la comprobación HTTP final (puerto 80)."
fi

success "Entorno verificado."

# ------------------------------------------------------------
# 2. Comprobar estado local
# ------------------------------------------------------------

log "Comprobando estado del repositorio..."

CURRENT_BRANCH=$(git branch --show-current)

if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
    error "La rama actual es '$CURRENT_BRANCH', se esperaba '$BRANCH'."
    exit 1
fi

# Detectar cambios locales
if [[ -n "$(git status --porcelain)" ]]; then
    error "Hay cambios o archivos locales sin confirmar."
    echo
    git status --short
    echo
    error "Por seguridad, el despliegue fue cancelado."
    exit 1
fi

success "Repositorio limpio en rama $BRANCH."

# ------------------------------------------------------------
# 3. Obtener cambios de GitHub — early exit si no hay nada nuevo
# ------------------------------------------------------------

log "Consultando GitHub..."

git fetch origin "$BRANCH"

LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse "origin/$BRANCH")
LOCAL_COMMIT_SHORT=$(git rev-parse --short "$LOCAL_COMMIT")
REMOTE_COMMIT_SHORT=$(git rev-parse --short "$REMOTE_COMMIT")

if [[ "$LOCAL_COMMIT" == "$REMOTE_COMMIT" ]]; then
    echo
    warning "El servidor ya está actualizado (commit $LOCAL_COMMIT_SHORT)."
    warning "No hay nada nuevo que desplegar — no se reiniciarán los contenedores."
    echo
    success "=============================================="
    success "   NADA QUE DESPLEGAR (ya estabas al día)"
    success "=============================================="
    echo
    docker compose -f "$COMPOSE_FILE" ps
    exit 0
fi

log "Hay cambios nuevos en GitHub ($LOCAL_COMMIT_SHORT -> $REMOTE_COMMIT_SHORT)."

echo
echo "Commits pendientes:"
git log --oneline "$LOCAL_COMMIT..origin/$BRANCH"
echo

log "Actualizando código..."
git pull --ff-only origin "$BRANCH"
success "Código actualizado."

# ------------------------------------------------------------
# 4. Mostrar versión desplegada
# ------------------------------------------------------------

NEW_COMMIT=$(git rev-parse --short HEAD)
log "Commit a desplegar: $NEW_COMMIT"

# ------------------------------------------------------------
# 5. Construir imágenes Docker
# ------------------------------------------------------------

log "Construyendo imágenes Docker..."
dc build
success "Imágenes Docker construidas."

# ------------------------------------------------------------
# 6. Levantar servicios (reinicio con nuevas imágenes)
# ------------------------------------------------------------

log "Levantando servicios con las nuevas imágenes..."
dc up -d
success "Servicios iniciados (up -d)."

# ------------------------------------------------------------
# 7. Esperar healthcheck reales (bucle con timeout)
# ------------------------------------------------------------

log "Esperando a que los 3 servicios estén healthy (timeout ${HEALTH_TIMEOUT_SECONDS}s)..."

health_all_healthy() {
    for SERVICE in backend frontend proxy; do
        STATUS=$(docker compose -f "$COMPOSE_FILE" ps --format json "$SERVICE" 2>/dev/null || true)
        if ! echo "$STATUS" | grep -q '"Health":"healthy"'; then
            return 1
        fi
    done
    return 0
}

ELAPSED=0
while [ "$ELAPSED" -lt "$HEALTH_TIMEOUT_SECONDS" ]; do
    if health_all_healthy; then
        success "backend: healthy"
        success "frontend: healthy"
        success "proxy: healthy"
        break
    fi
    sleep "$HEALTH_POLL_EVERY_SECONDS"
    ELAPSED=$((ELAPSED + HEALTH_POLL_EVERY_SECONDS))
done

if [ "$ELAPSED" -ge "$HEALTH_TIMEOUT_SECONDS" ]; then
    warning "Se agotó el tiempo de espera de ${HEALTH_TIMEOUT_SECONDS}s para healthchecks."
    warning "Se mostrará el estado y se continuará (puede que alguno siga iniciándose)."
fi

echo

# ------------------------------------------------------------
# 8. Logs resumen backend (syncs BD + puerto)
# ------------------------------------------------------------

log "Resumen últimos logs del backend (Catálogo permisos / Sync roles / Puerto):"
BACKEND_LOGS=$(dc logs backend --tail 80 2>/dev/null || true)

if echo "$BACKEND_LOGS" | grep -qE "Catálogo permisos.*total=54|Catálogo permisos.*al día"; then
    success "Catálogo permisos OK"
else
    if echo "$BACKEND_LOGS" | grep -qE "Catálogo permisos"; then
        warning "Catálogo permisos: se detectó ejecución pero no terminó OK (revisar manualmente)."
    else
        warning "No se detectó Catálogo permisos en logs backend (podría OK si ya había arrancado antes)."
    fi
fi

if echo "$BACKEND_LOGS" | grep -qE "Sync roles sistema"; then
    success "Sync roles sistema OK"
else
    warning "No se detectó Sync roles sistema en logs backend (podría OK si ya había arrancado antes)."
fi

if echo "$BACKEND_LOGS" | grep -qE "ERROR|Fallo|No se pudo conectar|Login failed for user"; then
    error "Se detectaron líneas ERROR/Fallo en los logs del backend (revisar)."
    echo "   Muestra de errores detectados:"
    echo "$BACKEND_LOGS" | grep -iE "ERROR|Fallo|No se pudo conectar|Login failed for user" | head -n 10 | sed 's/^/      /'
else
    success "No se detectaron errores de BD o red en los últimos logs del backend."
fi

echo

# ------------------------------------------------------------
# 9. Mostrar estado servicios + verificación health
# ------------------------------------------------------------

dc ps
echo

log "Verificando estado final de los servicios..."

FAILED=0
for SERVICE in backend frontend proxy; do
    STATUS=$(docker compose -f "$COMPOSE_FILE" ps --format json "$SERVICE" 2>/dev/null || true)
    if [[ -z "$STATUS" ]]; then
        error "No se encontró información del servicio: $SERVICE"
        FAILED=1
        continue
    fi
    if echo "$STATUS" | grep -q '"Health":"healthy"'; then
        success "$SERVICE: healthy"
    elif echo "$STATUS" | grep -q '"State":"running"'; then
        warning "$SERVICE: running (healthcheck pendiente)"
    else
        error "$SERVICE: revisar estado"
        FAILED=1
    fi
done

echo

# ------------------------------------------------------------
# 10. Verificación HTTP local (curl al proxy puerto 80)
# ------------------------------------------------------------

if command -v curl >/dev/null 2>&1; then
    log "Verificación HTTP — GET http://localhost:80/ a través del proxy..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:80/ || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
        success "Proxy contesta HTTP $HTTP_CODE (OK)."
    else
        warning "Proxy contesta HTTP $HTTP_CODE (esperado 2xx / 3xx). Revisar manualmente si es intencional."
    fi
fi

# ------------------------------------------------------------
# 11. Limpieza de imágenes Docker antiguas (SOLO si FAILED==0)
# ------------------------------------------------------------

if [[ "$FAILED" -eq 0 ]]; then
    log "Limpiando imágenes Docker huérfanas para liberar espacio..."
    if DANGLING_BEFORE=$(docker images -f "dangling=true" -q | wc -l); then
        :
    else
        DANGLING_BEFORE=0
    fi
    docker image prune -f >/dev/null 2>&1 || true
    if DANGLING_AFTER=$(docker images -f "dangling=true" -q | wc -l); then
        :
    else
        DANGLING_AFTER=0
    fi
    REMOVED=$((DANGLING_BEFORE - DANGLING_AFTER))
    if [ "$REMOVED" -gt 0 ]; then
        success "Limpieza Docker: liberadas $REMOVED imágenes huérfanas."
    else
        success "Limpieza Docker: no había imágenes huérfanas que eliminar."
    fi
else
    warning "Se detectaron servicios con fallos — SE OMITE LA LIMPIEZA DE IMÁGENES por seguridad."
    warning "Puedes limpiar manualmente más tarde con: docker image prune -f"
fi

echo

# ------------------------------------------------------------
# 12. Resultado final
# ------------------------------------------------------------

if [[ "$FAILED" -ne 0 ]]; then
    error "El despliegue terminó con problemas."
    echo
    echo "Comandos útiles para depurar:"
    echo
    echo "  docker compose -f $COMPOSE_FILE logs --tail=120 backend"
    echo "  docker compose -f $COMPOSE_FILE logs --tail=60  frontend"
    echo "  docker compose -f $COMPOSE_FILE logs --tail=60  proxy"
    exit 1
fi

success "=============================================="
success "   DESPLIEGUE COMPLETADO CORRECTAMENTE"
success "=============================================="
echo
echo "Commit desplegado: $NEW_COMMIT"
echo
echo "Proyecto: $PROJECT_DIR"
echo "Rama    : $BRANCH"
echo "Compose : $COMPOSE_FILE"
echo "Docker  : $DC"
echo
echo "Servicios:"
dc ps
