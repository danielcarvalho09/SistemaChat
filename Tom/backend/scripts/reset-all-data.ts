import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetAllData() {
  console.log('⚠️  Reset estendido: apagando contatos, tags, broadcasts, kanban, notificações e logs...')
  try {
    // Broadcasts e listas
    const broadcastLogs = (await prisma.broadcastLog.deleteMany({})).count
    const broadcasts = (await prisma.broadcast.deleteMany({})).count
    const listContacts = (await prisma.listContact.deleteMany({})).count
    const contactLists = (await prisma.contactList.deleteMany({})).count
    const broadcastConfigs = (await prisma.broadcastConfig.deleteMany({})).count

    // Tags e kanban
    const conversationTags = (await prisma.conversationTag.deleteMany({})).count
    const tags = (await prisma.tag.deleteMany({})).count
    const kanbanStages = (await prisma.kanbanStage.deleteMany({})).count

    // Notificações e preferências
    const notifications = (await prisma.notification.deleteMany({})).count
    const notificationPreferences = (await prisma.notificationPreference.deleteMany({})).count

    // Auditoria e métricas
    const auditLogs = (await prisma.auditLog.deleteMany({})).count
    const conversationMetrics = (await prisma.conversationMetric.deleteMany({})).count

    // Contatos
    const contacts = (await prisma.contact.deleteMany({})).count

    console.log('\n✅ Reset estendido concluído!')
    console.log('\n📊 Resumo:')
    console.log(`  - Broadcast logs:          ${broadcastLogs}`)
    console.log(`  - Broadcasts:              ${broadcasts}`)
    console.log(`  - Itens de listas (contatos): ${listContacts}`)
    console.log(`  - Listas de contatos:      ${contactLists}`)
    console.log(`  - Configs de broadcast:    ${broadcastConfigs}`)
    console.log(`  - Tags de conversas:       ${conversationTags}`)
    console.log(`  - Tags:                    ${tags}`)
    console.log(`  - Etapas (Kanban):         ${kanbanStages}`)
    console.log(`  - Notificações:            ${notifications}`)
    console.log(`  - Preferências de notificação: ${notificationPreferences}`)
    console.log(`  - Logs de auditoria:       ${auditLogs}`)
    console.log(`  - Métricas de conversas:   ${conversationMetrics}`)
    console.log(`  - Contatos:                ${contacts}`)
  } catch (error) {
    console.error('❌ Erro no reset estendido:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

resetAllData()
