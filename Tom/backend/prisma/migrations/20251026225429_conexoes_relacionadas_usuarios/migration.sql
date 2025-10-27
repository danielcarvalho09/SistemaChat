/*
  Warnings:

  - You are about to drop the `connection_departments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_connections` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "connection_departments" DROP CONSTRAINT "connection_departments_connectionId_fkey";

-- DropForeignKey
ALTER TABLE "connection_departments" DROP CONSTRAINT "connection_departments_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "user_connections" DROP CONSTRAINT "user_connections_connectionId_fkey";

-- DropForeignKey
ALTER TABLE "user_connections" DROP CONSTRAINT "user_connections_userId_fkey";

-- AlterTable
ALTER TABLE "whatsapp_connections" ADD COLUMN     "userId" TEXT;

-- DropTable
DROP TABLE "connection_departments";

-- DropTable
DROP TABLE "user_connections";

-- CreateIndex
CREATE INDEX "whatsapp_connections_userId_idx" ON "whatsapp_connections"("userId");

-- AddForeignKey
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
