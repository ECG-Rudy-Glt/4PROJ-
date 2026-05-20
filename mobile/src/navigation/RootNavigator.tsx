import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../stores/useAuthStore';
import { authService } from '../services/authService';
import { useColors } from '../theme/useColors';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import MfaVerifyScreen from '../screens/auth/MfaVerifyScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import TabNavigator from './TabNavigator';
import TrashScreen from '../screens/main/TrashScreen';
import AdminScreen from '../screens/main/AdminScreen';
import VaultScreen from '../screens/main/VaultScreen';
import AuditScreen from '../screens/main/AuditScreen';
import { RootStackParamList } from '../types';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const colors = useColors();
  const { isAuthenticated, isLoading, hydrated } = useAuthStore();
  const hydrate = useAuthStore((s) => s.hydrate);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);
  const setSessionContext = useAuthStore((s) => s.setSessionContext);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (url.includes('reset-password')) {
        try {
          const parsed = new URL(url);
          const token = parsed.searchParams.get('token');
          if (token && navigationRef.isReady()) {
            navigationRef.navigate('ResetPassword', { token });
          }
        } catch { /* ignore */ }
        return;
      }
      if (!url.includes('auth/callback')) return;
      try {
        const parsed = new URL(url);
        const error = parsed.searchParams.get('error');
        if (error) {
          Toast.show({ type: 'error', text1: 'Connexion OAuth échouée', text2: decodeURIComponent(error) });
          return;
        }
        const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const token = hashParams.get('token') || parsed.searchParams.get('token');
        if (!token) return;
        const decoded = decodeURIComponent(token);
        const { user, session } = await authService.getProfileWithToken(decoded);
        await setAuth(decoded, user, session, undefined);
      } catch {
        Toast.show({ type: 'error', text1: 'Connexion OAuth échouée', text2: 'Veuillez réessayer' });
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    authService
      .getProfile()
      .then(({ user, session }) => {
        setUser(user);
        if (session) setSessionContext(session);
      })
      .catch((err) => {
        if (err?.response?.status === 401) {
          logout();
        }
      });
  }, [hydrated, isAuthenticated]);

  if (!hydrated || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary[50] }}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="Trash" component={TrashScreen} />
          <Stack.Screen name="Admin" component={AdminScreen} />
          <Stack.Screen name="Vault" component={VaultScreen} />
          <Stack.Screen name="Audit" component={AuditScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="MfaVerify" component={MfaVerifyScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
