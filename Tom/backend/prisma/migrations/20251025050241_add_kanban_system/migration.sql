-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "kanbanStageId" TEXT;

-- CreateTable
CREATE TABLE "kanban_stages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "order" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kanban_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_history" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "toStageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kanban_stages_order_idx" ON "kanban_stages"("order");

-- CreateIndex
CREATE INDEX "conversation_history_conversationId_idx" ON "conversation_history"("conversationId");

-- CreateIndex
CREATE INDEX "conversation_history_createdAt_idx" ON "conversation_history"("createdAt");

-- CreateIndex
CREATE INDEX "conversations_kanbanStageId_idx" ON "conversations"("kanbanStageId");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_kanbanStageId_fkey" FOREIGN KEY ("kanbanStageId") REFERENCES "kanban_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_history" ADD CONSTRAINT "conversation_history_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_history" ADD CONSTRAINT "conversation_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
