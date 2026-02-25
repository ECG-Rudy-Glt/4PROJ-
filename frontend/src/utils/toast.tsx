/* eslint-disable react-refresh/only-export-components */
import toast from 'react-hot-toast';
import { 
  AlertCircle, 
  Info, 
  Upload, 
  Download, 
  Trash2, 
  Share2, 
  Copy, 
  Star,
  FolderPlus,
  FileCheck,
  LogIn,
  LogOut,
  Settings,
  Shield
} from 'lucide-react';

// Custom toast styles with icons
const toastStyles = {
  base: {
    padding: '16px 20px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '500',
    maxWidth: '400px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  success: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#fff',
  },
  error: {
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: '#fff',
  },
  warning: {
    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    color: '#fff',
  },
  info: {
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    color: '#fff',
  },
};

// Icon wrapper component
const IconWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
    {children}
  </div>
);

// Custom toast functions
export const customToast = {
  // Success variants
  success: (message: string) => {
    toast.success(message);
  },

  // Upload success
  uploadSuccess: (fileName: string) => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg`}
        style={toastStyles.success}
      >
        <IconWrapper>
          <Upload className="w-5 h-5" />
        </IconWrapper>
        <div>
          <p className="font-semibold">Upload réussi</p>
          <p className="text-sm opacity-90">{fileName}</p>
        </div>
      </div>
    ), { duration: 3000 });
  },

  // Download started
  downloadStarted: (fileName: string) => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg`}
        style={toastStyles.info}
      >
        <IconWrapper>
          <Download className="w-5 h-5" />
        </IconWrapper>
        <div>
          <p className="font-semibold">Téléchargement démarré</p>
          <p className="text-sm opacity-90">{fileName}</p>
        </div>
      </div>
    ), { duration: 3000 });
  },

  // File deleted
  fileDeleted: (fileName: string) => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg`}
        style={toastStyles.success}
      >
        <IconWrapper>
          <Trash2 className="w-5 h-5" />
        </IconWrapper>
        <div>
          <p className="font-semibold">Fichier supprimé</p>
          <p className="text-sm opacity-90">{fileName}</p>
        </div>
      </div>
    ), { duration: 3000 });
  },

  // Link copied
  linkCopied: () => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg`}
        style={toastStyles.success}
      >
        <IconWrapper>
          <Copy className="w-5 h-5" />
        </IconWrapper>
        <p className="font-semibold">Lien copié dans le presse-papiers</p>
      </div>
    ), { duration: 2000 });
  },

  // Share created
  shareCreated: () => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg`}
        style={toastStyles.success}
      >
        <IconWrapper>
          <Share2 className="w-5 h-5" />
        </IconWrapper>
        <p className="font-semibold">Lien de partage créé</p>
      </div>
    ), { duration: 3000 });
  },

  // Favorite toggled
  favoriteAdded: () => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg`}
        style={{ ...toastStyles.base, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff' }}
      >
        <IconWrapper>
          <Star className="w-5 h-5 fill-current" />
        </IconWrapper>
        <p className="font-semibold">Ajouté aux favoris</p>
      </div>
    ), { duration: 2000 });
  },

  favoriteRemoved: () => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg`}
        style={toastStyles.info}
      >
        <IconWrapper>
          <Star className="w-5 h-5" />
        </IconWrapper>
        <p className="font-semibold">Retiré des favoris</p>
      </div>
    ), { duration: 2000 });
  },

  // Folder created
  folderCreated: (folderName: string) => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg`}
        style={toastStyles.success}
      >
        <IconWrapper>
          <FolderPlus className="w-5 h-5" />
        </IconWrapper>
        <div>
          <p className="font-semibold">Dossier créé</p>
          <p className="text-sm opacity-90">{folderName}</p>
        </div>
      </div>
    ), { duration: 3000 });
  },

  // File restored
  fileRestored: () => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg`}
        style={toastStyles.success}
      >
        <IconWrapper>
          <FileCheck className="w-5 h-5" />
        </IconWrapper>
        <p className="font-semibold">Fichier restauré</p>
      </div>
    ), { duration: 3000 });
  },

  // Login success
  loginSuccess: (userName?: string) => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg`}
        style={toastStyles.success}
      >
        <IconWrapper>
          <LogIn className="w-5 h-5" />
        </IconWrapper>
        <div>
          <p className="font-semibold">Connexion réussie</p>
          {userName && <p className="text-sm opacity-90">Bienvenue, {userName} !</p>}
        </div>
      </div>
    ), { duration: 3000 });
  },

  // Logout
  logoutSuccess: () => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg`}
        style={toastStyles.info}
      >
        <IconWrapper>
          <LogOut className="w-5 h-5" />
        </IconWrapper>
        <p className="font-semibold">Déconnexion réussie</p>
      </div>
    ), { duration: 2000 });
  },

  // Settings updated
  settingsUpdated: () => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg`}
        style={toastStyles.success}
      >
        <IconWrapper>
          <Settings className="w-5 h-5" />
        </IconWrapper>
        <p className="font-semibold">Paramètres mis à jour</p>
      </div>
    ), { duration: 3000 });
  },

  // Password changed
  passwordChanged: () => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg`}
        style={toastStyles.success}
      >
        <IconWrapper>
          <Shield className="w-5 h-5" />
        </IconWrapper>
        <p className="font-semibold">Mot de passe modifié avec succès</p>
      </div>
    ), { duration: 3000 });
  },

  // Error variants
  error: (message: string) => {
    toast.error(message);
  },

  // Warning
  warning: (message: string) => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg`}
        style={toastStyles.warning}
      >
        <IconWrapper>
          <AlertCircle className="w-5 h-5" />
        </IconWrapper>
        <p className="font-semibold">{message}</p>
      </div>
    ), { duration: 4000 });
  },

  // Info
  info: (message: string) => {
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg`}
        style={toastStyles.info}
      >
        <IconWrapper>
          <Info className="w-5 h-5" />
        </IconWrapper>
        <p className="font-semibold">{message}</p>
      </div>
    ), { duration: 3000 });
  },

  // Loading with promise
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return toast.promise(promise, messages);
  },
};

// Re-export default toast for simple cases
export { toast };
