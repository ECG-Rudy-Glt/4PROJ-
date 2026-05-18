import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../stores/useAuthStore';
import { authService } from '../services/authService';
import { colors } from '../theme/colors';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import MfaVerifyScreen from '../screens/auth/MfaVerifyScreen';
import TabNavigator from './TabNavigator';
import TrashScreen from '../screens/main/TrashScreen';
import AdminScreen from '../screens/main/AdminScreen';
import VaultScreen from '../screens/main/VaultScreen';
import AuditScreen from '../screens/main/AuditScreen';
import { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, isLoading, hydrated } = useAuthStore();
  const hydrate = useAuthStore((s) => s.hydrate);
  const setUser = useAuthStore((s) => s.setUser);
  const setSessionContext = useAuthStore((s) => s.setSessionContext);
  const logout = useAuthStore((s) => s.logout);

  // Hydrater le token au lancement
  useEffect(() => {
    hydrate();
  }, []);

  // Charger le profil une fois authentifié
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    authService
      .getProfile()
      .then(({ user, session }) => {
        setUser(user);
        if (session) setSessionContext(session);
      })
      .catch((err) => {
        // Ne déconnecter que si le token est explicitement rejeté (401)
        // Une erreur réseau ne doit pas déconnecter l'utilisateur
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
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="MfaVerify" component={MfaVerifyScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
