import express from 'express';
import { authenticate } from '../middlewares/auth';
import { CommentController } from '../controllers/commentController';
import { requireDelegationPermission } from '../middlewares/delegation';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

import { verifyDirectSharePassword } from '../middlewares/sharePasswordMiddleware';

// Routes pour les commentaires d'un fichier
router.post('/files/:fileId/comments', requireDelegationPermission('write'), verifyDirectSharePassword, CommentController.createComment);
router.get('/files/:fileId/comments', requireDelegationPermission('read'), verifyDirectSharePassword, CommentController.getFileComments);
router.get('/files/:fileId/comments/count', requireDelegationPermission('read'), verifyDirectSharePassword, CommentController.countFileComments);

// Routes pour un commentaire spécifique
router.put('/comments/:commentId', requireDelegationPermission('write'), CommentController.updateComment);
router.delete('/comments/:commentId', requireDelegationPermission('delete'), CommentController.deleteComment);

export default router;
