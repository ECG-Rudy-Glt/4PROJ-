import { OrganizationMemberRole } from '@prisma/client';
import prisma from '../config/database';
import { AuditService } from './auditService';

const ROLE_WEIGHT: Record<OrganizationMemberRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export class OrganizationService {
  private static normalizeSlug(name: string) {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || `org-${Date.now()}`;
  }

  private static async ensureMembership(userId: string, organizationId: string) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new Error('Accès organisation refusé');
    }

    return membership;
  }

  private static assertRoleAtLeast(role: OrganizationMemberRole, expected: OrganizationMemberRole) {
    if (ROLE_WEIGHT[role] < ROLE_WEIGHT[expected]) {
      throw new Error('Permissions insuffisantes');
    }
  }

  static async listMyOrganizations(userId: string) {
    return await prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true,
      },
      orderBy: {
        organization: {
          createdAt: 'desc',
        },
      },
    });
  }

  static async createOrganization(userId: string, name: string) {
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      throw new Error('Nom organisation requis');
    }

    let slugBase = this.normalizeSlug(trimmedName);
    let slug = slugBase;
    let suffix = 1;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${slugBase}-${suffix}`;
    }

    const organization = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: trimmedName,
          slug,
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: created.id,
          userId,
          role: OrganizationMemberRole.OWNER,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { currentOrganizationId: created.id },
      });

      return created;
    });

    await AuditService.createLog(userId, 'ORG_CREATE', {
      organizationId: organization.id,
      organizationName: organization.name,
    });

    return organization;
  }

  static async getOrganization(organizationId: string, userId: string) {
    const membership = await this.ensureMembership(userId, organizationId);
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
                lastActiveAt: true,
                createdAt: true,
              },
            },
          },
          orderBy: [
            { role: 'desc' },
            { createdAt: 'asc' },
          ],
        },
      },
    });

    return { organization, membershipRole: membership.role };
  }

  static async addMember(
    actorId: string,
    organizationId: string,
    targetEmail: string,
    role: OrganizationMemberRole = OrganizationMemberRole.MEMBER
  ) {
    const actorMembership = await this.ensureMembership(actorId, organizationId);
    this.assertRoleAtLeast(actorMembership.role, OrganizationMemberRole.ADMIN);

    const user = await prisma.user.findUnique({
      where: { email: targetEmail.toLowerCase().trim() },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new Error('Utilisateur cible introuvable');
    }

    const existing = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
    });
    if (existing) {
      throw new Error('Utilisateur déjà membre');
    }

    const member = await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: user.id,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            lastActiveAt: true,
            createdAt: true,
          },
        },
      },
    });

    await AuditService.createLog(actorId, 'ORG_MEMBER_ADD', {
      organizationId,
      memberUserId: user.id,
      memberRole: role,
    });

    return member;
  }

  static async updateMemberRole(
    actorId: string,
    organizationId: string,
    memberId: string,
    role: OrganizationMemberRole
  ) {
    const actorMembership = await this.ensureMembership(actorId, organizationId);
    this.assertRoleAtLeast(actorMembership.role, OrganizationMemberRole.ADMIN);

    const targetMember = await prisma.organizationMember.findUnique({
      where: { id: memberId },
    });
    if (!targetMember || targetMember.organizationId !== organizationId) {
      throw new Error('Membre introuvable');
    }

    if (targetMember.role === OrganizationMemberRole.OWNER && actorMembership.role !== OrganizationMemberRole.OWNER) {
      throw new Error('Seul le propriétaire peut modifier un propriétaire');
    }

    const updated = await prisma.organizationMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            lastActiveAt: true,
            createdAt: true,
          },
        },
      },
    });

    await AuditService.createLog(actorId, 'ORG_MEMBER_ROLE_UPDATE', {
      organizationId,
      memberId,
      role,
    });

    return updated;
  }

  static async removeMember(actorId: string, organizationId: string, memberId: string) {
    const actorMembership = await this.ensureMembership(actorId, organizationId);
    this.assertRoleAtLeast(actorMembership.role, OrganizationMemberRole.ADMIN);

    const targetMember = await prisma.organizationMember.findUnique({
      where: { id: memberId },
    });
    if (!targetMember || targetMember.organizationId !== organizationId) {
      throw new Error('Membre introuvable');
    }

    if (targetMember.role === OrganizationMemberRole.OWNER) {
      throw new Error('Le propriétaire ne peut pas être supprimé');
    }

    await prisma.organizationMember.delete({
      where: { id: memberId },
    });

    await prisma.user.updateMany({
      where: {
        id: targetMember.userId,
        currentOrganizationId: organizationId,
      },
      data: {
        currentOrganizationId: null,
      },
    });

    await AuditService.createLog(actorId, 'ORG_MEMBER_REMOVE', {
      organizationId,
      memberId,
      removedUserId: targetMember.userId,
    });

    return { message: 'Membre supprimé' };
  }

  static async switchCurrentOrganization(userId: string, organizationId: string) {
    await this.ensureMembership(userId, organizationId);
    await prisma.user.update({
      where: { id: userId },
      data: { currentOrganizationId: organizationId },
    });

    await AuditService.createLog(userId, 'ORG_SWITCH', { organizationId });
    return { organizationId };
  }
}
