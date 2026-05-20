-- File: composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "File_userId_folderId_isDeleted_idx" ON "File"("userId", "folderId", "isDeleted");
CREATE INDEX IF NOT EXISTS "File_userId_isDeleted_updatedAt_idx" ON "File"("userId", "isDeleted", "updatedAt");
CREATE INDEX IF NOT EXISTS "File_userId_isDeleted_deletedAt_idx" ON "File"("userId", "isDeleted", "deletedAt");
CREATE INDEX IF NOT EXISTS "File_userId_isDeleted_isFavorite_idx" ON "File"("userId", "isDeleted", "isFavorite");

-- Folder: tree navigation and trash
CREATE INDEX IF NOT EXISTS "Folder_userId_parentId_idx" ON "Folder"("userId", "parentId");
CREATE INDEX IF NOT EXISTS "Folder_userId_isDeleted_idx" ON "Folder"("userId", "isDeleted");

-- AuditLog: paginated user history
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- Notification: unread count per user
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");
