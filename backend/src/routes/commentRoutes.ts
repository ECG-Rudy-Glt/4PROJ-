import express from 'express';
import { authenticate } from '../middlewares/auth';
import { CommentController } from '../controllers/commentController';
import { requireDelegationPermission } from '../middlewares/delegation';

const router = express.Router();

router.use(authenticate);

import { verifyDirectSharePassword, verifyDirectSharePasswordFor } from '../middlewares/sharePasswordMiddleware';

router.post('/files/:fileId/comments', requireDelegationPermission('write'), verifyDirectSharePasswordFor('write'), CommentController.createComment);
router.get('/files/:fileId/comments', requireDelegationPermission('read'), verifyDirectSharePassword, CommentController.getFileComments);
router.get('/files/:fileId/comments/count', requireDelegationPermission('read'), verifyDirectSharePassword, CommentController.countFileComments);

router.put('/comments/:commentId', requireDelegationPermission('write'), CommentController.updateComment);
router.delete('/comments/:commentId', requireDelegationPermission('delete'), CommentController.deleteComment);

export default router;
