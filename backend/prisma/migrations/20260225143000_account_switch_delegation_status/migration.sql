-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DelegationStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "AccountSwitchLink" (
    "id" TEXT NOT NULL,
    "rootUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastAuthenticatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountSwitchLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delegation" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "delegateUserId" TEXT NOT NULL,
    "status" "DelegationStatus" NOT NULL DEFAULT 'ACTIVE',
    "canRead" BOOLEAN NOT NULL DEFAULT true,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canShare" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountSwitchLink_rootUserId_revokedAt_expiresAt_idx" ON "AccountSwitchLink"("rootUserId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "AccountSwitchLink_targetUserId_idx" ON "AccountSwitchLink"("targetUserId");

-- CreateIndex
CREATE INDEX "Delegation_ownerUserId_status_revokedAt_expiresAt_idx" ON "Delegation"("ownerUserId", "status", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "Delegation_delegateUserId_status_revokedAt_expiresAt_idx" ON "Delegation"("delegateUserId", "status", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "Delegation_ownerUserId_delegateUserId_idx" ON "Delegation"("ownerUserId", "delegateUserId");

-- AddForeignKey
ALTER TABLE "AccountSwitchLink" ADD CONSTRAINT "AccountSwitchLink_rootUserId_fkey" FOREIGN KEY ("rootUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSwitchLink" ADD CONSTRAINT "AccountSwitchLink_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_delegateUserId_fkey" FOREIGN KEY ("delegateUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
