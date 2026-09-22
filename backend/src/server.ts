import app from './app'
import { env } from './shared/config/env'
import { getDbPool } from './shared/db/pool'
import { ensureAuditAndCommentTables, ensurePermissionCatalog } from './shared/db/audit'
import { syncSystemRoleDefaults } from './modules/users/users.service'

const PORT = env.PORT

async function bootstrap() {
  try {
    await getDbPool()
    await ensureAuditAndCommentTables()
    try {
      const pc = await ensurePermissionCatalog()
      if (pc.inserted > 0 || pc.updated > 0) {
        console.log(
          `📘 Catálogo permisos: insertados=${pc.inserted} actualizados=${pc.updated} total=${pc.total}/54`,
        )
      } else {
        console.log(`✅ Catálogo permisos: ${pc.total}/54 al día, nada que añadir.`)
      }
    } catch (e) {
      console.warn('⚠️  Sync catálogo permisos falló (no crítico):', (e as Error)?.message ?? e)
    }
    try {
      const res = await syncSystemRoleDefaults()
      if (res.permissionsAdded > 0) {
        console.log(
          `🔄 Sync roles sistema: orgs=${res.organizationsScanned} permisosAñadidos=${res.permissionsAdded} (AdminSync=${res.adminRolesSynced} rolesMiembroSync=${res.memberRolesSynced})`,
        )
      } else {
        console.log(
          `✅ Sync roles sistema: orgs=${res.organizationsScanned} — todo al día, nada que añadir.`,
        )
      }
    } catch (e) {
      console.warn('⚠️  Sync roles sistema falló (no crítico):', (e as Error)?.message ?? e)
    }
  } catch (err) {
    if (env.NODE_ENV !== 'development') {
      console.error('Fallo al inicializar BD:', err)
      process.exit(1)
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║  KMS API Server                                  ║
║  Knowledge Management System                     ║
╠══════════════════════════════════════════════════╣
║  🚀 Puerto:       ${String(PORT).padEnd(35)}║
║  📦 Entorno:      ${env.NODE_ENV.padEnd(35)}║
║  🔗 Health:       http://localhost:${String(PORT)}/api/health${' '.repeat(8)}║
║  ⚙️  Config UI:    http://localhost:${String(PORT)}/config${' '.repeat(11)}║
║  📖 Docs demo:    /api/auth/login                ║
╚══════════════════════════════════════════════════╝
    `)
    console.log('💡 Credenciales demo:')
    console.log('   ✉️  carlos.perez@ejemplo.com / 🔑 Demo1234')
  })

  const shutdown = (signal: string) => () => {
    console.log(`\n${signal} recibido. Apagando servidor...`)
    server.close(async (err) => {
      try {
        const { closeDbPool } = await import('./shared/db/pool')
        await closeDbPool()
      } catch {
        /* ignore */
      }
      process.exit(err ? 1 : 0)
    })
  }

  process.on('SIGTERM', shutdown('SIGTERM'))
  process.on('SIGINT', shutdown('SIGINT'))
}

bootstrap().catch((err) => {
  console.error('❌ Fallo al arrancar el servidor:', err)
  process.exit(1)
})
