import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { useAuthStore } from '../stores/useAuthStore';
import {
  accountAccessService,
  AccountSwitchLink,
  DelegationRecord,
} from '../services/accountAccessService';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Tab = 'links' | 'delegations';

export default function AccountSwitcherModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { user, sessionContext, setAuth } = useAuthStore();

  const [tab, setTab] = useState<Tab>('links');
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<AccountSwitchLink[]>([]);
  const [given, setGiven] = useState<DelegationRecord[]>([]);
  const [received, setReceived] = useState<DelegationRecord[]>([]);

  const [showAddLink, setShowAddLink] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkMfa, setLinkMfa] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  const [showGrantForm, setShowGrantForm] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantWrite, setGrantWrite] = useState(false);
  const [grantDelete, setGrantDelete] = useState(false);
  const [grantShare, setGrantShare] = useState(false);
  const [savingGrant, setSavingGrant] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [switchData, delegData] = await Promise.all([
        accountAccessService.listSwitchLinks(),
        accountAccessService.listDelegations(),
      ]);
      setLinks(switchData.links || []);
      setGiven(delegData.given || []);
      setReceived(delegData.received || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Erreur de chargement' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) void load();
  }, [visible]);

  const handleSwitch = async (linkId: string) => {
    try {
      const { token, user: next } = await accountAccessService.switchToLinkedAccount(linkId);
      await setAuth(token, next);
      Toast.show({ type: 'success', text1: `Session: ${next.email}` });
      onClose();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Échec du switch' });
    }
  };

  const handleSwitchBack = async () => {
    try {
      const { token, user: next } = await accountAccessService.switchBack();
      await setAuth(token, next);
      Toast.show({ type: 'success', text1: `Retour sur ${next.email}` });
      onClose();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Impossible de revenir' });
    }
  };

  const handleAddLink = async () => {
    if (!linkEmail || !linkPassword) {
      Toast.show({ type: 'error', text1: 'Email et mot de passe requis' });
      return;
    }
    setSavingLink(true);
    try {
      await accountAccessService.addSwitchLink({
        email: linkEmail.trim(),
        password: linkPassword,
        mfaCode: linkMfa.trim() || undefined,
        label: linkLabel.trim() || undefined,
      });
      setLinkEmail(''); setLinkPassword(''); setLinkMfa(''); setLinkLabel('');
      setShowAddLink(false);
      Toast.show({ type: 'success', text1: 'Compte lié' });
      await load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Échec de liaison' });
    } finally {
      setSavingLink(false);
    }
  };

  const handleRevokeLink = (linkId: string) => {
    Alert.alert('Supprimer le lien', 'Confirmer la suppression de ce compte lié ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            await accountAccessService.revokeSwitchLink(linkId);
            await load();
          } catch {
            Toast.show({ type: 'error', text1: 'Erreur lors de la suppression' });
          }
        },
      },
    ]);
  };

  const handleGrantDelegation = async () => {
    if (!grantEmail) {
      Toast.show({ type: 'error', text1: 'Email requis' });
      return;
    }
    setSavingGrant(true);
    try {
      await accountAccessService.grantDelegation({
        delegateEmail: grantEmail.trim(),
        permissions: { canRead: true, canWrite: grantWrite, canDelete: grantDelete, canShare: grantShare },
      });
      setGrantEmail(''); setGrantWrite(false); setGrantDelete(false); setGrantShare(false);
      setShowGrantForm(false);
      Toast.show({ type: 'success', text1: 'Délégation accordée' });
      await load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Erreur' });
    } finally {
      setSavingGrant(false);
    }
  };

  const handleAssume = async (delegId: string) => {
    try {
      const { token, user: next } = await accountAccessService.assumeDelegation(delegId);
      await setAuth(token, next);
      Toast.show({ type: 'success', text1: `Agissant pour ${next.email}` });
      onClose();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Erreur' });
    }
  };

  const handleRevokeDelegation = (delegId: string) => {
    Alert.alert('Révoquer', 'Révoquer cette délégation ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Révoquer', style: 'destructive', onPress: async () => {
          try {
            await accountAccessService.revokeDelegation(delegId);
            await load();
          } catch {
            Toast.show({ type: 'error', text1: 'Erreur' });
          }
        },
      },
    ]);
  };

  const isDirectSession = !sessionContext?.authType || sessionContext.authType === 'DIRECT';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Comptes & délégations</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.neutral[600]} />
          </TouchableOpacity>
        </View>

        {/* Session banner */}
        <View style={styles.sessionBanner}>
          <Ionicons name="person-circle-outline" size={18} color={colors.primary[600]} />
          <Text style={styles.sessionEmail}>{user?.email}</Text>
          <Text style={styles.sessionType}>{sessionContext?.authType || 'DIRECT'}</Text>
          {!isDirectSession && (
            <TouchableOpacity style={styles.switchBackBtn} onPress={handleSwitchBack}>
              <Ionicons name="return-up-back-outline" size={14} color={colors.white} />
              <Text style={styles.switchBackText}>Retour</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'links' && styles.tabActive]} onPress={() => setTab('links')}>
            <Text style={[styles.tabText, tab === 'links' && styles.tabTextActive]}>Comptes liés</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'delegations' && styles.tabActive]} onPress={() => setTab('delegations')}>
            <Text style={[styles.tabText, tab === 'delegations' && styles.tabTextActive]}>Délégations</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing['2xl'] }} color={colors.primary[600]} />
        ) : (
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {tab === 'links' && (
              <>
                {links.map((link) => (
                  <View key={link.id} style={styles.card}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardEmail}>{link.targetUser.email}</Text>
                      {link.label && <Text style={styles.cardSub}>{link.label}</Text>}
                      <Text style={styles.cardSub}>
                        Dernière auth: {new Date(link.lastAuthenticatedAt).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.switchBtn} onPress={() => handleSwitch(link.id)}>
                        <Text style={styles.switchBtnText}>Switch</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleRevokeLink(link.id)}>
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {links.length === 0 && !showAddLink && (
                  <Text style={styles.empty}>Aucun compte lié.</Text>
                )}

                {showAddLink ? (
                  <View style={styles.formCard}>
                    <Text style={styles.formTitle}>Lier un compte</Text>
                    <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.neutral[400]}
                      value={linkEmail} onChangeText={setLinkEmail} keyboardType="email-address" autoCapitalize="none" />
                    <TextInput style={styles.input} placeholder="Mot de passe" placeholderTextColor={colors.neutral[400]}
                      value={linkPassword} onChangeText={setLinkPassword} secureTextEntry />
                    <TextInput style={styles.input} placeholder="Code MFA (optionnel)" placeholderTextColor={colors.neutral[400]}
                      value={linkMfa} onChangeText={(t) => setLinkMfa(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" />
                    <TextInput style={styles.input} placeholder="Libellé (optionnel)" placeholderTextColor={colors.neutral[400]}
                      value={linkLabel} onChangeText={setLinkLabel} />
                    <View style={styles.formRow}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddLink(false)}>
                        <Text style={styles.cancelText}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.saveBtn, savingLink && { opacity: 0.6 }]}
                        onPress={handleAddLink} disabled={savingLink}>
                        {savingLink ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.saveBtnText}>Lier</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddLink(true)}>
                    <Ionicons name="add-circle-outline" size={18} color={colors.primary[600]} />
                    <Text style={styles.addBtnText}>Ajouter un compte</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {tab === 'delegations' && (
              <>
                <Text style={styles.subTitle}>Délégations reçues</Text>
                {received.length === 0 && <Text style={styles.empty}>Aucune délégation reçue.</Text>}
                {received.map((d) => (
                  <View key={d.id} style={styles.card}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardEmail}>{d.ownerUser?.email || d.ownerUserId}</Text>
                      <Text style={styles.cardSub}>
                        R:{d.canRead ? '✓' : '✗'} W:{d.canWrite ? '✓' : '✗'} D:{d.canDelete ? '✓' : '✗'} S:{d.canShare ? '✓' : '✗'}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.switchBtn} onPress={() => handleAssume(d.id)}>
                      <Text style={styles.switchBtnText}>Assumer</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <Text style={[styles.subTitle, { marginTop: spacing.lg }]}>Délégations accordées</Text>
                {given.length === 0 && <Text style={styles.empty}>Aucune délégation accordée.</Text>}
                {given.map((d) => (
                  <View key={d.id} style={styles.card}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardEmail}>{d.delegateUser?.email || d.delegateUserId}</Text>
                      <Text style={styles.cardSub}>
                        R:{d.canRead ? '✓' : '✗'} W:{d.canWrite ? '✓' : '✗'} D:{d.canDelete ? '✓' : '✗'} S:{d.canShare ? '✓' : '✗'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRevokeDelegation(d.id)}>
                      <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}

                {showGrantForm ? (
                  <View style={[styles.formCard, { marginTop: spacing.lg }]}>
                    <Text style={styles.formTitle}>Accorder une délégation</Text>
                    <TextInput style={styles.input} placeholder="Email du délégataire" placeholderTextColor={colors.neutral[400]}
                      value={grantEmail} onChangeText={setGrantEmail} keyboardType="email-address" autoCapitalize="none" />
                    <View style={styles.permRow}>
                      {([
                        ['Écriture', grantWrite, setGrantWrite],
                        ['Suppression', grantDelete, setGrantDelete],
                        ['Partage', grantShare, setGrantShare],
                      ] as [string, boolean, (v: boolean) => void][]).map(([label, val, setter]) => (
                        <TouchableOpacity key={label} style={styles.permToggle} onPress={() => setter(!val)}>
                          <Ionicons name={val ? 'checkbox' : 'square-outline'} size={18} color={colors.primary[600]} />
                          <Text style={styles.permLabel}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.formRow}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowGrantForm(false)}>
                        <Text style={styles.cancelText}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.saveBtn, savingGrant && { opacity: 0.6 }]}
                        onPress={handleGrantDelegation} disabled={savingGrant}>
                        {savingGrant ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.saveBtnText}>Créer</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={[styles.addBtn, { marginTop: spacing.lg }]} onPress={() => setShowGrantForm(true)}>
                    <Ionicons name="shield-outline" size={18} color={colors.primary[600]} />
                    <Text style={styles.addBtnText}>Accorder une délégation</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.neutral[100],
    backgroundColor: colors.white,
  },
  title: { ...typography.h3, color: colors.neutral[900] },
  closeBtn: { padding: spacing.xs },
  sessionBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  sessionEmail: { ...typography.bodySmall, color: colors.neutral[800], flex: 1, fontWeight: '600' },
  sessionType: { ...typography.caption, color: colors.primary[600] },
  switchBackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  switchBackText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.neutral[100],
  },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary[600] },
  tabText: { ...typography.bodySmall, color: colors.neutral[400] },
  tabTextActive: { color: colors.primary[600], fontWeight: '700' },
  body: { flex: 1 },
  bodyContent: { padding: spacing.lg, paddingBottom: spacing['5xl'] },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardInfo: { flex: 1 },
  cardEmail: { ...typography.body, color: colors.neutral[900], fontWeight: '600' },
  cardSub: { ...typography.caption, color: colors.neutral[500], marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchBtn: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  switchBtnText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  empty: { ...typography.bodySmall, color: colors.neutral[400], textAlign: 'center', marginVertical: spacing.md },
  subTitle: { ...typography.h4, color: colors.neutral[700], marginBottom: spacing.sm },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.primary[200], borderStyle: 'dashed',
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  addBtnText: { ...typography.body, color: colors.primary[600] },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
    gap: spacing.sm,
  },
  formTitle: { ...typography.h4, color: colors.neutral[800] },
  input: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1, borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    ...typography.body, color: colors.neutral[900],
  },
  formRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end', marginTop: spacing.xs },
  cancelBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.neutral[200],
  },
  cancelText: { ...typography.body, color: colors.neutral[600] },
  saveBtn: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  saveBtnText: { ...typography.body, color: colors.white, fontWeight: '700' },
  permRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  permToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  permLabel: { ...typography.bodySmall, color: colors.neutral[700] },
});
