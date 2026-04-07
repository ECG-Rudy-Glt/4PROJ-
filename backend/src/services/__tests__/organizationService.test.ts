import { OrganizationMemberRole } from '@prisma/client';
import prisma from '../../config/database';
import { OrganizationService } from '../organizationService';
import { AuditService } from '../auditService';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    organizationMember: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('../auditService', () => ({
  AuditService: {
    createLog: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('OrganizationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addMember', () => {
    it('should block ADMIN from assigning OWNER role', async () => {
      (prisma.organizationMember.findUnique as jest.Mock).mockResolvedValue({
        id: 'membership-1',
        organizationId: 'org-1',
        userId: 'admin-user',
        role: OrganizationMemberRole.ADMIN,
      });

      await expect(
        OrganizationService.addMember('admin-user', 'org-1', 'target@example.com', OrganizationMemberRole.OWNER)
      ).rejects.toThrow('Seul un propriétaire peut attribuer le rôle OWNER');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.organizationMember.create).not.toHaveBeenCalled();
      expect(AuditService.createLog).not.toHaveBeenCalled();
    });

    it('should allow OWNER to assign OWNER role', async () => {
      (prisma.organizationMember.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'membership-owner',
          organizationId: 'org-1',
          userId: 'owner-user',
          role: OrganizationMemberRole.OWNER,
        })
        .mockResolvedValueOnce(null);

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'target-user',
        email: 'target@example.com',
      });
      (prisma.organizationMember.create as jest.Mock).mockResolvedValue({
        id: 'member-2',
        organizationId: 'org-1',
        userId: 'target-user',
        role: OrganizationMemberRole.OWNER,
        user: {
          id: 'target-user',
          email: 'target@example.com',
        },
      });

      const result = await OrganizationService.addMember(
        'owner-user',
        'org-1',
        'target@example.com',
        OrganizationMemberRole.OWNER
      );

      expect(prisma.organizationMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            userId: 'target-user',
            role: OrganizationMemberRole.OWNER,
          }),
        })
      );
      expect(result.role).toBe(OrganizationMemberRole.OWNER);
      expect(AuditService.createLog).toHaveBeenCalledWith(
        'owner-user',
        'ORG_MEMBER_ADD',
        expect.objectContaining({
          organizationId: 'org-1',
          memberUserId: 'target-user',
          memberRole: OrganizationMemberRole.OWNER,
        })
      );
    });
  });

  describe('updateMemberRole', () => {
    it('should block ADMIN from promoting a member to OWNER', async () => {
      (prisma.organizationMember.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'membership-admin',
          organizationId: 'org-1',
          userId: 'admin-user',
          role: OrganizationMemberRole.ADMIN,
        })
        .mockResolvedValueOnce({
          id: 'member-target',
          organizationId: 'org-1',
          userId: 'target-user',
          role: OrganizationMemberRole.MEMBER,
        });

      await expect(
        OrganizationService.updateMemberRole(
          'admin-user',
          'org-1',
          'member-target',
          OrganizationMemberRole.OWNER
        )
      ).rejects.toThrow('Seul un propriétaire peut attribuer le rôle OWNER');

      expect(prisma.organizationMember.update).not.toHaveBeenCalled();
    });

    it('should prevent demoting the last OWNER', async () => {
      (prisma.organizationMember.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'membership-owner',
          organizationId: 'org-1',
          userId: 'owner-user',
          role: OrganizationMemberRole.OWNER,
        })
        .mockResolvedValueOnce({
          id: 'member-owner',
          organizationId: 'org-1',
          userId: 'owner-user',
          role: OrganizationMemberRole.OWNER,
        });

      (prisma.organizationMember.count as jest.Mock).mockResolvedValue(1);

      await expect(
        OrganizationService.updateMemberRole(
          'owner-user',
          'org-1',
          'member-owner',
          OrganizationMemberRole.ADMIN
        )
      ).rejects.toThrow('L’organisation doit conserver au moins un propriétaire');

      expect(prisma.organizationMember.update).not.toHaveBeenCalled();
    });
  });
});

