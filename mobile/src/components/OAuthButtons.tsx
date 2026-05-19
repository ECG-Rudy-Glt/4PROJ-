import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import api from '../services/api';

WebBrowser.maybeCompleteAuthSession();

const BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'https://supfile.fr').replace(/\/api\/?$/, '');

type Providers = { google: boolean; github: boolean };

interface Props {
  onTokenReceived: (token: string) => void;
}

export default function OAuthButtons({ onTokenReceived }: Props) {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [loading, setLoading] = useState<'google' | 'github' | null>(null);

  useEffect(() => {
    api.get('/auth/providers')
      .then((res) => setProviders(res.data?.data ?? res.data))
      .catch(() => setProviders({ google: false, github: false }));
  }, []);

  if (!providers || (!providers.google && !providers.github)) return null;

  const handleOAuth = async (provider: 'google' | 'github') => {
    setLoading(provider);
    try {
      const url = `${BASE}/api/auth/${provider}?state=mobile`;
      const result = await WebBrowser.openAuthSessionAsync(url, 'supfile://auth/callback');
      if (result.type === 'success' && result.url) {
        const parsed = new URL(result.url);
        const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const token = hashParams.get('token') || parsed.searchParams.get('token');
        if (token) onTokenReceived(decodeURIComponent(token));
      }
    } catch {
      // user cancelled or error
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou continuer avec</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={[styles.row, providers.google && providers.github ? styles.row2 : styles.row1]}>
        {providers.google && (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => handleOAuth('google')}
            disabled={!!loading}
            activeOpacity={0.8}
          >
            {loading === 'google' ? (
              <ActivityIndicator size="small" color={colors.neutral[600]} />
            ) : (
              <>
                <GoogleIcon />
                <Text style={styles.btnText}>Google</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {providers.github && (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => handleOAuth('github')}
            disabled={!!loading}
            activeOpacity={0.8}
          >
            {loading === 'github' ? (
              <ActivityIndicator size="small" color={colors.neutral[600]} />
            ) : (
              <>
                <Ionicons name="logo-github" size={18} color={colors.neutral[700]} />
                <Text style={styles.btnText}>GitHub</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function GoogleIcon() {
  return (
    <View style={{ width: 18, height: 18 }}>
      {/* Simple colored G using text — no SVG needed */}
      <Text style={{ fontSize: 14, fontWeight: '700', color: '#4285F4', lineHeight: 18 }}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.neutral[200],
  },
  dividerText: {
    ...typography.caption,
    color: colors.neutral[400],
  },
  row: {
    gap: spacing.sm,
  },
  row1: {
    flexDirection: 'column',
  },
  row2: {
    flexDirection: 'row',
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  btnText: {
    ...typography.body,
    color: colors.neutral[700],
    fontWeight: '500',
  },
});
