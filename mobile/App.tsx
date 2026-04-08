import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import RootNavigator from './src/navigation/RootNavigator';
import SocketListener from './src/components/SocketListener';
import { useAuthStore } from './src/stores/useAuthStore';

function AuthedSocket() {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return isAuth ? <SocketListener /> : null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <RootNavigator />
        <AuthedSocket />
        <Toast />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
