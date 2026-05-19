import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';
import { TabParamList } from '../types';
import DashboardScreen from '../screens/main/DashboardScreen';
import FilesScreen from '../screens/main/FilesScreen';
import FavoritesScreen from '../screens/main/FavoritesScreen';
import SharedScreen from '../screens/main/SharedScreen';
import AIScreen from '../screens/main/AIScreen';
import SettingsScreen from '../screens/main/SettingsScreen';

const Tab = createBottomTabNavigator<TabParamList>();

const tabIcons: Record<string, { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }> = {
  Dashboard: { focused: 'home', default: 'home-outline' },
  Files: { focused: 'folder', default: 'folder-outline' },
  Favorites: { focused: 'heart', default: 'heart-outline' },
  Shared: { focused: 'people', default: 'people-outline' },
  AI: { focused: 'hardware-chip', default: 'hardware-chip-outline' },
  Settings: { focused: 'settings', default: 'settings-outline' },
};

export default function TabNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: colors.neutral[400],
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.neutral[200],
          paddingBottom: 8,
          paddingTop: 8,
          height: 88,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600' as const,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const iconSet = tabIcons[route.name];
          const iconName = focused ? iconSet.focused : iconSet.default;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: t('tabs.dashboard') }} />
      <Tab.Screen name="Files" component={FilesScreen} options={{ tabBarLabel: t('tabs.files') }} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} options={{ tabBarLabel: t('tabs.favorites') }} />
      <Tab.Screen name="Shared" component={SharedScreen} options={{ tabBarLabel: t('tabs.shared') }} />
      <Tab.Screen name="AI" component={AIScreen} options={{ tabBarLabel: t('tabs.ai') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: t('tabs.profile') }} />
    </Tab.Navigator>
  );
}
