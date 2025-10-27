-- AlterTable
ALTER TABLE "whatsapp_connections" ADD COLUMN     "isMatriz" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "connection_departments" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connection_departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connection_departments_connectionId_idx" ON "connection_departments"("connectionId");

-- CreateIndex
CREATE INDEX "connection_departments_departmentId_idx" ON "connection_departments"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "connection_departments_connectionId_departmentId_key" ON "connection_departments"("connectionId", "departmentId");

-- CreateIndex
CREATE INDEX "whatsapp_connections_isMatriz_idx" ON "whatsapp_connections"("isMatriz");

-- AddForeignKey
ALTER TABLE "connection_departments" ADD CONSTRAINT "connection_departments_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "whatsapp_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_departments" ADD CONSTRAINT "connection_departments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
