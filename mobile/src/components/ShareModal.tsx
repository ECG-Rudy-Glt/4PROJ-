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
import { colors } from '../theme/colors';
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
  const canUsePassword = user?.plan !== 'FREE';

  const [mode, setMode] = useState<Mode>('user');
  const [email, setEmail] = useState('');
  const [perms, setPerms] = useState<SharePermissions>({ canRead: true });
  const [loading, setLoading] = useState(false);

  const [password, setPassword] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);

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
      Toast.show({ type: 'error', text1: t('share_modal.email_required') });
      return;
    }
    setLoading(true);
    try {
      await Promise.all(targets.map((tgt) =>
        tgt.kind === 'file'
          ? shareService.shareFile(tgt.data.id, email.trim(), perms)
          : shareService.shareFolder(tgt.data.id, email.trim(), perms)
      ));
      Toast.show({
        type: 'success',
        text1: isMulti
          ? t('share_modal.shared_success_multi', { count: targets.length })
          : t('share_modal.shared_success_single'),
      });
      handleClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error || t('share_modal.share_error');
      Toast.show({ type: 'error', text1: msg });
    } finally {
      setLoading(false);
    }
  };

  const getOrCreateLink = async (): Promise<string | null> => {
    if (createdLink) return createdLink;
    if (!hasFileTargets) {
      Toast.show({ type: 'error', text1: t('share_modal.files_required') });
      return null;
    }
    const max = maxDownloads.trim() ? parseInt(maxDownloads, 10) : undefined;
    const opts = {
      password: canUsePassword && password.trim() ? password.trim() : undefined,
      maxDownloads: Number.isFinite(max) ? max : undefined,
    };
    let link: string;
    if (fileTargets.length === 1) {
      const res = await shareService.createShareLink(fileTargets[0].data.id, opts);
      link = res.shareLink.url;
    } else {
      const res = await shareService.createBundleShareLink(fileTargets.map((tgt) => tgt.data.id), opts);
      link = res.shareLink.url;
    }
    setCreatedLink(link);
    return link;
  };

  const handleCreateLink = async () => {
    setLoading(true);
    try {
      const link = await getOrCreateLink();
      if (link) Toast.show({ type: 'success', text1: t('share_modal.link_created') });
    } catch {
      Toast.show({ type: 'error', text1: t('share_modal.link_error') });
    } finally {
      setLoading(false);
    }
  };

  const handleShareLink = async () => {
    setCopyLoading(true);
    try {
      const link = await getOrCreateLink();
      if (!link) return;
      await RNShare.share({ message: link });
    } catch {
      /* user cancelled */
    } finally {
      setCopyLoading(false);
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
              {isMulti
                ? t('share_modal.title_multi', { count: targets.length })
                : t('share_modal.title_single', { name: targets[0].data.name })}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.neutral[500]} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === 'user' && styles.tabActive]}
              onPress={() => setMode('user')}
            >
              <Text style={[styles.tabText, mode === 'user' && styles.tabTextActive]}>{t('share_modal.tab_user')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'link' && styles.tabActive]}
              onPress={() => setMode('link')}
            >
              <Text style={[styles.tabText, mode === 'link' && styles.tabTextActive]}>{t('share_modal.tab_link')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scrollContent}>
            {mode === 'user' ? (
              <View>
                <Text style={styles.label}>{t('share_modal.email_label')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('share_modal.email_placeholder')}
                  placeholderTextColor={colors.neutral[400]}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <Text style={[styles.label, { marginTop: spacing.lg }]}>{t('share_modal.permissions_title')}</Text>
                <PermToggle label={t('share_modal.perm_read')} active={!!perms.canRead} onToggle={() => togglePerm('canRead')} />
                <PermToggle label={t('share_modal.perm_write')} active={!!perms.canWrite} onToggle={() => togglePerm('canWrite')} />
                <PermToggle label={t('share_modal.perm_delete')} active={!!perms.canDelete} onToggle={() => togglePerm('canDelete')} />
                <PermToggle label={t('share_modal.perm_share')} active={!!perms.canShare} onToggle={() => togglePerm('canShare')} />

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={handleShareToUser}
                  disabled={loading}
                >
                  <Text style={styles.primaryBtnText}>{loading ? t('share_modal.sharing') : t('share_modal.share_btn')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {!hasFileTargets && (
                  <Text style={styles.muted}>{t('share_modal.files_only_notice')}</Text>
                )}
                {hasFileTargets && !createdLink && (
                  <>
                    {isMulti && fileTargets.length < targets.length && (
                      <Text style={[styles.muted, { textAlign: 'left', paddingHorizontal: 0, paddingTop: 0, paddingBottom: spacing.md }]}>
                        {t('share_modal.folders_ignored', { count: fileTargets.length })}
                      </Text>
                    )}
                    <Text style={styles.label}>{t('share_modal.password_label')}</Text>
                    {canUsePassword ? (
                      <TextInput
                        style={styles.input}
                        placeholder={t('share_modal.password_placeholder')}
                        placeholderTextColor={colors.neutral[400]}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                      />
                    ) : (
                      <View style={styles.proBanner}>
                        <Ionicons name="lock-closed" size={16} color="#7c3aed" />
                        <Text style={styles.proText}>{t('share_modal.pro_banner')}</Text>
                      </View>
                    )}

                    <Text style={[styles.label, { marginTop: spacing.lg }]}>{t('share_modal.max_downloads_label')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('share_modal.max_downloads_placeholder')}
                      placeholderTextColor={colors.neutral[400]}
                      value={maxDownloads}
                      onChangeText={setMaxDownloads}
                      keyboardType="numeric"
                    />

                    <TouchableOpacity
                      style={[styles.primaryBtn, (loading || copyLoading) && styles.btnDisabled]}
                      onPress={handleShareLink}
                      disabled={loading || copyLoading}
                    >
                      <Ionicons name="share-outline" size={18} color={colors.white} />
                      <Text style={styles.primaryBtnText}>
                        {copyLoading ? t('share_modal.creating') : createdLink ? t('share_modal.copy_link') : t('share_modal.create_share_btn')}
                      </Text>
                    </TouchableOpacity>

                    {createdLink && (
                      <View style={[styles.linkResult, { marginTop: spacing.md }]}>
                        <Text style={styles.label}>
                          {fileTargets.length > 1 ? t('share_modal.link_label_zip') : t('share_modal.link_label')}
                        </Text>
                        <Text style={styles.linkText} selectable numberOfLines={2}>{createdLink}</Text>
                      </View>
                    )}
                  </>
                )}

                {hasFileTargets && createdLink && false && null}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PermToggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
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
    backgroundColor: colors.neutral[200],
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  title: {
    ...typography.h4,
    color: colors.neutral[800],
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    marginVertical: spacing.md,
    backgroundColor: colors.neutral[100],
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
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  tabText: {
    ...typography.bodySmall,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary[600],
    fontWeight: '600',
  },
  label: {
    ...typography.caption,
    color: colors.neutral[500],
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.neutral[900],
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  permLabel: {
    ...typography.body,
    color: colors.neutral[800],
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  primaryBtnText: {
    ...typography.button,
    color: colors.white,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  linkResult: {
    backgroundColor: colors.primary[50],
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.primary[700],
    fontFamily: 'Menlo',
  },
  muted: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: 'center',
    padding: spacing.xl,
  },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  proText: {
    ...typography.bodySmall,
    color: '#7c3aed',
    flex: 1,
  },
});
