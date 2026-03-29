import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { TabParamList } from '../types';
import DashboardScreen from '../screens/main/DashboardScreen';
import FilesScreen from '../screens/main/FilesScreen';
import FavoritesScreen from '../screens/main/FavoritesScreen';
import SharedScreen from '../screens/main/SharedScreen';
import SettingsScreen from '../screens/main/SettingsScreen';

const Tab = createBottomTabNavigator<TabParamList>();

const tabIcons: Record<string, { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }> = {
  Dashboard: { focused: 'home', default: 'home-outline' },
  Files: { focused: 'folder', default: 'folder-outline' },
  Favorites: { focused: 'star', default: 'star-outline' },
  Shared: { focused: 'people', default: 'people-outline' },
  Settings: { focused: 'settings', default: 'settings-outline' },
};

export default function TabNavigator() {
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
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Accueil' }} />
      <Tab.Screen name="Files" component={FilesScreen} options={{ tabBarLabel: 'Fichiers' }} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} options={{ tabBarLabel: 'Favoris' }} />
      <Tab.Screen name="Shared" component={SharedScreen} options={{ tabBarLabel: 'Partages' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Profil' }} />
    </Tab.Navigator>
  );
}
