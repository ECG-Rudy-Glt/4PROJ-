-- Add an optional checksum for desktop sync clients.
ALTER TABLE "File" ADD COLUMN "checksum" TEXT;

CREATE INDEX "File_checksum_idx" ON "File"("checksum");
