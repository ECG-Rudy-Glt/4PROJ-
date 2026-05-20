import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Share as RNShare,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { useColors, AppColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { FileItem, Folder } from '../types';
import { shareService, SharePermissions } from '../services/shareService';
import { useAuthStore } from '../stores/useAuthStore';

type Target =
  | { kind: 'file'; data: FileItem }
  | { kind: 'folder'; data: Folder };

interface Props {
  target?: Target | null;
  targets?: Target[];
  onClose: () => void;
}

type Mode = 'user' | 'link';

export default function ShareModal({ target, targets: targetsProp, onClose }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const canUsePassword = user?.plan !== 'FREE';

  const [mode, setMode] = useState<Mode>('user');
  const [email, setEmail] = useState('');
  const [perms, setPerms] = useState<SharePermissions>({ canRead: true });
  const [loading, setLoading] = useState(false);

  // link-only state
  const [password, setPassword] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  // Normalise : targetsProp prend la priorité, sinon on wrap target en tableau
  const targets: Target[] = targetsProp ?? (target ? [target] : []);

  if (targets.length === 0) return null;

  const isMulti = targets.length > 1;
  const fileTargets = targets.filter((t): t is { kind: 'file'; data: FileItem } => t.kind === 'file');
  const hasFileTargets = fileTargets.length > 0;
  const isFile = !isMulti && targets[0].kind === 'file';

  const reset = () => {
    setEmail('');
    setPassword('');
    setMaxDownloads('');
    setCreatedLink(null);
    setPerms({ canRead: true });
    setMode('user');
  };

  const handleClose = () => { reset(); onClose(); };

  const togglePerm = (key: keyof SharePermissions) => {
    setPerms((p) => ({ ...p, [key]: !p[key] }));
  };

  const handleShareToUser = async () => {
    if (!email.trim()) {
      Toast.show({ type: 'error', text1: 'Email requis' });
      return;
    }
    setLoading(true);
    try {
      await Promise.all(targets.map((t) =>
        t.kind === 'file'
          ? shareService.shareFile(t.data.id, email.trim(), perms)
          : shareService.shareFolder(t.data.id, email.trim(), perms)
      ));
      Toast.show({ type: 'success', text1: isMulti ? `${targets.length} éléments partagés` : 'Partage envoyé' });
      handleClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Erreur lors du partage';
      Toast.show({ type: 'error', text1: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async () => {
    if (!hasFileTargets) {
      Toast.show({ type: 'error', text1: 'Sélectionnez au moins un fichier pour créer un lien public' });
      return;
    }
    setLoading(true);
    try {
      const max = maxDownloads.trim() ? parseInt(maxDownloads, 10) : undefined;
      const opts = {
        password: password.trim() || undefined,
        maxDownloads: Number.isFinite(max) ? max : undefined,
      };
      if (fileTargets.length === 1) {
        const res = await shareService.createShareLink(fileTargets[0].data.id, opts);
        setCreatedLink(res.shareLink.url);
      } else {
        const res = await shareService.createBundleShareLink(fileTargets.map((t) => t.data.id), opts);
        setCreatedLink(res.shareLink.url);
      }
      Toast.show({ type: 'success', text1: 'Lien créé' });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur lors de la création du lien' });
    } finally {
      setLoading(false);
    }
  };

  const handleShareLink = async () => {
    if (!createdLink) return;
    try {
      await RNShare.share({ message: createdLink });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Ionicons
              name={isMulti ? 'copy-outline' : isFile ? 'document-outline' : 'folder-outline'}
              size={22}
              color={colors.primary[600]}
            />
            <Text style={styles.title} numberOfLines={1}>
              {isMulti ? `Partager ${targets.length} éléments` : `Partager « ${targets[0].data.name} »`}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.neutral[500]} />
            </TouchableOpacity>
          </View>

          {/* Mode tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === 'user' && styles.tabActive]}
              onPress={() => setMode('user')}
            >
              <Text style={[styles.tabText, mode === 'user' && styles.tabTextActive]}>Utilisateur</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'link' && styles.tabActive]}
              onPress={() => setMode('link')}
            >
              <Text style={[styles.tabText, mode === 'link' && styles.tabTextActive]}>Lien public</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scrollContent}>
            {mode === 'user' ? (
              <View>
                <Text style={styles.label}>Email du destinataire</Text>
                <TextInput
                  style={styles.input}
                  placeholder="utilisateur@exemple.com"
                  placeholderTextColor={colors.neutral[400]}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <Text style={[styles.label, { marginTop: spacing.lg }]}>Permissions</Text>
                <PermToggle label="Lecture" active={!!perms.canRead} onToggle={() => togglePerm('canRead')} colors={colors} styles={styles} />
                <PermToggle label="Écriture" active={!!perms.canWrite} onToggle={() => togglePerm('canWrite')} colors={colors} styles={styles} />
                <PermToggle label="Suppression" active={!!perms.canDelete} onToggle={() => togglePerm('canDelete')} colors={colors} styles={styles} />
                <PermToggle label="Partage" active={!!perms.canShare} onToggle={() => togglePerm('canShare')} colors={colors} styles={styles} />

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={handleShareToUser}
                  disabled={loading}
                >
                  <Text style={styles.primaryBtnText}>{loading ? 'Envoi…' : 'Partager'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {!hasFileTargets && (
                  <Text style={styles.muted}>
                    Les liens publics sont disponibles uniquement pour les fichiers.
                  </Text>
                )}
                {hasFileTargets && !createdLink && (
                  <>
                    {isMulti && fileTargets.length < targets.length && (
                      <Text style={[styles.muted, { textAlign: 'left', paddingHorizontal: 0, paddingTop: 0, paddingBottom: spacing.md }]}>
                        {`${fileTargets.length} fichier(s) — les dossiers seront ignorés.`}
                      </Text>
                    )}
                    <Text style={styles.label}>Protection par mot de passe</Text>
                    {canUsePassword ? (
                      <TextInput
                        style={styles.input}
                        placeholder="Laisser vide pour aucun"
                        placeholderTextColor={colors.neutral[400]}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                      />
                    ) : (
                      <View style={styles.proBanner}>
                        <Ionicons name="lock-closed" size={16} color={colors.primary[600]} />
                        <Text style={styles.proText}>Fonctionnalité PRO — Passez à un abonnement supérieur pour protéger vos liens par mot de passe.</Text>
                      </View>
                    )}

                    <Text style={[styles.label, { marginTop: spacing.lg }]}>Téléchargements max (optionnel)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Illimité"
                      placeholderTextColor={colors.neutral[400]}
                      value={maxDownloads}
                      onChangeText={setMaxDownloads}
                      keyboardType="numeric"
                    />

                    <TouchableOpacity
                      style={[styles.primaryBtn, loading && styles.btnDisabled]}
                      onPress={handleCreateLink}
                      disabled={loading}
                    >
                      <Text style={styles.primaryBtnText}>
                        {loading ? 'Création…' : 'Créer le lien'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {hasFileTargets && createdLink && (
                  <View style={styles.linkResult}>
                    <Text style={styles.label}>Lien public{fileTargets.length > 1 ? ' (archive ZIP)' : ''}</Text>
                    <Text style={styles.linkText} selectable numberOfLines={2}>{createdLink}</Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={handleShareLink}>
                      <Ionicons name="share-outline" size={18} color={colors.white} />
                      <Text style={styles.primaryBtnText}>Partager le lien</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PermToggle({ label, active, onToggle, colors, styles }: { label: string; active: boolean; onToggle: () => void; colors: AppColors; styles: ReturnType<typeof makeStyles> }) {
  return (
    <TouchableOpacity style={styles.permRow} onPress={onToggle} activeOpacity={0.7}>
      <Ionicons
        name={active ? 'checkbox' : 'square-outline'}
        size={22}
        color={active ? colors.primary[600] : colors.neutral[400]}
      />
      <Text style={styles.permLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
    ...shadows['2xl'],
  },
  scrollContent: {
    flexShrink: 1,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.neutral[200],
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
  },
  title: {
    ...typography.h4,
    color: c.neutral[800],
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    marginVertical: spacing.md,
    backgroundColor: c.neutral[100],
    borderRadius: borderRadius.lg,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: c.white,
    ...shadows.sm,
  },
  tabText: {
    ...typography.bodySmall,
    color: c.neutral[500],
    fontWeight: '500',
  },
  tabTextActive: {
    color: c.primary[600],
    fontWeight: '600',
  },
  label: {
    ...typography.caption,
    color: c.neutral[500],
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  input: {
    backgroundColor: c.neutral[50],
    borderWidth: 1,
    borderColor: c.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: c.neutral[900],
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  permLabel: {
    ...typography.body,
    color: c.neutral[800],
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: c.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  primaryBtnText: {
    ...typography.button,
    color: c.white,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  linkResult: {
    backgroundColor: c.primary[50],
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  linkText: {
    ...typography.bodySmall,
    color: c.primary[700],
    fontFamily: 'Menlo',
  },
  muted: {
    ...typography.body,
    color: c.neutral[500],
    textAlign: 'center',
    padding: spacing.xl,
  },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: c.primary[50],
    borderWidth: 1,
    borderColor: c.primary[200],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  proText: {
    ...typography.bodySmall,
    color: c.primary[600],
    flex: 1,
  },
});
