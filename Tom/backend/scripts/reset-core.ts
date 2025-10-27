import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetCore() {
  console.log('⚠️  Apagando TODAS as conversas, conexões e departamentos...')

  try {
    // Conversas (ordem segura por dependências)
    const deleted = {
      conversationTags: (await prisma.conversationTag.deleteMany({})).count,
      conversationHistory: (await prisma.conversationHistory.deleteMany({})).count,
      conversationMetrics: (await prisma.conversationMetric.deleteMany({})).count,
      attachments: (await prisma.attachment.deleteMany({})).count,
      messages: (await prisma.message.deleteMany({})).count,
      transfers: (await prisma.conversationTransfer.deleteMany({})).count,
      conversations: (await prisma.conversation.deleteMany({})).count,
    }

    // Conexões WhatsApp
    const connections = (await prisma.whatsAppConnection.deleteMany({})).count

    // Departamentos (e relações)
    const deptSide = {
      userDepartmentAccess: (await prisma.userDepartmentAccess.deleteMany({})).count,
      messageTemplates: (await prisma.messageTemplate.deleteMany({})).count,
      departments: (await prisma.department.deleteMany({})).count,
    }

    console.log('\n✅ Limpeza concluída!')
    console.log('\n📊 Resumo:')
    console.log(`  - Tags de conversas:       ${deleted.conversationTags}`)
    console.log(`  - Histórico de conversas:  ${deleted.conversationHistory}`)
    console.log(`  - Métricas:                ${deleted.conversationMetrics}`)
    console.log(`  - Anexos:                  ${deleted.attachments}`)
    console.log(`  - Mensagens:               ${deleted.messages}`)
    console.log(`  - Transferências:          ${deleted.transfers}`)
    console.log(`  - Conversas:               ${deleted.conversations}`)
    console.log(`  - Conexões:                ${connections}`)
    console.log(`  - Acessos de usuários x departamentos: ${deptSide.userDepartmentAccess}`)
    console.log(`  - Templates de mensagem:   ${deptSide.messageTemplates}`)
    console.log(`  - Departamentos:           ${deptSide.departments}`)
  } catch (error) {
    console.error('❌ Erro ao resetar dados:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

resetCore()
