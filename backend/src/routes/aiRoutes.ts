import { Router } from 'express';
import { AIController } from '../controllers/aiController';
import { authenticate } from '../middlewares/auth';
import { requireDelegationPermission } from '../middlewares/delegation';
import { requirePlanFeature } from '../middlewares/planFeature';

const router = Router();

router.use(authenticate);

router.post('/chat', requireDelegationPermission('read'), requirePlanFeature('aiChat'), AIController.chat);
router.post('/analyze-file', requireDelegationPermission('read'), requirePlanFeature('aiChat'), AIController.analyzeFile);
router.post('/search-files', requireDelegationPermission('read'), requirePlanFeature('aiChat'), AIController.searchFiles);
router.post('/generate-file', requireDelegationPermission('write'), requirePlanFeature('aiChat'), AIController.generateFile);
router.post('/reindex', requireDelegationPermission('write'), requirePlanFeature('aiChat'), AIController.reindexFiles);

router.get('/conversations', requireDelegationPermission('read'), requirePlanFeature('aiChat'), AIController.getConversations);
router.get('/conversations/:id', requireDelegationPermission('read'), requirePlanFeature('aiChat'), AIController.getConversation);
router.delete('/conversations/:id', requireDelegationPermission('delete'), requirePlanFeature('aiChat'), AIController.deleteConversation);

export default router;
