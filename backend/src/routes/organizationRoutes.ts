import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { OrganizationController } from '../controllers/organizationController';

const router = Router();

router.use(authenticate);

router.get('/mine', OrganizationController.listMine);
router.post('/', OrganizationController.create);
router.get('/:orgId', OrganizationController.getById);
router.post('/:orgId/members', OrganizationController.addMember);
router.patch('/:orgId/members/:memberId', OrganizationController.updateMemberRole);
router.delete('/:orgId/members/:memberId', OrganizationController.removeMember);
router.post('/:orgId/switch', OrganizationController.switchCurrent);

export default router;
