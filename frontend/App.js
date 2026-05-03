import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

import AuthScreen       from './screens/AuthScreen';
import DashboardScreen  from './screens/DashboardScreen';
import PredictionScreen from './screens/PredictionScreen';
import ChatScreen       from './screens/ChatScreen';
import AlertesScreen    from './screens/AlertesScreen';
import FertilizerScreen from './screens/FertilizerScreen';
import StorageScreen    from './screens/StorageScreen';
 
const Tab       = createBottomTabNavigator();
const Stack     = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

// ── Icônes SVG ────────────────────────────────────────────────────────────────

function IconHome({ color }) {
  return (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"
        stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
      <Rect x="9" y="13" width="6" height="8" rx="1"
        stroke={color} strokeWidth="1.8" fill="none"/>
    </Svg>
  );
}

function IconLeaf({ color }) {
  return (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <Path d="M12 22V12" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <Path d="M12 12C12 7 7 3 3 3c0 5 3 9 9 9z"
        stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
      <Path d="M12 12c0-5 5-9 9-9-1 5-4 9-9 9z"
        stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
    </Svg>
  );
}

function IconFlask({ color }) {
  return (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <Path d="M9 3h6M9 3v7l-4 9a1 1 0 0 0 .9 1.5h12.2a1 1 0 0 0 .9-1.5L15 10V3"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <Path d="M7.5 16h9" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </Svg>
  );
}

function IconChat({ color }) {
  return (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
      <Path d="M8 10h8M8 13h5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </Svg>
  );
}

function IconBell({ color }) {
  return (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
      <Path d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </Svg>
  );
}

function IconTrend({ color }) {
  return (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <Path d="M3 17l5-5 4 4 7-8" stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M15 6h4v4" stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

// ── Dot actif sous l'icône ────────────────────────────────────────────────────
function TabIcon({ Icon, color, focused }) {
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <Icon color={color} />
      {focused && (
        <View style={{
          width: 4, height: 4, borderRadius: 2,
          backgroundColor: '#3a7d44',
        }} />
      )}
    </View>
  );
}

// ── Dashboard Stack ───────────────────────────────────────────────────────────
function DashboardStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DashboardMain"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Prediction"
        component={PredictionScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// ── Main Tabs ─────────────────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor:   '#2d5a27',
        tabBarInactiveTintColor: '#95a5a6',
        tabBarStyle: {
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e8ede4',
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 0,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Accueil"
        component={DashboardStack}
        options={{
          tabBarIcon: ({ color, focused }) =>
            <TabIcon Icon={IconHome} color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Prédiction"
        component={PredictionScreen}
        options={{
          title: 'Prédiction',
          tabBarIcon: ({ color, focused }) =>
            <TabIcon Icon={IconLeaf} color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Fertilizer"
        component={FertilizerScreen}
        options={{
          title: 'Fertilisant',
          tabBarIcon: ({ color, focused }) =>
            <TabIcon Icon={IconFlask} color={color} focused={focused} />,
        }}
      />
<Tab.Screen
  name="Marche"
  component={StorageScreen}
  options={{
    title: 'Marché',
    tabBarIcon: ({ color, focused }) =>
      <TabIcon Icon={IconTrend} color={color} focused={focused} />,
  }}
/>
      <Tab.Screen
        name="Chat IA"
        component={ChatScreen}
        options={{
          title: 'Expert IA',
          tabBarIcon: ({ color, focused }) =>
            <TabIcon Icon={IconChat} color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Alertes"
        component={AlertesScreen}
        options={{
          title: 'Alertes',
          tabBarIcon: ({ color, focused }) =>
            <TabIcon Icon={IconBell} color={color} focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Splash" component={AuthScreen} />
        <RootStack.Screen name="Auth"   component={MainTabs} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}