import express from 'express';
import { authenticate } from '../middlewares/auth';
import { CommentController } from '../controllers/commentController';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Routes pour les commentaires d'un fichier
router.post('/files/:fileId/comments', CommentController.createComment);
router.get('/files/:fileId/comments', CommentController.getFileComments);
router.get('/files/:fileId/comments/count', CommentController.countFileComments);

// Routes pour un commentaire spécifique
router.put('/comments/:commentId', CommentController.updateComment);
router.delete('/comments/:commentId', CommentController.deleteComment);

export default router;
