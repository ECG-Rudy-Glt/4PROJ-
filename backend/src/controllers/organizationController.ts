import { Response, NextFunction } from 'express';
import { OrganizationMemberRole } from '@prisma/client';
import { AuthRequest } from '../types';
import { OrganizationService } from '../services/organizationService';
import { sendSuccess, sendCreated, sendError } from '../utils/response';

const VALID_ROLES = new Set<OrganizationMemberRole>([
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.MEMBER,
]);

export class OrganizationController {
  static async listMine(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizations = await OrganizationService.listMyOrganizations(req.user!.id);
      sendSuccess(res, { organizations });
    } catch (error) { next(error); }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name } = req.body;
      const organization = await OrganizationService.createOrganization(req.user!.id, String(name || ''));
      sendCreated(res, { organization });
    } catch (error) { next(error); }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { orgId } = req.params;
      const data = await OrganizationService.getOrganization(orgId, req.user!.id);
      sendSuccess(res, data);
    } catch (error) { next(error); }
  }

  static async addMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { orgId } = req.params;
      const { email, role } = req.body;
      const normalizedRole = typeof role === 'string' ? role.toUpperCase() as OrganizationMemberRole : OrganizationMemberRole.MEMBER;
      if (!VALID_ROLES.has(normalizedRole)) {
        sendError(res, 'Rôle invalide', 400);
        return;
      }

      const member = await OrganizationService.addMember(
        req.user!.id,
        orgId,
        String(email || ''),
        normalizedRole
      );

      sendCreated(res, { member });
    } catch (error) { next(error); }
  }

  static async updateMemberRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { orgId, memberId } = req.params;
      const role = typeof req.body.role === 'string' ? req.body.role.toUpperCase() as OrganizationMemberRole : null;
      if (!role || !VALID_ROLES.has(role)) {
        sendError(res, 'Rôle invalide', 400);
        return;
      }

      const member = await OrganizationService.updateMemberRole(req.user!.id, orgId, memberId, role);
      sendSuccess(res, { member });
    } catch (error) { next(error); }
  }

  static async removeMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { orgId, memberId } = req.params;
      const result = await OrganizationService.removeMember(req.user!.id, orgId, memberId);
      sendSuccess(res, result);
    } catch (error) { next(error); }
  }

  static async switchCurrent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { orgId } = req.params;
      const result = await OrganizationService.switchCurrentOrganization(req.user!.id, orgId);
      sendSuccess(res, result);
    } catch (error) { next(error); }
  }
}
