import { useState, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { commentService, Comment } from '@/services/commentService';
import { MessageCircle, Send, Edit2, Trash2, Reply } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTranslation } from 'react-i18next';

interface CommentsPanelProps {
  fileId: string;
  onCommentCountChange?: () => void;
  isShared?: boolean;
  canWrite?: boolean;
}

export default function CommentsPanel({ fileId, onCommentCountChange, isShared = false, canWrite = true }: CommentsPanelProps) {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [hasError, setHasError] = useState(false);

  const socket = useSocket(); // Added socket initialization

  useEffect(() => {
    loadComments();

    if (socket && fileId) {
      socket.emit('join_file', fileId);

      const handleNewComment = (newComment: Comment) => {
        // Ajouter le commentaire seulement s'il n'est pas déjà présent (évite doublons)
        setComments(prev => {
          if (prev.some(c => c.id === newComment.id)) return prev;
          // Si c'est une réponse
          if (newComment.parentId) {
            return prev.map(c => {
              if (c.id === newComment.parentId) {
                return { ...c, replies: [...(c.replies || []), newComment] };
              }
              return c;
            });
          }
          // Si c'est un commentaire racine
          return [newComment, ...prev];
        });

        // Mettre à jour le compteur
        if (onCommentCountChange) {
          onCommentCountChange(); // Idéalement on passerait le nouveau count, mais un refresh simple suffit
        }
      };

      socket.on('comment_added', handleNewComment);

      return () => {
        socket.emit('leave_file', fileId);
        socket.off('comment_added', handleNewComment);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, socket]); // Added socket to dependency array

  const loadComments = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const { comments: data } = await commentService.getFileComments(fileId); // Changed to data
      setComments(data); // Changed to data
      if (onCommentCountChange) {
        onCommentCountChange();
      }
    } catch (error: any) {
      console.error('Erreur chargement commentaires:', error);
      setHasError(true);
      // Don't show toast for shared files, just silently fail
      if (!isShared) {
        toast.error(t('comments.load_error'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateComment = async () => {
    if (!newComment.trim()) {
      toast.error(t('comments.empty'));
      return;
    }

    try {
      await commentService.createComment(fileId, newComment.trim());
      setNewComment('');
      toast.success(t('comments.add_success'));
      loadComments();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('comments.add_error'));
    }
  };

  const handleReply = async (parentId: string) => {
    if (!replyContent.trim()) {
      toast.error(t('comments.reply_empty'));
      return;
    }

    try {
      await commentService.createComment(fileId, replyContent.trim(), parentId);
      setReplyContent('');
      setReplyingTo(null);
      toast.success(t('comments.reply_success'));
      loadComments();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('comments.reply_error'));
    }
  };

  const handleUpdate = async (commentId: string) => {
    if (!editContent.trim()) {
      toast.error(t('comments.empty'));
      return;
    }

    try {
      await commentService.updateComment(commentId, editContent.trim());
      setEditingId(null);
      setEditContent('');
      toast.success(t('comments.update_success'));
      loadComments();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('comments.update_error'));
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm(t('comments.delete_confirm'))) return;

    try {
      await commentService.deleteComment(commentId);
      toast.success(t('comments.delete_success'));
      loadComments();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('comments.delete_error'));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getUserDisplayName = (comment: Comment) => {
    if (comment.user.firstName || comment.user.lastName) {
      return `${comment.user.firstName || ''} ${comment.user.lastName || ''}`.trim();
    }
    return comment.user.email.split('@')[0];
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const isAuthor = user?.id === comment.userId;
    const isEditing = editingId === comment.id;

    return (
      <div key={comment.id} className={`${isReply ? 'ml-12 mt-2' : 'mt-4'}`}>
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {comment.user.avatar ? (
              <img
                src={comment.user.avatar}
                alt={getUserDisplayName(comment)}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-300 font-semibold text-sm">
                {getUserDisplayName(comment)[0].toUpperCase()}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {getUserDisplayName(comment)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(comment.createdAt)}
                  </span>
                  {isAuthor && !isEditing && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingId(comment.id);
                          setEditContent(comment.content);
                        }}
                        className="p-1 text-gray-500 hover:text-primary-600 dark:hover:text-primary-300"
                        title={t('comments.edit_title')}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                        title={t('comments.delete_title')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none"
                    rows={3}
                    maxLength={2000}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(comment.id)}
                      className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors"
                    >
                      {t('comments.save_button')}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditContent('');
                      }}
                      className="px-3 py-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-900 dark:text-white text-sm rounded-lg transition-colors"
                    >
                      {t('comments.cancel_button')}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {comment.content}
                </p>
              )}
            </div>

            {/* Actions */}
            {!isReply && !isEditing && (
              <button
                onClick={() => setReplyingTo(comment.id)}
                className="mt-1 text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-300 flex items-center gap-1"
              >
                <Reply className="w-3 h-3" />
                {t('comments.reply_button')}
              </button>
            )}

            {/* Reply Form */}
            {replyingTo === comment.id && (
              <div className="mt-2 ml-0 space-y-2">
                <div className="flex gap-2">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={t('comments.reply_placeholder')}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none"
                    rows={2}
                    maxLength={2000}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReply(comment.id)}
                    className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    {t('comments.reply_button')}
                  </button>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyContent('');
                    }}
                    className="px-3 py-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-900 dark:text-white text-sm rounded-lg transition-colors"
                  >
                    {t('comments.cancel_button')}
                  </button>
                </div>
              </div>
            )}

            {/* Replies */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="space-y-2">
                {comment.replies.map((reply) => renderComment(reply, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <MessageCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('comments.title')}
        </h3>
        <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)}
        </span>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : hasError ? (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 mx-auto text-red-300 dark:text-red-600 mb-2" />
            <p className="text-red-600 dark:text-red-400">{t('comments.load_error')}</p>
            {isShared && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('comments.unavailable_shared')}
              </p>
            )}
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-gray-500 dark:text-gray-400">{t('comments.no_comments')}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {t('comments.be_first')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {comments.map((comment) => renderComment(comment))}
          </div>
        )}
      </div>

      {/* New Comment Form */}
      {!hasError && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          {isShared && !canWrite && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                {t('comments.read_only')}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t('comments.placeholder')}
              disabled={isShared && !canWrite}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-primary-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              rows={3}
              maxLength={2000}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleCreateComment();
                }
              }}
            />
            <button
              onClick={handleCreateComment}
              disabled={!newComment.trim() || (isShared && !canWrite)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2 h-fit"
              title="Cmd/Ctrl + Enter"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('comments.cmd_enter')}
          </p>
        </div>
      )}
    </div>
  );
}
