# Correcciones Deploy KMS - PARTE 2
## Fecha: 2026-09-12

Fase post-build de imágenes. Build OK ✔, pero runtime falla en 2 puntos.

---

## 3. ERROR: `Cannot find module '/app/backend/dist/server.js'`
### ✅ Causa REAL CONFIRMADA (diagnóstico 2026-09-12):
**Misalignment entre la ruta REAL que produce TSC y la que el Dockerfile CMD busca.**

El `backend/tsconfig.json` incluye en `include`:
```json
"include": ["src/**/*.ts", "../packages/shared-types/src/**/*.ts"]
```
Al incluir también `../packages/shared-types/`, TypeScript calcula un **`rootDir` implícito más arriba** (la raíz del repo). Entonces el `outDir: ./dist` replica la estructura completa:
```
/app/backend/dist/
    ├── backend/
    │   └── src/
    │       └── server.js    ← RUTA REAL (no usada por CMD)
    └── packages/
        └── shared-types/...
```
Pero el `CMD` del Dockerfile ejecuta:
```dockerfile
CMD ["node", "dist/server.js"]   ← RUTA BUSCADA (NO EXISTE)
```
→ **Module not found** (Error confirmado con `find /app/backend/dist -name server.js` = `/app/backend/dist/backend/src/server.js`)

### Opciones de Fix (elegir UNA):
#### 🅰️ Fix RECOMENDADO (menos cambios): Cambiar el CMD del Dockerfile
Apuntar el CMD a la ruta que realmente produce TSC.

**Archivo a editar:** `infra/docker/backend/Dockerfile`
```
ANTES:   CMD ["node", "dist/server.js"]
AHORA:   CMD ["node", "dist/backend/src/server.js"]
```

#### 🅱️ Fix ALTERNATIVO: Definir `rootDir` explícito en tsconfig + reubicar `outDir`
Establece en `backend/tsconfig.json`:
```json
"compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
}
```
Pero el `include` de `../packages/shared-types` quedará FUERA de `rootDir` y TSC fallará. Solución: mover la compilación de `shared-types` a su propio paso (tsc en `packages/shared-types` primero) y referenciarlo como paquete npm real con `main`/`types` apuntando al `.js` compilado. **No recomendado ahora**, mucho refactor.

### Mejora adicional (aplicar siempre):
Agregar `set -e` al RUN del build en el Dockerfile para que **si `tsc` falla, el build falle inmediatamente** (no se siga a tsc-alias ni se marque la layer como exitosa):
```
RUN set -e; cd /app/backend \
    && npx tsc -p tsconfig.json \
    && npx tsc-alias -p tsconfig.json
```

---

## 4. ERROR SQL: `DB_NAME scripting variable not defined` + `CREATE DATABASE permission denied`
### ✅ Causas CONFIRMADAS (2 errores superpuestos) + SOLUCIÓN DEFINITIVA

```
kms-db-init  | Conectando a SQL Server: 200.234.239.179:50271
kms-db-init  | ✓ Conexión SQL OK. Ejecutando init.sql...
kms-db-init  | 'DB_NAME' scripting variable not defined. ← Error 1
kms-db-init  | Msg 262, Level 14, State 1...
kms-db-init  | CREATE DATABASE permission denied in database 'master'. ← Error 2
kms-db-init  | SqlState 24000, Invalid cursor state
kms-db-init  | ✓ Init SQL finalizado.
```

#### 🔴 Error 4a: Variable `$(DB_NAME)` nunca se inyecta a `sqlcmd`
El `init.sql` usa `N'$(DB_NAME)'` (sintaxis de scripting variable de `sqlcmd`).
Pero el `command` de `docker-compose.prod.yml` llamaba a `sqlcmd` SIN el parámetro `-v DB_NAME=...`.
Aunque `init.sql` tiene un fallback a `N'KMS'` cuando la variable está vacía, sqlcmd emite un WARNING por cada referencia.

**Solucionado (pero ya no aplica, ver 4c):** En las DOS invocaciones a sqlcmd agregar:
```
-v DB_NAME="$${SQL_DATABASE:-KMS}"
```

#### 🔴 Error 4b: Usuario de app (`tomas`) sin rol `dbcreator` en `master`
El servicio `db-init` usaba LAS MISMAS credenciales que el backend. Si el usuario de
la app (`tomas`) no tiene `CREATE ANY DATABASE` / rol `dbcreator` en master, falla el
`CREATE DATABASE KMS` aunque el servidor remoto funcione.

#### 🟢 Solución DEFINITIVA 4c: ELIMINAR db-init DEL COMPOSE (recomendado para MSSQL REMOTO)
Como el SQL Server es **remoto** (no corre en Docker, está en otra IP/puerto),
el stack de producción NO necesita arrancar una imagen `mssql-server:2022-latest`
ni ejecutar `init.sql` automáticamente.

Beneficios de quitarlo:
- Ya no tirar `CREATE DATABASE permission denied` (el DBA ya creó la BD).
- Ahorras ~500 MB-1 GB de RAM al no correr un SQL Server Docker inútil.
- Eliminas el `depends_on: db-init` del backend: arranca de inmediato.
- El backend en sí ya valida la BD en el pool (healthcheck = conexión real).

**Cambios aplicados en `docker-compose.prod.yml`:**
1. **Eliminado** TODO el servicio `db-init`.
2. **Eliminada** la sección `depends_on: db-init` del `backend`.

> 📌 **Cuándo SÍ usar db-init**: Solo si el stack Docker corre `db:` (MSSQL local Docker) con `docker-compose.local-db.yml`. Para MSSQL externo NUNCA.

> 💡 **NOTA:** El script `init.sql` actual SOLO crea la BD + READ_COMMITTED_SNAPSHOT. No crea tablas. Las migraciones reales de tablas están en `infra/sql/migrations/*.sql` y deben ejecutarse una sola vez manualmente en el servidor remoto (o ya están aplicadas). Cuando la BD ya existe, este paso es 100% prescindible.

---

## 5. 📋 RESUMEN FINAL - ARCHIVOS A MODIFICAR EN EL PROYECTO LOCAL (Windows)

Aplica **todos estos cambios** en tu proyecto de desarrollo, luego `git commit` + `git push`, después `git pull` en VPS y re-buildea.

### ✅ Ya estaban resueltos en commit anterior (2c672f4):
- `.gitignore` → agregadas excepciones `!backend/src/shared/storage/` y `!backend/src/shared/storage/**`
- `backend/src/shared/storage/index.ts` → agregado al repo (269 líneas, provider S3 + local)
- `infra/docker/backend/Dockerfile` → agregado `typescript@5` global + `cd /app/backend` en build
- `.env.prod.example` → placeholders limpiados

### 🆕 Nuevos fixes PENDIENTES de commit (este documento):

| # | Archivo | Cambio exacto |
|---|---|---|
| 1 | `.dockerignore` | Debajo de `**/storage` AGREGAR excepciones:<br>`!**/backend/src/shared/storage/`<br>`!**/backend/src/shared/storage/**` |
| 2 | `infra/docker/backend/Dockerfile` | **Fix CMD entrypoint:** cambiar `CMD ["node", "dist/server.js"]` por `CMD ["node", "dist/backend/src/server.js"]` |
| 3 | `infra/docker/backend/Dockerfile` | **Mejora build:** `RUN set -e; cd /app/backend && npx tsc -p tsconfig.json && npx tsc-alias -p tsconfig.json` (fallar si tsc da error) |
| 4 | `docker-compose.prod.yml` | ❌ **ELIMINAR** TODO el servicio `db-init` + borrar `depends_on: db-init` del `backend` (porque MSSQL es remoto, no corre en Docker) |

### Pasos luego del commit & push:
En VPS ejecutar:
```bash
cd ~/KMSsystem
git stash  # descarta cambio manual de .dockerignore, lo traeremos por git
git pull origin main
docker builder prune -f
docker compose -f docker-compose.prod.yml down  # SIN -v para no borrar volumen storage
docker compose -f docker-compose.prod.yml up -d --build

# Verificar estado
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend --tail=50
```

### Próxima verificación post-build:
```bash
# Debería salir healthy
curl -s http://localhost:${APP_PORT:-8080}/api/health
```

---

## 6. ERROR login: `Login failed for user 'kms'.` (problema de credenciales en VPS `.env`)
### ✅ Causa confirmada + fix inmediato (NO es código, es valor de entorno)

```
kms-backend  | ⚠️  No se pudo conectar a SQL Server [200.234.239.179:50271 / KMS]
kms-backend  |    Detalle: Login failed for user 'kms'.
kms-backend  | Fallo al inicializar BD: ConnectionError: Login failed for user 'kms'.
```

### 🚨 Causa REAL: el `.env` de la VPS tiene `SQL_USER=kms` PERO ese login NO EXISTE en el MSSQL remoto.

En el backend de **desarrollo (Windows)** que usa el **MISMO SQL remoto** `200.234.239.179:50271`
y **sí conecta OK**, los valores son (fuente: `backend/.env`):
```ini
SQL_SERVER=200.234.239.179
SQL_PORT=50271
SQL_DATABASE=KMS
SQL_USER=admin
SQL_PASSWORD=Ist3222060
SQL_ENCRYPT=false
```

El usuario de la BD real no es `kms` → es `admin`. Probablemente el archivo `.env.prod` en la
VPS quedó con valores "de plantilla" y nunca se actualizaron.

### 🔧 Fix inmediato en la VPS:

1. Editar el `.env` que usa compose (nombre típico: `.env.prod` o `.env`):
```bash
cd ~/KMSsystem
ls -la .env .env.prod 2>&1
# si existe .env.prod → usarlo; si solo hay .env, usarlo.
nano .env
# O si: nano .env.prod
```

2. **DEJAR LAS VARIABLES DE SQL EXACTAMENTE ASÍ** (igual que en desarrollo, porque es la misma BD):
```ini
SQL_SERVER=200.234.239.179
SQL_PORT=50271
SQL_DATABASE=KMS
SQL_USER=admin
SQL_PASSWORD=Ist3222060
SQL_ENCRYPT=false
```

3. Verificar también estas variables (otro fallo común que suele pasar después):
```ini
# NO dejar vacío
JWT_SECRET=<una cadena larga aleatoria, la MISMA que usaste en desarrollo>
JWT_EXPIRES_IN=24h

# Almacenamiento: local o s3 (cualquiera de los 2, pero consistente)
STORAGE_PROVIDER=local

APP_PORT=8080
VITE_API_URL=/api
VITE_APP_TITLE=KMS
CORS_ORIGIN=*
```

4. **Para que compose lea los nuevos valores hay que re-crear los contenedores (no basta con restart):**
```bash
cd ~/KMSsystem
# 1. bajar todo (SIN -v — no borrar volúmenes de datos)
docker compose -f docker-compose.prod.yml down

# 2. re-subir con --force-recreate para que tome el .env nuevo
docker compose -f docker-compose.prod.yml up -d --build --force-recreate

# 3. esperar 20s y comprobar
sleep 20
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend --tail=50
curl -s http://localhost:8080/api/health
```

### ✅ Lo que tienes que ver después:
- `kms-backend` → **STATUS = Up (healthy)** (no más Restarting)
- `docker compose logs backend --tail=20` → **NO debe aparecer** `Login failed for user`
- `curl -s http://localhost:8080/api/health` → debe devolver un JSON con `{"status":"ok",...}` o similar

### 💡 Si sigue fallando:
1. Comprueba que el puerto `50271/TCP` esté abierto hacia afuera en el firewall DE LA VPS (no el del SQL, el de la VPS Ubuntu):
   ```bash
   nc -zv 200.234.239.179 50271
   ```
   Si no contesta: la VPS no puede salir a ese puerto. Abre el firewall / security group de salida.
2. Confirma que el login `admin` tiene `CONNECT SQL` + permisos en la BD `KMS` (por ejemplo `db_owner`) — lo sabrás porque en tu Windows conecta OK con esas mismas credenciales.
3. Saca logs del momento exacto del start:
   ```bash
   docker compose -f docker-compose.prod.yml up backend   # foreground, CTRL+C al final
   ```

---

## 7. ERROR upload: `413 Request Entity Too Large` en `POST /api/archivos`

### ❌ NO es S3 (S3 no devuelve 413 por defecto — soporta 5GB / upload)
### ✅ Causa: límites de tamaño de request del stack Nginx proxy → Express backend

Límites **ANTES** (desalineados, 50 vs 500 mb) — si enviabas un PDF/Video >5MB en JSON o >50MB en multipart, fallaba 413:

| Capa | Variable | Valor VIEJO |
|---|---|---|
| Nginx proxy (puerto 8080) | `client_max_body_size` | **50M** |
| Express (body parser JSON) | `express.json({ limit })` | **5mb** ← el más restrictivo! |
| Express (urlencoded) | `express.urlencoded({ limit })` | **sin límite explícito** (default 100kb) |
| Multer upload multipart | `limits.fileSize` | **50MB** |

### Solución: alinear TODO a **500 MB** (todos los cuellos de botella iguales)

Archivos modificados:

| Archivo | Línea | Cambio |
|---|---|---|
| `infra/docker/proxy/nginx.conf` | ~6 | `client_max_body_size 50M;` → **`client_max_body_size 500M;`** |
| `backend/src/app.ts` | 44-45 | `express.json({ limit: '5mb' })` → **`express.json({ limit: '500mb' })`**<br>`express.urlencoded({ extended: true })` → **`express.urlencoded({ extended: true, limit: '500mb' })`** |
| `backend/src/modules/files/files.controller.ts` | 27 | `fileSize: 50 * 1024 * 1024` → **`fileSize: 500 * 1024 * 1024`** (500MB) |

### Aplicar en VPS después de git push:
```bash
cd ~/KMSsystem
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build proxy backend
sleep 15
docker compose -f docker-compose.prod.yml ps
```
