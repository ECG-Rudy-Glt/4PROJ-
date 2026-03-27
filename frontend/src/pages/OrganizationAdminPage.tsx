import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { organizationService } from '@/services/organizationService';
import { OrganizationMembership, OrganizationMemberRow } from '@/types';
import api from '@/services/api';
import { useTranslation } from 'react-i18next';

const ROLE_OPTIONS: Array<'OWNER' | 'ADMIN' | 'MEMBER'> = ['OWNER', 'ADMIN', 'MEMBER'];
const NON_OWNER_ROLE_OPTIONS: Array<'ADMIN' | 'MEMBER'> = ['ADMIN', 'MEMBER'];

interface UserSuggestion {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export default function OrganizationAdminPage() {
  const { t } = useTranslation();
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [members, setMembers] = useState<OrganizationMemberRow[]>([]);
  const [membershipRole, setMembershipRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER' | null>(null);
  const [newOrgName, setNewOrgName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER'>('MEMBER');
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const searchTimeoutRef = useRef<number | undefined>();

  const canManageMembers = membershipRole === 'OWNER' || membershipRole === 'ADMIN';
  const assignableRoles = membershipRole === 'OWNER' ? ROLE_OPTIONS : NON_OWNER_ROLE_OPTIONS;

  const selectedOrganization = useMemo(
    () => organizations.find((item) => item.organizationId === selectedOrgId)?.organization,
    [organizations, selectedOrgId]
  );

  const loadOrganizations = async () => {
    setLoading(true);
    try {
      const data = await organizationService.listMine();
      setOrganizations(data.organizations);
      if (data.organizations.length > 0) {
        setSelectedOrgId((prev) => prev || data.organizations[0].organizationId);
      } else {
        setSelectedOrgId('');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('organization_admin.toast_load_org_error'));
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizationDetails = async (orgId: string) => {
    if (!orgId) {
      setMembers([]);
      setMembershipRole(null);
      return;
    }

    setLoadingMembers(true);
    try {
      const data = await organizationService.getById(orgId);
      setMembers(data.organization.members || []);
      setMembershipRole(data.membershipRole);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('organization_admin.toast_load_detail_error'));
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    void loadOrganizations();
  }, []);

  useEffect(() => {
    void loadOrganizationDetails(selectedOrgId);
  }, [selectedOrgId]);

  useEffect(() => {
    if (membershipRole !== 'OWNER' && inviteRole === 'OWNER') {
      setInviteRole('MEMBER');
    }
  }, [membershipRole, inviteRole]);

  useEffect(() => {
    if (inviteEmail.length >= 2) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = window.setTimeout(() => {
        void searchUsers(inviteEmail);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [inviteEmail]);

  const searchUsers = async (query: string) => {
    try {
      const { data } = await api.get(`/users/search?query=${encodeURIComponent(query)}&limit=5`);
      setSuggestions(data.users || []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (user: UserSuggestion) => {
    setInviteEmail(user.email);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    try {
      await organizationService.create(newOrgName.trim());
      toast.success(t('organization_admin.toast_create_success'));
      setNewOrgName('');
      await loadOrganizations();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('organization_admin.toast_create_error'));
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !inviteEmail.trim()) return;

    try {
      await organizationService.addMember(selectedOrgId, inviteEmail.trim(), inviteRole);
      toast.success(t('organization_admin.toast_add_success'));
      setInviteEmail('');
      setInviteRole('MEMBER');
      setSuggestions([]);
      setShowSuggestions(false);
      await loadOrganizationDetails(selectedOrgId);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('organization_admin.toast_add_error'));
    }
  };

  const handleRoleUpdate = async (memberId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER') => {
    if (!selectedOrgId) return;
    try {
      await organizationService.updateMemberRole(selectedOrgId, memberId, role);
      toast.success(t('organization_admin.toast_role_success'));
      await loadOrganizationDetails(selectedOrgId);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('organization_admin.toast_role_error'));
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedOrgId) return;
    try {
      await organizationService.removeMember(selectedOrgId, memberId);
      toast.success(t('organization_admin.toast_remove_success'));
      await loadOrganizationDetails(selectedOrgId);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('organization_admin.toast_remove_error'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('organization_admin.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('organization_admin.subtitle')}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('organization_admin.create_title')}</h2>
        <form onSubmit={handleCreateOrganization} className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder={t('organization_admin.org_name_placeholder')}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
          >
            {t('organization_admin.create_button')}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('organization_admin.my_orgs_title')}</h2>
        {organizations.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('organization_admin.no_orgs')}</p>
        ) : (
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
          >
            {organizations.map((org) => (
              <option key={org.organizationId} value={org.organizationId}>
                {org.organization.name} ({org.role})
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedOrgId && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('organization_admin.members_title', { name: selectedOrganization?.name })}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('organization_admin.your_role', { role: membershipRole || 'MEMBER' })}
              </p>
            </div>
          </div>

          {canManageMembers && (
            <form onSubmit={handleInvite} className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t('organization_admin.member_email_placeholder')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleSelectSuggestion(user)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {(user.firstName || user.lastName)
                            ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                            : user.email}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
              >
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
              >
                {t('organization_admin.add_button')}
              </button>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/40">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">{t('organization_admin.table_member')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">{t('organization_admin.table_role')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">{t('organization_admin.table_last_active')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">{t('organization_admin.table_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loadingMembers ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      {t('organization_admin.loading')}
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      {t('organization_admin.no_members')}
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <tr key={member.id}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {member.user.firstName || member.user.lastName
                            ? `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim()
                            : member.user.email}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{member.user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {canManageMembers && (membershipRole === 'OWNER' || member.role !== 'OWNER') ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleUpdate(member.id, e.target.value as 'OWNER' | 'ADMIN' | 'MEMBER')}
                            className="px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
                          >
                            {(membershipRole === 'OWNER' ? ROLE_OPTIONS : NON_OWNER_ROLE_OPTIONS).map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm text-gray-700 dark:text-gray-300">{member.role}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {new Date(member.user.lastActiveAt).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManageMembers && member.role !== 'OWNER' && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 text-sm"
                          >
                            {t('organization_admin.remove_button')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
