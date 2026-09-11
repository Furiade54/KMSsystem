#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
#  seed-first-user.sh
#  Crea la organización inicial + el primer usuario Administrador.
#  Solo ejecutar en PRIMER arranque cuando la BD aún está vacía.
#  Si ya hay organizaciones, el endpoint /register se negará.
# -----------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE=".env.prod"

log()  { echo -e "\033[1;34m[kms-seed]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ok]\033[0m  $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }
err()  { echo -e "\033[1;31m[err]\033[0m $*" >&2; }

if [ ! -f "$ENV_FILE" ]; then
  err "No existe $ENV_FILE. Primero ejecuta el paso 3 y 4 de la guía."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

APP_PORT="${APP_PORT:-8080}"
BASE_URL="http://127.0.0.1:${APP_PORT}"

read -rp "Nombre de la Organización: " ORG_NAME
read -rp "Nombre completo del Admin: " FULL_NAME
read -rp "Email del Admin (será el usuario de login): " EMAIL
read -rsp "Contraseña (mínimo 6 caracteres): " PASSWORD
echo
read -rsp "Repite la contraseña: " PASSWORD2
echo

[ -z "$ORG_NAME" ] && { err "Nombre de organización vacío."; exit 1; }
[ -z "$FULL_NAME" ] && { err "Nombre completo vacío."; exit 1; }
[ -z "$EMAIL" ] && { err "Email vacío."; exit 1; }
[ "${#PASSWORD}" -lt 6 ] && { err "Contraseña demasiado corta (mínimo 6)."; exit 1; }
[ "$PASSWORD" != "$PASSWORD2" ] && { err "Las contraseñas no coinciden."; exit 1; }

log "Comprobando que backend responda en ${BASE_URL}/api/health ..."
for i in {1..20}; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health" || true)
  if [ "$code" = "200" ]; then ok "Backend OK."; break; fi
  echo "  intento $i/20: HTTP $code — esperando..."
  sleep 3
  if [ "$i" = "20" ]; then
    err "Backend no responde. Ejecuta './deploy.sh up' y espera hasta que todos estén healthy."
    exit 1
  fi
done

PAYLOAD=$(jq -n \
  --arg org "$ORG_NAME" \
  --arg name "$FULL_NAME" \
  --arg email "$EMAIL" \
  --arg pwd "$PASSWORD" \
  '{organizationName: $org, fullName: $name, email: $email, password: $pwd}')

log "Llamando a POST ${BASE_URL}/api/auth/register ..."
RESP=$(curl -sS -w "\n%{http_code}" \
  -X POST "${BASE_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

STATUS_CODE=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')

log "HTTP ${STATUS_CODE}"
echo "$BODY" | jq 2>/dev/null || echo "$BODY"

if [ "$STATUS_CODE" = "200" ] || [ "$STATUS_CODE" = "201" ]; then
  ok "¡Listo! Ya puedes entrar en ${BASE_URL} con email: $EMAIL"
else
  err "Error. Revisa el body anterior. Posibles causas:"
  echo "   - Ya existe una organización creada (register solo funciona en arranque limpio)"
  echo "   - La contraseña no cumple requisitos (ver validaciones del backend)"
fi
