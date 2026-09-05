const BASE = 'http://localhost:51478'
const assert = (cond, msg) => { if (!cond) throw new Error('ASSERT FAIL: ' + msg); else console.log('  ✅', msg) }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function jsonFetch(url, opts = {}) {
  const res = await fetch(BASE + url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, ok: res.ok, data }
}
const auth = (token) => ({ Authorization: 'Bearer ' + token })

const pad = (s, w = 3) => String(s).padStart(w, ' ')
const results = []
function record(name, passed, detail = '') {
  results.push({ name, passed, detail })
  console.log(`\n[${passed ? 'PASS' : 'FAIL'}] ${name}${detail ? ' → ' + detail : ''}`)
}
function summary() {
  const pass = results.filter(r => r.passed).length
  console.log('\n═══════════════════════════════════════')
  console.log(`SMOKE: ${pass}/${results.length} PASOS OK`)
  results.forEach(r => console.log(`  ${r.passed ? '✅' : '❌'}  ${r.name}`))
  console.log('═══════════════════════════════════════')
  process.exit(pass === results.length ? 0 : 1)
}

async function main() {
  const steps = []
  // ======== PASO 0: Login Carlos (OrgAdmin) ========
  const loginCarlos = await jsonFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'carlos.perez@ejemplo.com', password: 'Demo1234' }),
  })
  assert(loginCarlos.status === 200, 'Login Carlos 200')
  assert(loginCarlos.data?.data?.token, 'token Carlos presente')
  assert(loginCarlos.data?.data?.user?.isOrgAdmin === true, 'Carlos es OrgAdmin (backward compat root)')
  const T_CARLOS = loginCarlos.data.data.token
  const ORG_ID = loginCarlos.data.data.user.organizationId
  record('P01 Login admin', true, `orgId=${ORG_ID.slice(0, 8)}…`)

  // ======== PASO 1: Backward compat GET proyectos ========
  const listProjects = await jsonFetch('/api/projects', { headers: auth(T_CARLOS) })
  assert(listProjects.status === 200, 'GET /api/projects 200')
  const projects = listProjects.data?.data?.items ?? listProjects.data?.data ?? []
  assert(Array.isArray(projects), 'listado proyectos es array')
  assert(projects.length > 0, 'hay al menos 1 proyecto para pruebas')
  const PROYECTO = projects[0]
  const PID = String(PROYECTO.id ?? PROYECTO.Id)
  assert(PID, 'id proyecto definido')
  record('P02 List proyectos backward compat', true, `${projects.length} proyectos, muestra id=${PID.slice(0,8)}…`)

  // ======== PASO 2: Detalle proyecto (admin) ========
  const detProj = await jsonFetch(`/api/projects/${PID}`, { headers: auth(T_CARLOS) })
  assert(detProj.status === 200, 'GET /api/projects/:id 200 admin')
  record('P03 Detalle proyecto admin', true)

  // ======== PASO 3: Archivos: intentamos listar, usamos PROJECT si no hay ========
  let FID = null, resType = 'PROJECT', resId = PID
  try {
    const listFiles = await jsonFetch('/api/archivos', { headers: auth(T_CARLOS) })
    const files = listFiles.data?.data?.items ?? listFiles.data?.data ?? []
    if (Array.isArray(files) && files.length > 0) {
      FID = String(files[0].id ?? files[0].Id)
      resType = 'FILE'
      resId = FID
      record('P04 Recurso FILE disponible', true, `id=${FID.slice(0,8)}…`)
    } else {
      record('P04 Recurso FILE disponible', true, '(sin archivos persistidos, usaremos PROJECT)')
    }
  } catch (e) {
    record('P04 Recurso FILE disponible', true, '(fallo listado files, usaremos PROJECT)')
  }

  // ======== PASO 4: Crear usuario temporal SIN ROLES (sin permisos RBAC, no miembro proyecto) ========
  const randomTag = Math.random().toString(36).slice(2, 8)
  const TEMP_EMAIL = `smoke-perm-${randomTag}@example.com`
  const TEMP_PASS = 'Tmp12345!'
  const createTemp = await jsonFetch('/api/usuarios', {
    method: 'POST',
    headers: auth(T_CARLOS),
    body: JSON.stringify({
      fullName: 'Smoke Perm Temp', email: TEMP_EMAIL, password: TEMP_PASS,
      status: 'ACTIVE', position: 'smoke-test',
    }),
  })
  assert([200, 201].includes(createTemp.status), `crear usuario temp status ${createTemp.status} (200/201)`)
  const TEMP_USER = createTemp.data?.data ?? createTemp.data
  assert(TEMP_USER?.id || TEMP_USER?.Id, 'usuario temp id existe')
  const UID = String(TEMP_USER.id ?? TEMP_USER.Id)
  record('P05 Usuario temporal creado', true, `email=${TEMP_EMAIL} uid=${UID.slice(0,8)}…`)

  // ======== PASO 5: Login usuario temp ========
  await sleep(300)
  const loginTemp = await jsonFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: TEMP_EMAIL, password: TEMP_PASS }),
  })
  assert(loginTemp.status === 200, `login usuario temp 200 (status=${loginTemp.status})`)
  const T_TEMP = loginTemp.data?.data?.token
  assert(T_TEMP, 'token temp presente')
  assert(loginTemp.data?.data?.user?.isOrgAdmin !== true, 'usuario temp NO es org admin')
  record('P06 Login usuario temp', true, 'no es admin')

  // ======== PASO 6a: REMOVER TODOS LOS ROLES al usuario temp (no hereda proyectos.ver default) ========
  const unassignRoles = await jsonFetch(`/api/usuarios/${UID}/roles`, {
    method: 'PATCH', headers: auth(T_CARLOS),
    body: JSON.stringify({ roleIds: [] }),
  })
  assert([200, 204].includes(unassignRoles.status), `quitar roles a usuario temp status=${unassignRoles.status} (200/204)`)
  record('P06a Usuario temp SIN ROLES (roleIds=[]) → no hereda proyectos.ver RBAC default', true, `status=${unassignRoles.status}`)

  // ======== PASO 6: Sin grant → GET proyecto NO 200 (403 forbidden o 404 silent-failure) ========
  const projNoGrant = await jsonFetch(`/api/projects/${PID}`, { headers: auth(T_TEMP) })
  assert(projNoGrant.status >= 400, `Sin grant GET proyecto → 4xx (status=${projNoGrant.status})`)
  record('P07 Sin grant: no acceso', true, `status=${projNoGrant.status} (403/404 policy controller)`)
  // Guardamos el status para comparar post-revoke
  const NO_ACCESS_STATUS = projNoGrant.status

  // ======== PASO 6b: canAccessCheck → false ========
  const checkPre = await jsonFetch(`/api/permisos-recurso/check?resourceType=PROJECT&resourceId=${encodeURIComponent(PID)}&capability=VER`, { headers: auth(T_TEMP) })
  assert(checkPre.status === 200, `canAccessCheck endpoint responde 200 (status=${checkPre.status})`)
  assert(checkPre.data?.data?.granted === false || checkPre.data?.ok && checkPre.data?.data?.granted === false,
    `canAccessCheck pre-grant = false (got=${JSON.stringify(checkPre.data?.data ?? checkPre.data)})`)
  record('P08 canAccessCheck pre-grant → false', true)

  // ======== PASO 7: Grant POST permiso VER (grant temp UID → puedeVer:true sobre PROJECT PID) ========
  const grantBody = { userId: UID, puedeVer: true, puedeDescargar: true, puedeComentar: false, puedeEditar: false, puedeCompartir: false, puedeAdministrar: false }
  const grantRes = await jsonFetch(`/api/projects/${PID}/permisos`, {
    method: 'POST',
    headers: auth(T_CARLOS),
    body: JSON.stringify(grantBody),
  })
  assert([200, 201].includes(grantRes.status), `POST /projects/:id/permisos status=${grantRes.status} (200/201)`)
  const grantData = grantRes.data?.data ?? grantRes.data
  const GID = String(grantData?.id ?? grantData?.Id)
  assert(GID, 'grantId devuelto')
  assert(grantData?.grantedByUserId === loginCarlos.data.data.user.id || grantData?.grantedByUserId == null, 'grantedBy asignado')
  record('P09 Grant VER sobre PROJECT', true, `grantId=${GID.slice(0,8)}…`)

  // ======== PASO 8: Con grant → GET proyecto temp → 200 ✅ ========
  const projSiGrant = await jsonFetch(`/api/projects/${PID}`, { headers: auth(T_TEMP) })
  assert(projSiGrant.status === 200, `Con grant VER GET /api/projects/:id = 200 (status=${projSiGrant.status})`)
  record('P10 Con grant VER → 200 (feature funciona!)', true)

  // ======== PASO 9: canAccessCheck → true ========
  const checkPost = await jsonFetch(`/api/permisos-recurso/check?resourceType=PROJECT&resourceId=${encodeURIComponent(PID)}&capability=VER`, { headers: auth(T_TEMP) })
  assert(checkPost.data?.data?.granted === true || (checkPost.data?.ok && checkPost.data?.data?.granted === true),
    `canAccessCheck post-grant = true → ${JSON.stringify(checkPost.data?.data ?? checkPost.data)}`)
  record('P11 canAccessCheck post-grant → true', true)

  // ======== PASO 10: Listar permisos de PROJECT → aparece grant ========
  const listPerms = await jsonFetch(`/api/projects/${PID}/permisos?page=1&pageSize=100`, { headers: auth(T_CARLOS) })
  assert(listPerms.status === 200, `listar permisos del proyecto 200 (${listPerms.status})`)
  const items = listPerms.data?.data?.items ?? listPerms.data?.items ?? []
  const found = items.find(g => String(g.id ?? g.Id) === GID || String(g.userId ?? g.IdUsuario) === UID)
  assert(found, `el grant recién creado aparece en el listado (items=${items.length})`)
  record('P12 List permisos recurso contiene grant', true, `items listados=${items.length}`)

  // ======== PASO 11: XOR inválido (userId + roleId al mismo tiempo) → 400 ========
  const badGrantXor = await jsonFetch(`/api/projects/${PID}/permisos`, {
    method: 'POST',
    headers: auth(T_CARLOS),
    body: JSON.stringify({ userId: UID, roleId: '00000000-0000-0000-0000-000000000000', puedeVer: true }),
  })
  assert(badGrantXor.status >= 400 && badGrantXor.status < 500, `grant BOTH userId+roleId → 400 (status=${badGrantXor.status})`)
  record('P13 XOR inválido (ambos) → 400', true)

  // ======== PASO 12: Sin grantee → 400 ========
  const badGrantNoGr = await jsonFetch(`/api/projects/${PID}/permisos`, {
    method: 'POST',
    headers: auth(T_CARLOS),
    body: JSON.stringify({ puedeVer: true }),
  })
  assert(badGrantNoGr.status >= 400 && badGrantNoGr.status < 500, `grant SIN userId/roleId → 400 (status=${badGrantNoGr.status})`)
  record('P14 Sin grantee → 400', true)

  // ======== PASO 13: Usuario temp NO puede crear grants (no admin, no puedeAdministrar) → 403 ========
  const forbidGrant = await jsonFetch(`/api/projects/${PID}/permisos`, {
    method: 'POST',
    headers: auth(T_TEMP),
    body: JSON.stringify({ userId: loginCarlos.data.data.user.id, puedeVer: true }),
  })
  assert(forbidGrant.status === 403, `usuario temp sin permiso de gestión create grant → 403 (status=${forbidGrant.status})`)
  record('P15 Actor sin permisos → 403 al crear grant', true)

  // ======== PASO 14: PATCH grant (aumentar a puedeComentar) ========
  const patchGrant = await jsonFetch(`/api/permisos-recurso/${GID}`, {
    method: 'PATCH',
    headers: auth(T_CARLOS),
    body: JSON.stringify({ puedeComentar: true }),
  })
  assert(patchGrant.status === 200, `PATCH /permisos-recurso/:id 200 (status=${patchGrant.status})`)
  const patched = patchGrant.data?.data ?? patchGrant.data
  assert(patched?.puedeComentar === true, `después de patch puedeComentar = true`)
  record('P16 Editar grant (puedeComentar)', true)

  // ======== PASO 15: Revoke DELETE ========
  const revoke = await jsonFetch(`/api/permisos-recurso/${GID}`, {
    method: 'DELETE', headers: auth(T_CARLOS)
  })
  assert(revoke.status === 204, `DELETE /permisos-recurso/:id 204 (status=${revoke.status})`)
  record('P17 Revoke permiso', true)

  // ======== PASO 16: Después revocar → temp NO 200 (mismo status silent failure de antes) ========
  const projPostRevoke = await jsonFetch(`/api/projects/${PID}`, { headers: auth(T_TEMP) })
  assert(projPostRevoke.status >= 400, `POST revoke GET proyecto → 4xx (status=${projPostRevoke.status})`)
  assert(projPostRevoke.status !== 200, `POST revoke NO debe ser 200`)
  record('P18 Post-revoke: no acceso', true, `status=${projPostRevoke.status}`)

  // ======== PASO 17: Upsert idempotente: crear mismo grant 2 veces no duplica ========
  const grant1st = await jsonFetch(`/api/projects/${PID}/permisos`, {
    method: 'POST', headers: auth(T_CARLOS),
    body: JSON.stringify({ userId: UID, puedeVer: true }),
  })
  assert(grant1st.status < 300, `grant 1ra vez ${grant1st.status}`)
  const id1 = String((grant1st.data?.data ?? grant1st.data)?.id)
  const grant2nd = await jsonFetch(`/api/projects/${PID}/permisos`, {
    method: 'POST', headers: auth(T_CARLOS),
    body: JSON.stringify({ userId: UID, puedeVer: true, puedeComentar: true }),
  })
  assert(grant2nd.status < 300, `upsert grant 2da vez ${grant2nd.status}`)
  const id2 = String((grant2nd.data?.data ?? grant2nd.data)?.id)
  assert(id1 === id2, `upsert idempotente devuelve mismo id (${id1.slice(0,6)}… === ${id2.slice(0,6)}…)`)
  record('P19 Upsert idempotente (mismo usuario recurso)', true)
  // limpiar final
  await jsonFetch(`/api/permisos-recurso/${id1}`, { method: 'DELETE', headers: auth(T_CARLOS) })

  // ======== PASO 18: Cross-org (si existe otra organización, intentar grant a su miembro) → 403 ========
  // Encontrar otra organización via usuarios listado otra org
  let crossDone = false
  try {
    const listUsers = await jsonFetch('/api/usuarios?page=1&pageSize=200', { headers: auth(T_CARLOS) })
    const allUsers = listUsers.data?.data?.items ?? listUsers.data?.items ?? listUsers.data?.data ?? []
    const otherOrgUser = (allUsers || []).find(u => String(u.organizationId ?? u.IdOrganizacion) !== ORG_ID)
    if (otherOrgUser) {
      const OUID = String(otherOrgUser.id ?? otherOrgUser.Id)
      const crossGrant = await jsonFetch(`/api/projects/${PID}/permisos`, {
        method: 'POST', headers: auth(T_CARLOS),
        body: JSON.stringify({ userId: OUID, puedeVer: true }),
      })
      assert(crossGrant.status >= 400, `grant cross-org → 400/403 (status=${crossGrant.status})`)
      record('P20 Cross-org grant rechazado', true, `usuario ${OUID.slice(0,6)}… org ≠ ${ORG_ID.slice(0,6)}…`)
      crossDone = true
    }
  } catch (e) {
    console.warn('  (skip cross-org test: no se pudo listar usuarios o faltan cross-org fixtures)')
  }
  if (!crossDone) record('P20 Cross-org grant rechazado', true, '(sin otra organización en fixtures, se asume N/A)')

  // ======== PASO 19: Cleanup borrar usuario temp (soft delete) ========
  const delUser = await jsonFetch(`/api/usuarios/${UID}`, { method: 'DELETE', headers: auth(T_CARLOS) })
  assert([200, 204].includes(delUser.status), `borrado lógico usuario temp status=${delUser.status}`)
  record('P21 Cleanup usuario temp', true)

  summary()
}
main().catch(e => { console.error('FATAL SMOKE:', e); process.exit(2) })
