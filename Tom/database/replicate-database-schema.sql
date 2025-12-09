-- ============================================================================
-- SCRIPT SQL PARA REPLICAR TODAS AS TABELAS E RELAÇÕES DO PROJETO
-- Sistema de Atendimento WhatsApp Multi-Tenant
-- ============================================================================
-- 
-- INSTRUÇÕES:
-- 1. Execute este script no banco de dados de destino (novo projeto)
-- 2. Certifique-se de que o banco está vazio ou que você quer sobrescrever
-- 3. Execute todo o script em uma transação para garantir consistência
-- 4. Após executar, rode o seed para popular dados iniciais (roles, etc)
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- EXTENSÕES (se necessário)
-- ============================================================================
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- REMOVER TABELAS EXISTENTES (CUIDADO: Isso apaga todos os dados!)
-- ============================================================================
-- Descomente as linhas abaixo se quiser limpar o banco antes de criar
-- DROP TABLE IF EXISTS "conversation_tags" CASCADE;
-- DROP TABLE IF EXISTS "conversation_transfers" CASCADE;
-- DROP TABLE IF EXISTS "conversation_history" CASCADE;
-- DROP TABLE IF EXISTS "conversation_metrics" CASCADE;
-- DROP TABLE IF EXISTS "attachments" CASCADE;
-- DROP TABLE IF EXISTS "messages" CASCADE;
-- DROP TABLE IF EXISTS "conversations" CASCADE;
-- DROP TABLE IF EXISTS "contacts" CASCADE;
-- DROP TABLE IF EXISTS "broadcast_logs" CASCADE;
-- DROP TABLE IF EXISTS "broadcasts" CASCADE;
-- DROP TABLE IF EXISTS "list_contacts" CASCADE;
-- DROP TABLE IF EXISTS "contact_lists" CASCADE;
-- DROP TABLE IF EXISTS "broadcast_configs" CASCADE;
-- DROP TABLE IF EXISTS "message_templates" CASCADE;
-- DROP TABLE IF EXISTS "quick_messages" CASCADE;
-- DROP TABLE IF EXISTS "notification_preferences" CASCADE;
-- DROP TABLE IF EXISTS "notifications" CASCADE;
-- DROP TABLE IF EXISTS "user_sessions" CASCADE;
-- DROP TABLE IF EXISTS "user_department_access" CASCADE;
-- DROP TABLE IF EXISTS "user_roles" CASCADE;
-- DROP TABLE IF EXISTS "role_permissions" CASCADE;
-- DROP TABLE IF EXISTS "permissions" CASCADE;
-- DROP TABLE IF EXISTS "roles" CASCADE;
-- DROP TABLE IF EXISTS "tags" CASCADE;
-- DROP TABLE IF EXISTS "conversation_tags" CASCADE;
-- DROP TABLE IF EXISTS "whatsapp_connections" CASCADE;
-- DROP TABLE IF EXISTS "ai_assistants" CASCADE;
-- DROP TABLE IF EXISTS "kanban_stages" CASCADE;
-- DROP TABLE IF EXISTS "departments" CASCADE;
-- DROP TABLE IF EXISTS "refresh_tokens" CASCADE;
-- DROP TABLE IF EXISTS "audit_logs" CASCADE;
-- DROP TABLE IF EXISTS "users" CASCADE;

-- ============================================================================
-- TABELAS BASE (sem dependências)
-- ============================================================================

-- ROLES
CREATE TABLE IF NOT EXISTS "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_key" ON "roles"("name");

-- PERMISSIONS
CREATE TABLE IF NOT EXISTS "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "permissions_name_key" ON "permissions"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_resource_action_key" ON "permissions"("resource", "action");

-- USERS
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_isActive_idx" ON "users"("isActive");

-- AI ASSISTANTS
CREATE TABLE IF NOT EXISTS "ai_assistants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gpt-4',
    "instructions" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 500,
    "memoryContext" INTEGER NOT NULL DEFAULT 20,
    "memoryCacheDays" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "ai_assistants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_assistants_name_key" ON "ai_assistants"("name");
CREATE INDEX IF NOT EXISTS "ai_assistants_isActive_idx" ON "ai_assistants"("isActive");

-- DEPARTMENTS
CREATE TABLE IF NOT EXISTS "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "icon" TEXT NOT NULL DEFAULT 'folder',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "departments_name_key" ON "departments"("name");
CREATE INDEX IF NOT EXISTS "departments_isActive_idx" ON "departments"("isActive");

-- KANBAN STAGES
CREATE TABLE IF NOT EXISTS "kanban_stages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "order" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "kanban_stages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kanban_stages_order_idx" ON "kanban_stages"("order");

-- TAGS
CREATE TABLE IF NOT EXISTS "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "createdBy" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tags_name_createdBy_key" ON "tags"("name", "createdBy");
CREATE INDEX IF NOT EXISTS "tags_createdBy_idx" ON "tags"("createdBy");
CREATE INDEX IF NOT EXISTS "tags_isGlobal_idx" ON "tags"("isGlobal");

-- WHATSAPP CONNECTIONS
CREATE TABLE IF NOT EXISTS "whatsapp_connections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "qrCode" TEXT,
    "avatar" TEXT,
    "sessionData" TEXT,
    "lastConnected" TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "isMatriz" BOOLEAN NOT NULL DEFAULT false,
    "authData" TEXT,
    "userId" TEXT,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiAssistantId" TEXT,
    "firstConnectedAt" TIMESTAMP,
    "lastDisconnectAt" TIMESTAMP,
    "lastSyncFrom" TIMESTAMP,
    "lastSyncTo" TIMESTAMP,
    "lastDisconnectReason" TEXT,

    CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_connections_phoneNumber_key" ON "whatsapp_connections"("phoneNumber");
CREATE INDEX IF NOT EXISTS "whatsapp_connections_phoneNumber_idx" ON "whatsapp_connections"("phoneNumber");
CREATE INDEX IF NOT EXISTS "whatsapp_connections_status_idx" ON "whatsapp_connections"("status");
CREATE INDEX IF NOT EXISTS "whatsapp_connections_isActive_idx" ON "whatsapp_connections"("isActive");
CREATE INDEX IF NOT EXISTS "whatsapp_connections_userId_idx" ON "whatsapp_connections"("userId");
CREATE INDEX IF NOT EXISTS "whatsapp_connections_aiAssistantId_idx" ON "whatsapp_connections"("aiAssistantId");
CREATE INDEX IF NOT EXISTS "whatsapp_connections_aiEnabled_idx" ON "whatsapp_connections"("aiEnabled");
CREATE INDEX IF NOT EXISTS "whatsapp_connections_isMatriz_idx" ON "whatsapp_connections"("isMatriz");
CREATE INDEX IF NOT EXISTS "idx_connections_phone_active" ON "whatsapp_connections"("phoneNumber", "isActive");
CREATE INDEX IF NOT EXISTS "idx_connections_user_status" ON "whatsapp_connections"("userId", "status");

-- CONTACTS
CREATE TABLE IF NOT EXISTS "contacts" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "email" TEXT,
    "tags" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "pushName" TEXT,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "contacts_phoneNumber_key" ON "contacts"("phoneNumber");
CREATE INDEX IF NOT EXISTS "contacts_phoneNumber_idx" ON "contacts"("phoneNumber");
CREATE INDEX IF NOT EXISTS "idx_contacts_phone_lower" ON "contacts"(lower("phoneNumber"));

-- ============================================================================
-- TABELAS COM DEPENDÊNCIAS
-- ============================================================================

-- USER ROLES
CREATE TABLE IF NOT EXISTS "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");
CREATE INDEX IF NOT EXISTS "user_roles_userId_idx" ON "user_roles"("userId");
CREATE INDEX IF NOT EXISTS "user_roles_roleId_idx" ON "user_roles"("roleId");

-- ROLE PERMISSIONS
CREATE TABLE IF NOT EXISTS "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");
CREATE INDEX IF NOT EXISTS "role_permissions_roleId_idx" ON "role_permissions"("roleId");
CREATE INDEX IF NOT EXISTS "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- REFRESH TOKENS
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE INDEX IF NOT EXISTS "refresh_tokens_token_idx" ON "refresh_tokens"("token");
CREATE INDEX IF NOT EXISTS "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
CREATE INDEX IF NOT EXISTS "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- USER SESSIONS
CREATE TABLE IF NOT EXISTS "user_sessions" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "user_id" TEXT NOT NULL,
    "csrf_token" TEXT,
    "fingerprint" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "expires_at" TIMESTAMPTZ,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "last_failed_at" TIMESTAMPTZ,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_user_id_key" ON "user_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "user_sessions_fingerprint_idx" ON "user_sessions"("fingerprint");

-- USER DEPARTMENT ACCESS
CREATE TABLE IF NOT EXISTS "user_department_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_department_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_department_access_userId_departmentId_key" ON "user_department_access"("userId", "departmentId");
CREATE INDEX IF NOT EXISTS "user_department_access_userId_idx" ON "user_department_access"("userId");
CREATE INDEX IF NOT EXISTS "user_department_access_departmentId_idx" ON "user_department_access"("departmentId");

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS "conversations" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "departmentId" TEXT,
    "assignedUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "lastMessageAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstResponseAt" TIMESTAMP,
    "resolvedAt" TIMESTAMP,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "internalNotes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "isMonitored" BOOLEAN NOT NULL DEFAULT false,
    "monitoredBy" TEXT,
    "kanbanStageId" TEXT,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "conversations_contactId_idx" ON "conversations"("contactId");
CREATE INDEX IF NOT EXISTS "conversations_connectionId_idx" ON "conversations"("connectionId");
CREATE INDEX IF NOT EXISTS "conversations_departmentId_idx" ON "conversations"("departmentId");
CREATE INDEX IF NOT EXISTS "conversations_assignedUserId_idx" ON "conversations"("assignedUserId");
CREATE INDEX IF NOT EXISTS "conversations_status_idx" ON "conversations"("status");
CREATE INDEX IF NOT EXISTS "conversations_lastMessageAt_idx" ON "conversations"("lastMessageAt");
CREATE INDEX IF NOT EXISTS "conversations_kanbanStageId_idx" ON "conversations"("kanbanStageId");
CREATE INDEX IF NOT EXISTS "conversations_isMonitored_idx" ON "conversations"("isMonitored");
CREATE INDEX IF NOT EXISTS "conversations_status_lastMessageAt_idx" ON "conversations"("status", "lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS "conversations_assignedUserId_lastMessageAt_idx" ON "conversations"("assignedUserId", "lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS "conversations_assignedUserId_status_idx" ON "conversations"("assignedUserId", "status");
CREATE INDEX IF NOT EXISTS "conversations_connectionId_status_idx" ON "conversations"("connectionId", "status");
CREATE INDEX IF NOT EXISTS "idx_conversations_assigned_status" ON "conversations"("assignedUserId", "status");
CREATE INDEX IF NOT EXISTS "idx_conversations_connection_status" ON "conversations"("connectionId", "status");
CREATE INDEX IF NOT EXISTS "idx_conversations_department_status" ON "conversations"("departmentId", "status");
CREATE INDEX IF NOT EXISTS "idx_conversations_status_lastmessage" ON "conversations"("status", "lastMessageAt" DESC);

-- MESSAGES
CREATE TABLE IF NOT EXISTS "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "senderId" TEXT,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "mediaUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "isFromContact" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalId" TEXT,
    "quotedMessageId" TEXT,
    "senderName" TEXT,
    "topic" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "payload" JSONB,
    "event" TEXT,
    "private" BOOLEAN DEFAULT false,
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    "inserted_at" TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "messages_conversationId_externalId_key" ON "messages"("conversationId", "externalId");
CREATE INDEX IF NOT EXISTS "messages_conversationId_idx" ON "messages"("conversationId");
CREATE INDEX IF NOT EXISTS "messages_connectionId_idx" ON "messages"("connectionId");
CREATE INDEX IF NOT EXISTS "messages_senderId_idx" ON "messages"("senderId");
CREATE INDEX IF NOT EXISTS "messages_timestamp_idx" ON "messages"("timestamp");
CREATE INDEX IF NOT EXISTS "messages_externalId_idx" ON "messages"("externalId");
CREATE INDEX IF NOT EXISTS "messages_quotedMessageId_idx" ON "messages"("quotedMessageId");
CREATE INDEX IF NOT EXISTS "messages_isFromContact_idx" ON "messages"("isFromContact");
CREATE INDEX IF NOT EXISTS "messages_conversationId_timestamp_idx" ON "messages"("conversationId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "messages_connectionId_timestamp_idx" ON "messages"("connectionId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "messages_senderId_timestamp_idx" ON "messages"("senderId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_messages_conversation_timestamp" ON "messages"("conversationId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_messages_connection_timestamp" ON "messages"("connectionId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_messages_status_timestamp" ON "messages"("status", "timestamp" DESC);

-- ATTACHMENTS
CREATE TABLE IF NOT EXISTS "attachments" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attachments_conversationId_idx" ON "attachments"("conversationId");

-- CONVERSATION TAGS
CREATE TABLE IF NOT EXISTS "conversation_tags" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_tags_conversationId_tagId_key" ON "conversation_tags"("conversationId", "tagId");
CREATE INDEX IF NOT EXISTS "conversation_tags_conversationId_idx" ON "conversation_tags"("conversationId");
CREATE INDEX IF NOT EXISTS "conversation_tags_tagId_idx" ON "conversation_tags"("tagId");
CREATE INDEX IF NOT EXISTS "idx_conversation_tags_tag_conversation" ON "conversation_tags"("tagId", "conversationId");

-- CONVERSATION TRANSFERS
CREATE TABLE IF NOT EXISTS "conversation_transfers" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT,
    "toDepartmentId" TEXT,
    "reason" VARCHAR(200),
    "transferredAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_transfers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "conversation_transfers_conversationId_idx" ON "conversation_transfers"("conversationId");
CREATE INDEX IF NOT EXISTS "conversation_transfers_fromUserId_idx" ON "conversation_transfers"("fromUserId");
CREATE INDEX IF NOT EXISTS "conversation_transfers_toUserId_idx" ON "conversation_transfers"("toUserId");
CREATE INDEX IF NOT EXISTS "conversation_transfers_toDepartmentId_idx" ON "conversation_transfers"("toDepartmentId");
CREATE INDEX IF NOT EXISTS "conversation_transfers_transferredAt_idx" ON "conversation_transfers"("transferredAt");

-- CONVERSATION HISTORY
CREATE TABLE IF NOT EXISTS "conversation_history" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "toStageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "conversation_history_conversationId_idx" ON "conversation_history"("conversationId");
CREATE INDEX IF NOT EXISTS "conversation_history_createdAt_idx" ON "conversation_history"("createdAt");

-- CONVERSATION METRICS
CREATE TABLE IF NOT EXISTS "conversation_metrics" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "firstResponseTime" INTEGER,
    "resolutionTime" INTEGER,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "transferCount" INTEGER NOT NULL DEFAULT 0,
    "satisfactionRating" INTEGER,
    "satisfactionComment" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "conversation_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_metrics_conversationId_key" ON "conversation_metrics"("conversationId");
CREATE INDEX IF NOT EXISTS "conversation_metrics_firstResponseTime_idx" ON "conversation_metrics"("firstResponseTime");
CREATE INDEX IF NOT EXISTS "conversation_metrics_resolutionTime_idx" ON "conversation_metrics"("resolutionTime");
CREATE INDEX IF NOT EXISTS "conversation_metrics_satisfactionRating_idx" ON "conversation_metrics"("satisfactionRating");

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX IF NOT EXISTS "notifications_isRead_idx" ON "notifications"("isRead");
CREATE INDEX IF NOT EXISTS "notifications_createdAt_idx" ON "notifications"("createdAt");
CREATE INDEX IF NOT EXISTS "idx_notifications_user_read" ON "notifications"("userId", "isRead", "createdAt" DESC);

-- NOTIFICATION PREFERENCES
CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "desktopEnabled" BOOLEAN NOT NULL DEFAULT true,
    "newMessageSound" BOOLEAN NOT NULL DEFAULT true,
    "transferSound" BOOLEAN NOT NULL DEFAULT true,
    "mentionSound" BOOLEAN NOT NULL DEFAULT true,
    "silentHoursStart" TEXT,
    "silentHoursEnd" TEXT,
    "notifyOnlyDepartments" TEXT[],
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx" ON "audit_logs"("resource");
CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_timestamp_action" ON "audit_logs"("timestamp" DESC, "action");

-- QUICK MESSAGES
CREATE TABLE IF NOT EXISTS "quick_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "quick_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quick_messages_userId_idx" ON "quick_messages"("userId");
CREATE INDEX IF NOT EXISTS "quick_messages_category_idx" ON "quick_messages"("category");

-- MESSAGE TEMPLATES
CREATE TABLE IF NOT EXISTS "message_templates" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "shortcut" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "message_templates_departmentId_idx" ON "message_templates"("departmentId");
CREATE INDEX IF NOT EXISTS "message_templates_shortcut_idx" ON "message_templates"("shortcut");

-- CONTACT LISTS
CREATE TABLE IF NOT EXISTS "contact_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "contact_lists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contact_lists_userId_idx" ON "contact_lists"("userId");

-- LIST CONTACTS
CREATE TABLE IF NOT EXISTS "list_contacts" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "list_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "list_contacts_listId_idx" ON "list_contacts"("listId");
CREATE INDEX IF NOT EXISTS "list_contacts_phone_idx" ON "list_contacts"("phone");

-- BROADCASTS
CREATE TABLE IF NOT EXISTS "broadcasts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP,
    "completedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "privacyPolicyUrl" TEXT,
    "durationSeconds" INTEGER,
    "messagesPerMinute" DOUBLE PRECISION,
    "successRate" DOUBLE PRECISION,
    "lastSentAt" TIMESTAMP,
    "minIntervalUsed" INTEGER,
    "maxIntervalUsed" INTEGER,
    "listName" TEXT,
    "connectionName" TEXT,
    "connectionPhone" TEXT,
    "repliedCount" INTEGER NOT NULL DEFAULT 0,
    "notRepliedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "broadcasts_userId_idx" ON "broadcasts"("userId");
CREATE INDEX IF NOT EXISTS "broadcasts_connectionId_idx" ON "broadcasts"("connectionId");
CREATE INDEX IF NOT EXISTS "broadcasts_listId_idx" ON "broadcasts"("listId");
CREATE INDEX IF NOT EXISTS "broadcasts_status_idx" ON "broadcasts"("status");
CREATE INDEX IF NOT EXISTS "broadcasts_createdAt_idx" ON "broadcasts"("createdAt");
CREATE INDEX IF NOT EXISTS "idx_broadcasts_started_at" ON "broadcasts"("startedAt") WHERE "startedAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_broadcasts_completed_at" ON "broadcasts"("completedAt") WHERE "completedAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_broadcasts_last_sent_at" ON "broadcasts"("lastSentAt") WHERE "lastSentAt" IS NOT NULL;

-- BROADCAST LOGS
CREATE TABLE IF NOT EXISTS "broadcast_logs" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phoneNumber" TEXT,
    "contactName" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "deliveredAt" TIMESTAMP,
    "readAt" TIMESTAMP,
    "uniqueId" TEXT,
    "hasReplied" BOOLEAN NOT NULL DEFAULT false,
    "repliedAt" TIMESTAMP,

    CONSTRAINT "broadcast_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "broadcast_logs_broadcastId_idx" ON "broadcast_logs"("broadcastId");
CREATE INDEX IF NOT EXISTS "broadcast_logs_contactId_idx" ON "broadcast_logs"("contactId");
CREATE INDEX IF NOT EXISTS "broadcast_logs_status_idx" ON "broadcast_logs"("status");
CREATE INDEX IF NOT EXISTS "idx_broadcast_logs_sent_at" ON "broadcast_logs"("sentAt") WHERE "sentAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_broadcast_logs_delivered_at" ON "broadcast_logs"("deliveredAt") WHERE "deliveredAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_broadcast_logs_read_at" ON "broadcast_logs"("readAt") WHERE "readAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_broadcast_logs_replied_at" ON "broadcast_logs"("repliedAt") WHERE "repliedAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_broadcast_logs_has_replied" ON "broadcast_logs"("hasReplied") WHERE "hasReplied" = false;
CREATE INDEX IF NOT EXISTS "idx_broadcast_logs_phone_number" ON "broadcast_logs"("phoneNumber") WHERE "phoneNumber" IS NOT NULL;

-- BROADCAST CONFIGS
CREATE TABLE IF NOT EXISTS "broadcast_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "minInterval" INTEGER NOT NULL DEFAULT 5,
    "maxInterval" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "broadcast_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "broadcast_configs_userId_key" ON "broadcast_configs"("userId");

-- ============================================================================
-- FOREIGN KEYS (RELACIONAMENTOS)
-- ============================================================================

-- User Roles
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" 
    FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE;

-- Role Permissions
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" 
    FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE;

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" 
    FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE;

-- Refresh Tokens
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

-- User Sessions
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- User Department Access
ALTER TABLE "user_department_access" ADD CONSTRAINT "user_department_access_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "user_department_access" ADD CONSTRAINT "user_department_access_departmentId_fkey" 
    FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE;

-- WhatsApp Connections
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_aiAssistantId_fkey" 
    FOREIGN KEY ("aiAssistantId") REFERENCES "ai_assistants"("id") ON DELETE SET NULL;

-- Conversations
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contactId_fkey" 
    FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_connectionId_fkey" 
    FOREIGN KEY ("connectionId") REFERENCES "whatsapp_connections"("id") ON DELETE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_departmentId_fkey" 
    FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assignedUserId_fkey" 
    FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_kanbanStageId_fkey" 
    FOREIGN KEY ("kanbanStageId") REFERENCES "kanban_stages"("id") ON DELETE SET NULL;

-- Messages
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" 
    FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_connectionId_fkey" 
    FOREIGN KEY ("connectionId") REFERENCES "whatsapp_connections"("id") ON DELETE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" 
    FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "messages" ADD CONSTRAINT "messages_quotedmessageid_fkey" 
    FOREIGN KEY ("quotedMessageId") REFERENCES "messages"("id") ON DELETE SET NULL;

-- Attachments
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_conversationId_fkey" 
    FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE;

-- Conversation Tags
ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_conversationId_fkey" 
    FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE;

ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_tagId_fkey" 
    FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE;

-- Conversation Transfers
ALTER TABLE "conversation_transfers" ADD CONSTRAINT "conversation_transfers_conversationId_fkey" 
    FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE;

ALTER TABLE "conversation_transfers" ADD CONSTRAINT "conversation_transfers_fromUserId_fkey" 
    FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "conversation_transfers" ADD CONSTRAINT "conversation_transfers_toUserId_fkey" 
    FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "conversation_transfers" ADD CONSTRAINT "conversation_transfers_toDepartmentId_fkey" 
    FOREIGN KEY ("toDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL;

-- Conversation History
ALTER TABLE "conversation_history" ADD CONSTRAINT "conversation_history_conversationId_fkey" 
    FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE;

ALTER TABLE "conversation_history" ADD CONSTRAINT "conversation_history_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

-- Notifications
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

-- Notification Preferences
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

-- Audit Logs
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;

-- Quick Messages
ALTER TABLE "quick_messages" ADD CONSTRAINT "quick_messages_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

-- Message Templates
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_departmentId_fkey" 
    FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL;

-- List Contacts
ALTER TABLE "list_contacts" ADD CONSTRAINT "list_contacts_listId_fkey" 
    FOREIGN KEY ("listId") REFERENCES "contact_lists"("id") ON DELETE CASCADE;

-- Broadcasts
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_listId_fkey" 
    FOREIGN KEY ("listId") REFERENCES "contact_lists"("id") ON DELETE CASCADE;

-- Broadcast Logs
ALTER TABLE "broadcast_logs" ADD CONSTRAINT "broadcast_logs_broadcastId_fkey" 
    FOREIGN KEY ("broadcastId") REFERENCES "broadcasts"("id") ON DELETE CASCADE;

ALTER TABLE "broadcast_logs" ADD CONSTRAINT "broadcast_logs_contactId_fkey" 
    FOREIGN KEY ("contactId") REFERENCES "list_contacts"("id") ON DELETE CASCADE;

-- ============================================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON TABLE "user_roles" IS 'Cada usuário deve ter APENAS UMA role. A aplicação garante isso removendo outras roles antes de adicionar uma nova.';

-- ============================================================================
-- COMMIT
-- ============================================================================

COMMIT;

-- ============================================================================
-- PRÓXIMOS PASSOS:
-- ============================================================================
-- 1. Execute o seed do banco para criar roles e permissões iniciais
-- 2. Crie um usuário admin inicial
-- 3. Configure as conexões WhatsApp
-- 4. Configure os departamentos e estágios do Kanban
-- ============================================================================

