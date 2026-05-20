import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useColors, AppColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';

WebBrowser.maybeCompleteAuthSession();

const BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'https://supfile.fr').replace(/\/api\/?$/, '');

interface Props {
  onTokenReceived: (token: string) => void;
}

export default function OAuthButtons({ onTokenReceived }: Props) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState<'google' | 'github' | null>(null);

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
      // user cancelled ou erreur réseau
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

      <View style={styles.row}>
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
      </View>
    </View>
  );
}

const GOOGLE_LOGO_URI = 'https://developers.google.com/identity/images/g-logo.png';

function GoogleIcon() {
  return (
    <Image
      source={{ uri: GOOGLE_LOGO_URI }}
      style={{ width: 18, height: 18 }}
      contentFit="contain"
      cachePolicy="disk"
    />
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
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
    backgroundColor: c.neutral[200],
  },
  dividerText: {
    ...typography.caption,
    color: c.neutral[400],
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.neutral[200],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  btnText: {
    ...typography.body,
    color: c.neutral[700],
    fontWeight: '500',
  },
});
