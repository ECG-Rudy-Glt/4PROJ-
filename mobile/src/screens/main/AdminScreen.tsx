import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useColors, AppColors } from '../../theme/useColors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { adminService, AdminOverview, AdminUserRow } from '../../services/adminService';

const PLAN_OPTIONS = ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const;

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
};

type Tab = 'overview' | 'users';

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'ALL' | 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE'>('ALL');
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const data = await adminService.getOverview();
      setOverview(data);
    } catch {
      Toast.show({ type: 'error', text1: 'Impossible de charger les KPIs' });
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadUsers = useCallback(async (targetPage = 1) => {
    setLoadingUsers(true);
    try {
      const res = await adminService.listUsers({
        page: targetPage,
        limit: 20,
        search: search || undefined,
        plan: planFilter === 'ALL' ? undefined : planFilter,
      });
      setUsers(res.users);
      setTotalPages(res.pagination.totalPages);
      setPage(res.pagination.page);
    } catch {
      Toast.show({ type: 'error', text1: 'Impossible de charger les utilisateurs' });
    } finally {
      setLoadingUsers(false);
    }
  }, [search, planFilter]);

  useEffect(() => { loadOverview(); }, []);
  useEffect(() => {
    if (tab === 'users') {
      const t = setTimeout(() => loadUsers(1), 250);
      return () => clearTimeout(t);
    }
  }, [tab, search, planFilter]);

  const handleChangePlan = (user: AdminUserRow) => {
    Alert.alert(
      `Plan de ${user.email}`,
      `Plan actuel: ${user.plan}`,
      PLAN_OPTIONS.map((plan) => ({
        text: plan === user.plan ? `${plan} ✓` : plan,
        onPress: plan === user.plan ? undefined : async () => {
          setUpdatingUser(user.id);
          try {
            const { user: updated } = await adminService.updateUserPlan(user.id, plan);
            setUsers((prev) => prev.map((u) => u.id === updated.id ? { ...u, plan: updated.plan } : u));
            Toast.show({ type: 'success', text1: `Plan mis à jour: ${updated.plan}` });
          } catch {
            Toast.show({ type: 'error', text1: 'Erreur lors du changement de plan' });
          } finally {
            setUpdatingUser(null);
          }
        },
      }))
    );
  };

  const kpis = overview?.kpis;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.neutral[700]} />
        </TouchableOpacity>
        <Text style={styles.title}>Panel Admin</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'overview' && styles.tabActive]} onPress={() => setTab('overview')}>
          <Text style={[styles.tabText, tab === 'overview' && styles.tabTextActive]}>Vue générale</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'users' && styles.tabActive]} onPress={() => setTab('users')}>
          <Text style={[styles.tabText, tab === 'users' && styles.tabTextActive]}>Utilisateurs</Text>
        </TouchableOpacity>
      </View>

      {/* Overview tab */}
      {tab === 'overview' && (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loadingOverview} onRefresh={loadOverview} tintColor={colors.primary[600]} />}
        >
          {loadingOverview ? (
            <ActivityIndicator color={colors.primary[600]} style={{ marginTop: spacing['2xl'] }} />
          ) : kpis ? (
            <>
              <Text style={styles.sectionTitle}>Statistiques</Text>
              <View style={styles.kpiGrid}>
                <KpiCard icon="people-outline" label="Utilisateurs" value={kpis.totalUsers} styles={styles} colors={colors} />
                <KpiCard icon="document-outline" label="Fichiers" value={kpis.totalFiles} styles={styles} colors={colors} />
                <KpiCard icon="cloud-upload-outline" label="Uploads 24h" value={kpis.uploads24h} styles={styles} colors={colors} />
                <KpiCard icon="person-add-outline" label="Nouveaux 30j" value={kpis.newUsers30d} styles={styles} colors={colors} />
                <KpiCard icon="pulse-outline" label="Actifs 24h" value={kpis.activeUsers24h} styles={styles} colors={colors} />
                <KpiCard icon="shield-outline" label="Admins" value={kpis.totalAdmins} styles={styles} colors={colors} />
              </View>

              <Text style={styles.sectionTitle}>Stockage</Text>
              <View style={styles.storageCard}>
                <View style={styles.storageRow}>
                  <Text style={styles.storageLabel}>Utilisé</Text>
                  <Text style={styles.storageValue}>{formatBytes(kpis.totalStorageUsed)}</Text>
                </View>
                <View style={styles.storageRow}>
                  <Text style={styles.storageLabel}>Quota total</Text>
                  <Text style={styles.storageValue}>{formatBytes(kpis.totalQuotaLimit)}</Text>
                </View>
                <View style={styles.storageBar}>
                  <View style={[styles.storageBarFill, { width: `${Math.min(kpis.storageUsagePercent, 100)}%` }]} />
                </View>
                <Text style={styles.storagePct}>{kpis.storageUsagePercent.toFixed(1)}% utilisé</Text>
              </View>

              {overview.distribution?.plans?.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Répartition des plans</Text>
                  <View style={styles.storageCard}>
                    {overview.distribution.plans.map((p) => (
                      <View key={p.plan} style={styles.storageRow}>
                        <Text style={styles.storageLabel}>{p.plan}</Text>
                        <Text style={styles.storageValue}>{p.count}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {overview.topStorageUsers?.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Top utilisateurs (stockage)</Text>
                  {overview.topStorageUsers.slice(0, 5).map((u) => (
                    <View key={u.id} style={styles.userCard}>
                      <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>
                          {(u.firstName?.[0] || u.email[0]).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userEmail}>{u.email}</Text>
                        <Text style={styles.userMeta}>{u.plan} · {formatBytes(u.quotaUsed)} / {formatBytes(u.quotaLimit)}</Text>
                        <View style={styles.miniBar}>
                          <View style={[styles.miniBarFill, { width: `${Math.min((u.quotaUsed / u.quotaLimit) * 100, 100)}%` }]} />
                        </View>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </>
          ) : null}
        </ScrollView>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={16} color={colors.neutral[400]} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher..."
                placeholderTextColor={colors.neutral[400]}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.planFilters}>
            {(['ALL', ...PLAN_OPTIONS] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.planChip, planFilter === p && styles.planChipActive]}
                onPress={() => setPlanFilter(p)}
              >
                <Text style={[styles.planChipText, planFilter === p && styles.planChipTextActive]}>
                  {p === 'ALL' ? 'Tous' : p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={users}
            keyExtractor={(u) => u.id}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={loadingUsers} onRefresh={() => loadUsers(1)} tintColor={colors.primary[600]} />}
            ListEmptyComponent={
              !loadingUsers ? (
                <Text style={styles.empty}>Aucun utilisateur trouvé</Text>
              ) : null
            }
            renderItem={({ item: u }) => (
              <View style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {(u.firstName?.[0] || u.email[0]).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
                  <Text style={styles.userMeta}>
                    {u.firstName} {u.lastName} · {u.role}
                  </Text>
                  <Text style={styles.userMeta}>
                    {formatBytes(u.quotaUsed)} / {formatBytes(u.quotaLimit)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.planBtn}
                  onPress={() => handleChangePlan(u)}
                  disabled={updatingUser === u.id}
                >
                  {updatingUser === u.id ? (
                    <ActivityIndicator size="small" color={colors.primary[600]} />
                  ) : (
                    <Text style={styles.planBtnText}>{u.plan}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            ListFooterComponent={
              totalPages > 1 ? (
                <View style={styles.pagination}>
                  <TouchableOpacity disabled={page <= 1} onPress={() => loadUsers(page - 1)} style={styles.pageBtn}>
                    <Ionicons name="chevron-back" size={18} color={page <= 1 ? colors.neutral[300] : colors.primary[600]} />
                  </TouchableOpacity>
                  <Text style={styles.pageLabel}>{page} / {totalPages}</Text>
                  <TouchableOpacity disabled={page >= totalPages} onPress={() => loadUsers(page + 1)} style={styles.pageBtn}>
                    <Ionicons name="chevron-forward" size={18} color={page >= totalPages ? colors.neutral[300] : colors.primary[600]} />
                  </TouchableOpacity>
                </View>
              ) : null
            }
          />
        </View>
      )}
    </View>
  );
}

function KpiCard({ icon, label, value, styles, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number; styles: ReturnType<typeof makeStyles>; colors: AppColors }) {
  return (
    <View style={styles.kpiCard}>
      <Ionicons name={icon} size={22} color={colors.primary[600]} />
      <Text style={styles.kpiValue}>{value.toLocaleString('fr-FR')}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.secondary },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: c.white,
    borderBottomWidth: 1, borderBottomColor: c.neutral[100],
  },
  backBtn: { padding: spacing.xs },
  title: { ...typography.h3, color: c.neutral[900] },
  tabs: {
    flexDirection: 'row',
    backgroundColor: c.white,
    borderBottomWidth: 1, borderBottomColor: c.neutral[100],
  },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: c.primary[600] },
  tabText: { ...typography.bodySmall, color: c.neutral[400] },
  tabTextActive: { color: c.primary[600], fontWeight: '700' },
  content: { padding: spacing.lg, paddingBottom: spacing['5xl'] },
  sectionTitle: { ...typography.h4, color: c.neutral[700], marginBottom: spacing.sm, marginTop: spacing.md },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiCard: {
    backgroundColor: c.white, borderRadius: borderRadius.lg,
    padding: spacing.md, alignItems: 'center', width: '31%',
    ...shadows.sm,
  },
  kpiValue: { ...typography.h3, color: c.neutral[900], marginTop: 4 },
  kpiLabel: { ...typography.caption, color: c.neutral[400], textAlign: 'center', marginTop: 2 },
  storageCard: {
    backgroundColor: c.white, borderRadius: borderRadius.xl,
    padding: spacing.lg, ...shadows.sm, gap: spacing.sm,
  },
  storageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  storageLabel: { ...typography.bodySmall, color: c.neutral[500] },
  storageValue: { ...typography.body, color: c.neutral[900], fontWeight: '600' },
  storageBar: {
    height: 8, backgroundColor: c.neutral[100],
    borderRadius: borderRadius.full, overflow: 'hidden',
  },
  storageBarFill: { height: '100%', backgroundColor: c.primary[500], borderRadius: borderRadius.full },
  storagePct: { ...typography.caption, color: c.neutral[400], textAlign: 'right' },
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: c.white, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm,
  },
  userAvatar: {
    width: 38, height: 38, borderRadius: borderRadius.full,
    backgroundColor: c.primary[100], justifyContent: 'center', alignItems: 'center',
  },
  userAvatarText: { ...typography.body, color: c.primary[700], fontWeight: '700' },
  userEmail: { ...typography.bodySmall, color: c.neutral[900], fontWeight: '600' },
  userMeta: { ...typography.caption, color: c.neutral[400] },
  miniBar: {
    height: 4, backgroundColor: c.neutral[100],
    borderRadius: borderRadius.full, overflow: 'hidden', marginTop: 4,
  },
  miniBarFill: { height: '100%', backgroundColor: c.primary[400] },
  planBtn: {
    backgroundColor: c.primary[50], paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs, borderRadius: borderRadius.md, minWidth: 60, alignItems: 'center',
  },
  planBtnText: { ...typography.caption, color: c.primary[700], fontWeight: '700' },
  searchRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: c.white, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: c.neutral[200],
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  searchInput: { flex: 1, ...typography.body, color: c.neutral[900] },
  planFilters: {
    flexDirection: 'row', gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexWrap: 'wrap',
  },
  planChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full, backgroundColor: c.neutral[100],
  },
  planChipActive: { backgroundColor: c.primary[600] },
  planChipText: { ...typography.caption, color: c.neutral[600] },
  planChipTextActive: { color: c.white, fontWeight: '700' },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.lg, paddingTop: spacing.lg },
  pageBtn: { padding: spacing.sm },
  pageLabel: { ...typography.body, color: c.neutral[600] },
  empty: { ...typography.body, color: c.neutral[400], textAlign: 'center', marginTop: spacing['2xl'] },
});
