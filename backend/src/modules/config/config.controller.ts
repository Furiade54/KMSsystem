import { type Request, type Response } from 'express'
import { env, getEnvFilePath, saveEnv as saveEnvToFile } from '../../shared/config/env'
import { testDbConnection, rebuildDbPool } from '../../shared/db/pool'
import { invalidateStorageProvider, createStorageProvider } from '../../shared/storage'

const SECRET_KEYS = new Set(['JWT_SECRET', 'SQL_PASSWORD', 'AWS_SECRET_ACCESS_KEY'])
const PLACEHOLDER = '__KEEP_CURRENT__'

type EnvRecord = Record<string, string | number | boolean | undefined>

function maskIfSecret(key: string, value: unknown): unknown {
  if (!SECRET_KEYS.has(key)) return value
  if (!value) return ''
  const s = String(value)
  const len = s.length
  if (len <= 6) return '••••••'
  return `${s.slice(0, 2)}${'•'.repeat(Math.max(4, len - 4))}${s.slice(-2)}`
}

interface Field {
  key: string
  label: string
  type: 'text' | 'number' | 'password' | 'select' | 'checkbox' | 'textarea'
  group: 'general' | 'jwt' | 'sql' | 'storage' | 'aws' | 'cors'
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  hint?: string
  secret?: boolean
}

const FIELDS: Field[] = [
  { key: 'PORT', label: 'Puerto', type: 'number', group: 'general', placeholder: '51478' },
  {
    key: 'NODE_ENV',
    label: 'Entorno',
    type: 'select',
    group: 'general',
    options: [
      { value: 'development', label: 'Desarrollo' },
      { value: 'test', label: 'Pruebas' },
      { value: 'production', label: 'Producción' },
    ],
  },
  { key: 'JWT_SECRET', label: 'Secreto JWT', type: 'password', group: 'jwt', hint: 'Mínimo 10 caracteres. Se invalida todas las sesiones si se cambia.', secret: true },
  { key: 'JWT_EXPIRES_IN', label: 'Expiración tokens JWT', type: 'text', group: 'jwt', placeholder: '24h' },

  { key: 'SQL_SERVER', label: 'Servidor SQL', type: 'text', group: 'sql', placeholder: 'localhost o HP2023' },
  { key: 'SQL_INSTANCE_NAME', label: 'Nombre de instancia (opcional)', type: 'text', group: 'sql', placeholder: 'ej. SQLEXPRESS, IST' },
  { key: 'SQL_PORT', label: 'Puerto SQL', type: 'number', group: 'sql', placeholder: '1433' },
  { key: 'SQL_DATABASE', label: 'Base de datos', type: 'text', group: 'sql', placeholder: 'KMS' },
  { key: 'SQL_USER', label: 'Usuario SQL', type: 'text', group: 'sql', placeholder: 'sa' },
  { key: 'SQL_PASSWORD', label: 'Contraseña SQL', type: 'password', group: 'sql', secret: true },
  { key: 'SQL_ENCRYPT', label: 'Usar cifrado SQL (encrypt)', type: 'checkbox', group: 'sql' },

  {
    key: 'STORAGE_PROVIDER',
    label: 'Proveedor de almacenamiento',
    type: 'select',
    group: 'storage',
    options: [
      { value: 'local', label: 'Local (carpeta)' },
      { value: 's3', label: 'S3 / AWS' },
    ],
  },
  { key: 'STORAGE_LOCAL_PATH', label: 'Ruta local', type: 'text', group: 'storage', placeholder: './storage' },

  { key: 'AWS_REGION', label: 'AWS Región', type: 'text', group: 'aws', placeholder: 'us-east-1' },
  { key: 'AWS_ACCESS_KEY_ID', label: 'AWS Access Key ID', type: 'text', group: 'aws', placeholder: 'AKIA...' },
  { key: 'AWS_SECRET_ACCESS_KEY', label: 'AWS Secret Access Key', type: 'password', group: 'aws', secret: true },
  { key: 'AWS_S3_BUCKET', label: 'AWS S3 Bucket', type: 'text', group: 'aws', placeholder: 'kms-bucket' },
  { key: 'AWS_S3_PRESIGNED_EXPIRES_IN', label: 'Expiración enlaces S3 firmados (segundos)', type: 'number', group: 'aws', placeholder: '900' },

  { key: 'CORS_ORIGIN', label: 'Orígenes CORS (separados por coma)', type: 'textarea', group: 'cors', placeholder: 'http://localhost:51479' },
]

const GROUPS: Array<{ id: Field['group']; title: string; hint?: string }> = [
  { id: 'general', title: 'General' },
  { id: 'jwt', title: 'JWT / Sesiones' },
  { id: 'sql', title: 'SQL Server', hint: 'Guarda los cambios para probar la conexión con los nuevos valores en vivo.' },
  { id: 'storage', title: 'Almacenamiento' },
  { id: 'aws', title: 'AWS / S3' },
  { id: 'cors', title: 'CORS' },
]

function currentToMasked(): EnvRecord {
  const res: EnvRecord = {}
  for (const f of FIELDS) {
    const value = (env as unknown as EnvRecord)[f.key]
    if (f.secret) {
      res[f.key] = String(maskIfSecret(f.key, value ?? '') ?? '')
    } else {
      res[f.key] = value as EnvRecord[string]
    }
  }
  return res
}

function fieldsJSON(): Array<Field & { value?: EnvRecord[string] }> {
  const values = currentToMasked()
  return FIELDS.map((f) => ({ ...f, value: values[f.key] }))
}

function renderHtml(req: Request, res: Response) {
  const groups = GROUPS
  const values = currentToMasked()
  const envPath = getEnvFilePath()

  const fieldHtml = (f: Field) => {
    const v = (values[f.key] ?? '') as string | number | boolean
    const id = `f_${f.key}`
    if (f.type === 'select') {
      const opts = f.options?.map((o) => `<option value="${o.value}" ${String(v) === o.value ? 'selected' : ''}>${o.label}</option>`).join('') ?? ''
      return `<select id="${id}" name="${f.key}" data-key="${f.key}">${opts}</select>`
    }
    if (f.type === 'checkbox') {
      return `
        <label class="switch">
          <input type="hidden" name="${f.key}" value="false" data-placeholder="1" />
          <input type="checkbox" id="${id}" name="${f.key}" value="true" data-key="${f.key}" ${v ? 'checked' : ''} />
          <span class="slider"></span>
        </label>`
    }
    if (f.type === 'textarea') {
      return `<textarea id="${id}" name="${f.key}" rows="2" data-key="${f.key}" placeholder="${f.placeholder ?? ''}">${escapeHtml(String(v ?? ''))}</textarea>`
    }
    if (f.secret) {
      const storedAsPlaceholder = String(v).includes('•')
      return `
        <div class="pwd-wrap">
          <input
            type="${f.type}"
            id="${id}"
            name="${f.key}"
            data-key="${f.key}"
            data-keep-if-placeholder="1"
            data-placeholder-value="${escapeHtml(String(v ?? ''))}"
            placeholder="${f.placeholder ?? ''}"
            value="${storedAsPlaceholder ? '' : escapeHtml(String(v ?? ''))}"
            autocomplete="off"
            spellcheck="false"
          />
          <button type="button" class="mini" data-toggle-pwd="${id}" title="Mostrar/ocultar">👁</button>
          ${storedAsPlaceholder ? `<div class="hint keep-hint" id="hint_${id}">Manteniendo valor actual guardado. Edita para reemplazarlo.</div>` : ''}
        </div>`
    }
    return `<input type="${f.type}" id="${id}" name="${f.key}" data-key="${f.key}" value="${escapeHtml(String(v ?? ''))}" placeholder="${f.placeholder ?? ''}" />`
  }

  const groupsHtml = groups
    .map((g) => {
      const fieldsInGroup = FIELDS.filter((f) => f.group === g.id)
      return `
        <section class="card">
          <header>
            <h2>${g.title}</h2>
            ${g.hint ? `<p class="hint">${g.hint}</p>` : ''}
          </header>
          <div class="grid">
            ${fieldsInGroup.map((f) => `
              <div class="row" data-field="${f.key}">
                <label for="f_${f.key}">${f.label}</label>
                ${fieldHtml(f)}
                ${f.hint ? `<p class="hint">${f.hint}</p>` : ''}
              </div>`).join('')}
          </div>
        </section>`
    })
    .join('')

  const baseUrl = `${req.protocol}://${req.get('host') ?? ''}`

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Configuración · KMS</title>
  <style>
    :root {
      --bg: #0b1020;
      --bg-soft: #121a30;
      --card: #141c33;
      --text: #e6ecff;
      --muted: #9aa7c7;
      --border: #233056;
      --primary: #6c8cff;
      --primary-dark: #5573e8;
      --ok: #2ecc71;
      --warn: #f5b301;
      --err: #ef5b5b;
      --chip: #1e2a4d;
      --shadow: 0 8px 24px rgba(0,0,0,0.35);
      --radius: 12px;
      --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: radial-gradient(1200px 800px at 10% -10%, #1a244a 0%, var(--bg) 60%); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif; }
    body { min-height: 100vh; }
    header.topbar { position: sticky; top: 0; z-index: 20; backdrop-filter: blur(14px); background: rgba(11,16,32,0.75); border-bottom: 1px solid var(--border); }
    .top { max-width: 1100px; margin: 0 auto; padding: 14px 20px; display: flex; gap: 16px; align-items: center; justify-content: space-between; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .logo { width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, #6c8cff, #9f6cff); display: grid; place-items: center; font-weight: 800; box-shadow: var(--shadow); }
    .brand h1 { font-size: 16px; margin: 0; letter-spacing: 0.2px; }
    .brand .sub { color: var(--muted); font-size: 12px; }
    .actions { display: flex; gap: 8px; align-items: center; }
    main { max-width: 1100px; margin: 0 auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; padding-bottom: 120px; }
    .banner { background: var(--bg-soft); border: 1px solid var(--border); border-left: 4px solid var(--warn); padding: 12px 14px; border-radius: var(--radius); font-size: 13px; color: var(--muted); }
    .banner b { color: var(--text); }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; box-shadow: var(--shadow); }
    .card > header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 10px; }
    .card h2 { margin: 0; font-size: 15px; letter-spacing: 0.3px; }
    .hint { color: var(--muted); font-size: 12px; margin: 4px 0 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 20px; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
    .row { display: flex; flex-direction: column; gap: 6px; }
    .row label { font-size: 13px; color: #cfd8ff; font-weight: 600; }
    input[type=text], input[type=password], input[type=number], textarea, select {
      width: 100%; background: #0f1732; color: var(--text); border: 1px solid var(--border); border-radius: 10px;
      padding: 10px 12px; font-size: 14px; outline: none; transition: border-color .15s, box-shadow .15s;
    }
    textarea { resize: vertical; min-height: 66px; }
    input:focus, textarea:focus, select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(108,140,255,0.25); }
    input:disabled, textarea:disabled, select:disabled { opacity: 0.55; }
    .pwd-wrap { position: relative; }
    .pwd-wrap button.mini { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: 0; cursor: pointer; color: var(--muted); padding: 4px 8px; }
    .keep-hint { color: var(--ok); }
    .switch { position: relative; display: inline-block; width: 46px; height: 26px; }
    .switch input { display: none; }
    .slider { position: absolute; cursor: pointer; inset: 0; background: #2a365e; border-radius: 999px; transition: .2s; }
    .slider::before { content: ""; position: absolute; height: 20px; width: 20px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: .2s; }
    .switch input:checked + .slider { background: var(--primary); }
    .switch input:checked + .slider::before { transform: translateX(20px); }
    button {
      background: var(--primary); color: white; border: 0; padding: 10px 14px; border-radius: 10px; font-weight: 600;
      cursor: pointer; transition: background .15s, transform .05s; font-size: 14px;
    }
    button:hover { background: var(--primary-dark); }
    button:active { transform: translateY(1px); }
    button.secondary { background: var(--chip); color: var(--text); }
    button.ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
    button.danger { background: var(--err); }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .sticky-footer { position: fixed; bottom: 0; left: 0; right: 0; z-index: 30; border-top: 1px solid var(--border); background: rgba(11,16,32,0.9); backdrop-filter: blur(14px); }
    .footer-inner { max-width: 1100px; margin: 0 auto; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .status { font-size: 13px; color: var(--muted); display: flex; align-items: center; gap: 8px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
    .dot.ok { background: var(--ok); box-shadow: 0 0 10px var(--ok); }
    .dot.err { background: var(--err); box-shadow: 0 0 10px var(--err); }
    .mono { font-family: var(--mono); font-size: 12px; color: var(--muted); word-break: break-all; }
    .toast-wrap { position: fixed; top: 74px; right: 20px; z-index: 50; display: flex; flex-direction: column; gap: 8px; max-width: 420px; }
    .toast { background: var(--card); border: 1px solid var(--border); color: var(--text); padding: 10px 12px; border-radius: 10px; box-shadow: var(--shadow); border-left: 4px solid var(--primary); animation: slideIn .2s ease-out; }
    .toast.ok { border-left-color: var(--ok); }
    .toast.err { border-left-color: var(--err); }
    .toast.warn { border-left-color: var(--warn); }
    @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    details { background: var(--bg-soft); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 14px; }
    summary { cursor: pointer; color: var(--muted); font-size: 13px; user-select: none; }
    details[open] summary { margin-bottom: 8px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { background: var(--chip); color: #cfd8ff; padding: 4px 10px; border-radius: 999px; font-size: 12px; }
    .sql-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="top">
      <div class="brand">
        <div class="logo">K</div>
        <div>
          <h1>Panel de configuración · KMS</h1>
          <div class="sub">Cambia variables de entorno en caliente y persiste en el archivo .env</div>
        </div>
      </div>
      <div class="actions">
        <button class="ghost" id="btnDump" type="button">Mostrar valores actuales</button>
        <button class="secondary" id="btnReload" type="button">Recargar desde .env</button>
      </div>
    </div>
  </header>

  <main>
    <div class="banner">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <div>
          <b>¡Cuidado!</b> Los cambios se guardan directamente en <span class="mono">${escapeHtml(envPath)}</span>
          y se aplican en vivo al backend (pool SQL, storage, CORS y JWT). El <b>Puerto</b> requiere reinicio manual.
        </div>
        <div class="chips" id="envChips"></div>
      </div>
    </div>

    <form id="configForm" autocomplete="off" spellcheck="false" novalidate>
      ${groupsHtml}

      <section class="card">
        <header>
          <h2>Acciones rápidas</h2>
        </header>
        <div class="sql-actions">
          <button type="button" class="secondary" id="btnTestSql">Probar conexión SQL con valores del formulario</button>
          <button type="button" class="secondary" id="btnResetStorage">Reinicializar proveedor de almacenamiento</button>
          <button type="button" class="secondary" id="btnRebuildSql">Reconstruir pool SQL actual</button>
        </div>
        <div id="quickStatus" style="margin-top:10px;" class="status"></div>
      </section>

      <div id="dumpArea" style="display:none;">
        <details open>
          <summary>Valores actuales (secretos enmascarados)</summary>
          <pre class="mono" id="dumpContent"></pre>
        </details>
      </div>
    </form>
  </main>

  <div class="sticky-footer">
    <div class="footer-inner">
      <div class="status">
        <span class="dot" id="statusDot"></span>
        <span id="statusText">Sin cambios sin guardar</span>
      </div>
      <div class="actions">
        <button type="button" class="ghost" id="btnResetForm">Deshacer</button>
        <button type="submit" form="configForm" id="btnSave">Guardar y aplicar</button>
      </div>
    </div>
  </div>

  <div class="toast-wrap" id="toastWrap"></div>

<script>
  const FIELDS_META = ${JSON.stringify(FIELDS)};
  const SECRET = new Set(${JSON.stringify([...SECRET_KEYS])});
  const PLACEHOLDER = ${JSON.stringify(PLACEHOLDER)};
  const BASE = ${JSON.stringify(baseUrl)};

  function toast(msg, kind, ttl) {
    kind = kind || 'ok';
    ttl = ttl || 3500;
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    document.getElementById('toastWrap').appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(function () { el.remove(); }, 200);
    }, ttl);
  }

  function setStatus(text, kind) {
    kind = kind || '';
    document.getElementById('statusText').textContent = text;
    const dot = document.getElementById('statusDot');
    dot.classList.remove('ok', 'err');
    if (kind === 'ok') dot.classList.add('ok');
    if (kind === 'err') dot.classList.add('err');
  }

  function collectForm() {
    const out = {};
    const form = document.getElementById('configForm');
    for (const f of FIELDS_META) {
      const el = form.elements.namedItem(f.key);
      if (!el) continue;
      if (f.type === 'checkbox') {
        const checked = Array.from(form.querySelectorAll('input[name="' + f.key + '"]')).find(function (x) { return x.type === 'checkbox'; })?.checked || false;
        out[f.key] = checked ? 'true' : 'false';
      } else if (f.secret) {
        const realEl = document.getElementById('f_' + f.key);
        const typed = realEl && realEl.value ? realEl.value : '';
        if (typed === '' || typed === null) {
          out[f.key] = PLACEHOLDER;
        } else {
          out[f.key] = typed;
        }
      } else {
        out[f.key] = el.value;
      }
    }
    return out;
  }

  async function api(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  function refreshChips(envObject) {
    const host = document.getElementById('envChips');
    host.innerHTML = '';
    ['NODE_ENV','STORAGE_PROVIDER'].forEach(k => {
      const span = document.createElement('span');
      span.className = 'chip';
      span.textContent = k + ' = ' + (envObject?.[k] ?? '');
      host.appendChild(span);
    });
  }

  async function refreshDump() {
    const { data } = await api('GET', '/api/config');
    document.getElementById('dumpContent').textContent = JSON.stringify(data, null, 2);
    refreshChips(data);
  }

  document.getElementById('btnDump').addEventListener('click', () => {
    document.getElementById('dumpArea').style.display = 'block';
    refreshDump();
  });

  document.getElementById('btnReload').addEventListener('click', async () => {
    setStatus('Recargando variables desde .env…');
    const r = await api('POST', '/api/config/reload');
    if (r.ok) { toast('Variables recargadas desde .env', 'ok'); setStatus('Recargado correctamente', 'ok'); setTimeout(() => location.reload(), 400); }
    else { toast('Error al recargar: ' + (r.data?.error ?? ''), 'err'); setStatus('Fallo al recargar', 'err'); }
  });

  document.getElementById('btnResetForm').addEventListener('click', () => location.reload());

  document.getElementById('configForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSave');
    btn.disabled = true;
    setStatus('Guardando y aplicando cambios…');
    const payload = collectForm();
    const r = await api('POST', '/api/config', payload);
    btn.disabled = false;
    if (r.ok) {
      setStatus('Cambios aplicados correctamente', 'ok');
      const msg = ['Guardado correcto'];
      if (r.data?.pool) msg.push('Pool SQL: ' + (r.data.pool.ok ? 'OK (' + (r.data.pool.version || '').split(' - ')[0] + ')' : 'FALLO: ' + r.data.pool.message));
      if (r.data?.storage) msg.push('Storage: reiniciado');
      if (r.data?.portChanged) msg.push('⚠️ Puerto modificado: requiere reinicio manual del servidor');
      toast(msg.join(' · '), 'ok', 5500);
      setTimeout(() => location.reload(), 700);
    } else {
      setStatus('Error al guardar', 'err');
      toast('Error: ' + (r.data?.error ?? r.data?.message ?? 'desconocido'), 'err', 6000);
    }
  });

  document.getElementById('btnTestSql').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const el = (msg) => { document.getElementById('quickStatus').innerHTML = msg; };
    el('<span class="dot"></span> Probando conexión SQL con los valores del formulario…');
    const values = collectForm();
    const payload = {
      server: values.SQL_SERVER,
      instance: values.SQL_INSTANCE_NAME,
      port: values.SQL_PORT ? Number(values.SQL_PORT) : undefined,
      database: values.SQL_DATABASE,
      user: values.SQL_USER,
      password: values.SQL_PASSWORD === PLACEHOLDER ? undefined : values.SQL_PASSWORD,
      encrypt: values.SQL_ENCRYPT === 'true',
    };
    const r = await api('POST', '/api/config/test-sql', payload);
    btn.disabled = false;
    if (r.ok && r.data?.ok) {
      el('<span class="dot ok"></span> Conexión SQL exitosa · versión: <span class="mono">' + (r.data?.version || '') + '</span> · mensaje: ' + (r.data?.message || ''));
    } else {
      el('<span class="dot err"></span> Fallo SQL: ' + (r.data?.message || (r.data?.error || 'desconocido')));
    }
  });

  document.getElementById('btnRebuildSql').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const el = (msg) => { document.getElementById('quickStatus').innerHTML = msg; };
    el('<span class="dot"></span> Reconstruyendo pool SQL con variables actuales…');
    const r = await api('POST', '/api/config/rebuild-pool');
    btn.disabled = false;
    if (r.ok && r.data?.ok) el('<span class="dot ok"></span> Pool reconstruido · ' + (r.data?.version || '').split(' - ')[0]);
    else el('<span class="dot err"></span> Fallo al reconstruir pool: ' + (r.data?.message || 'desconocido'));
  });

  document.getElementById('btnResetStorage').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const el = (msg) => { document.getElementById('quickStatus').innerHTML = msg; };
    el('<span class="dot"></span> Reinicializando storage…');
    const r = await api('POST', '/api/config/reset-storage');
    btn.disabled = false;
    if (r.ok) el('<span class="dot ok"></span> Storage reinicializado · ' + (r.data?.provider || ''));
    else el('<span class="dot err"></span> Fallo: ' + (r.data?.error || 'desconocido'));
  });

  // Toggle visibility de password fields
  document.querySelectorAll('button[data-toggle-pwd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle-pwd');
      const el = document.getElementById(id);
      if (!el) return;
      el.type = el.type === 'password' ? 'text' : 'password';
    });
  });

  // Estado inicial
  (async () => {
    try {
      const { data } = await api('GET', '/api/config');
      refreshChips(data);
    } catch {}
  })();
</script>
</body>
</html>`
  res.type('text/html; charset=utf-8').send(html)
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
}

export const getConfigPage = (_req: Request, res: Response) => {
  renderHtml(_req, res)
}

export const getConfigJSON = (_req: Request, res: Response) => {
  const payload: Record<string, unknown> = {}
  for (const f of FIELDS) {
    const val = (env as unknown as Record<string, unknown>)[f.key]
    payload[f.key] = f.secret ? maskIfSecret(f.key, val) : val
  }
  res.status(200).json({
    success: true,
    ...payload,
    __file: getEnvFilePath(),
    __fields: fieldsJSON(),
  } as unknown as Record<string, unknown>)
}

function coerceTypeFor(field: Field, raw: unknown): string | number | boolean | undefined {
  if (raw === undefined || raw === null) return undefined
  if (field.type === 'checkbox') {
    if (typeof raw === 'boolean') return raw
    const s = String(raw).trim().toLowerCase()
    return s === '1' || s === 'true' || s === 'on'
  }
  if (field.type === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }
  if (field.type === 'select' && String(raw).trim() === '') return undefined
  return String(raw)
}

export const postConfig = async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {}
    const previousPort = env.PORT
    const previousEnv = env.NODE_ENV
    const patch: Record<string, unknown> = {}
    for (const f of FIELDS) {
      const raw = body[f.key]
      if (f.secret) {
        if (raw === undefined || raw === PLACEHOLDER) {
          patch[f.key] = PLACEHOLDER
          continue
        }
      }
      patch[f.key] = coerceTypeFor(f, raw)
    }
    const saved = await saveEnvToFile(patch as Record<string, never>)
    if (!saved.ok) return res.status(400).json({ success: false, error: saved.error })

    invalidateStorageProvider()
    createStorageProvider()

    let pool: { ok: boolean; message: string; version?: string } | undefined
    const shouldRebuildPool =
      patch.SQL_SERVER !== PLACEHOLDER ||
      patch.SQL_INSTANCE_NAME !== PLACEHOLDER ||
      patch.SQL_PORT !== PLACEHOLDER ||
      patch.SQL_DATABASE !== PLACEHOLDER ||
      patch.SQL_USER !== PLACEHOLDER ||
      patch.SQL_PASSWORD !== PLACEHOLDER ||
      patch.SQL_ENCRYPT !== PLACEHOLDER
    const anyPatch = Object.entries(patch).filter(([, v]) => v !== PLACEHOLDER).length > 0
    if (anyPatch && shouldRebuildPool) {
      pool = await rebuildDbPool()
    }

    return res.status(200).json({
      success: true,
      message: 'Configuración guardada y aplicada',
      applied: saved.applied,
      pool,
      storage: { provider: env.STORAGE_PROVIDER },
      portChanged: previousPort !== env.PORT,
      envChanged: previousEnv !== env.NODE_ENV,
      file: getEnvFilePath(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ success: false, error: msg })
  }
}

export const postTestSql = async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {}
    const result = await testDbConnection({
      server: body.server ? String(body.server) : undefined,
      port: body.port ? Number(body.port) : undefined,
      instance: body.instance ? String(body.instance) : undefined,
      database: body.database ? String(body.database) : undefined,
      user: body.user ? String(body.user) : undefined,
      password: body.password ? String(body.password) : undefined,
      encrypt: !!body.encrypt,
    })
    res.status(result.ok ? 200 : 400).json({ success: result.ok, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ success: false, ok: false, message: msg })
  }
}

export const postReloadEnv = async (_req: Request, res: Response) => {
  try {
    const { reloadEnv: reload } = await import('../../shared/config/env')
    const result = await reload()
    if (!result.ok) return res.status(500).json({ success: false, error: result.error })
    invalidateStorageProvider()
    return res.status(200).json({ success: true, message: 'Variables recargadas' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ success: false, error: msg })
  }
}

export const postRebuildPool = async (_req: Request, res: Response) => {
  try {
    const result = await rebuildDbPool()
    res.status(result.ok ? 200 : 500).json({ success: result.ok, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ success: false, ok: false, message: msg })
  }
}

export const postResetStorage = async (_req: Request, res: Response) => {
  try {
    invalidateStorageProvider()
    const p = createStorageProvider()
    const providerName = env.STORAGE_PROVIDER
    if (p && typeof p.ensureBucket === 'function') await p.ensureBucket()
    return res.status(200).json({ success: true, provider: providerName })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ success: false, error: msg })
  }
}
