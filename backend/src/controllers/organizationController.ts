import { Response, NextFunction } from 'express';
import { OrganizationMemberRole } from '@prisma/client';
import { AuthRequest } from '../types';
import { OrganizationService } from '../services/organizationService';

const VALID_ROLES = new Set<OrganizationMemberRole>([
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.MEMBER,
]);

export class OrganizationController {
  static async listMine(req: AuthRequest, res: Response) {
    try {
      const organizations = await OrganizationService.listMyOrganizations(req.user!.id);
      res.status(200).json({ organizations });
    } catch (error) { next(error); }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const { name } = req.body;
      const organization = await OrganizationService.createOrganization(req.user!.id, String(name || ''));
      res.status(201).json({ organization });
    } catch (error) { next(error); }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const { orgId } = req.params;
      const data = await OrganizationService.getOrganization(orgId, req.user!.id);
      res.status(200).json(data);
    } catch (error) { next(error); }
  }

  static async addMember(req: AuthRequest, res: Response) {
    try {
      const { orgId } = req.params;
      const { email, role } = req.body;
      const normalizedRole = typeof role === 'string' ? role.toUpperCase() as OrganizationMemberRole : OrganizationMemberRole.MEMBER;
      if (!VALID_ROLES.has(normalizedRole)) {
        res.status(400).json({ error: 'Rôle invalide' });
        return;
      }

      const member = await OrganizationService.addMember(
        req.user!.id,
        orgId,
        String(email || ''),
        normalizedRole
      );

      res.status(201).json({ member });
    } catch (error) { next(error); }
  }

  static async updateMemberRole(req: AuthRequest, res: Response) {
    try {
      const { orgId, memberId } = req.params;
      const role = typeof req.body.role === 'string' ? req.body.role.toUpperCase() as OrganizationMemberRole : null;
      if (!role || !VALID_ROLES.has(role)) {
        res.status(400).json({ error: 'Rôle invalide' });
        return;
      }

      const member = await OrganizationService.updateMemberRole(req.user!.id, orgId, memberId, role);
      res.status(200).json({ member });
    } catch (error) { next(error); }
  }

  static async removeMember(req: AuthRequest, res: Response) {
    try {
      const { orgId, memberId } = req.params;
      const result = await OrganizationService.removeMember(req.user!.id, orgId, memberId);
      res.status(200).json(result);
    } catch (error) { next(error); }
  }

  static async switchCurrent(req: AuthRequest, res: Response) {
    try {
      const { orgId } = req.params;
      const result = await OrganizationService.switchCurrentOrganization(req.user!.id, orgId);
      res.status(200).json(result);
    } catch (error) { next(error); }
  }
}
