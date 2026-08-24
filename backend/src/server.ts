import app from './app'
import { env } from './shared/config/env'
import { getDbPool } from './shared/db/pool'
import { ensureAuditAndCommentTables } from './shared/db/audit'

const PORT = env.PORT

async function bootstrap() {
  try {
    await getDbPool()
    await ensureAuditAndCommentTables()
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
