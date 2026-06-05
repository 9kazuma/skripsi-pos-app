import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/auth/LoginScreen';
import DashboardScreen from '../screens/admin/DashboardScreen';
import ProductsScreen from '../screens/admin/ProductsScreen';
import RestockScreen from '../screens/admin/RestockScreen';
import ReportsScreen from '../screens/admin/ReportsScreen';
import UserManagementScreen from '../screens/admin/UserManagementScreen';
import StockAdjustmentScreen from '../screens/admin/StockAdjustmentScreen';
import SalesHistoryScreen from '../screens/common/SalesHistoryScreen';
import POSScreen from '../screens/cashier/POSScreen';
import ProfileScreen from '../screens/common/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AdminTabs() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Products" component={ProductsScreen} />
      <Tab.Screen name="Users" component={UserManagementScreen} />

      {isOwner && (
        <Tab.Screen name="Reports" component={ReportsScreen} />
      )}

      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function CashierTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="POS" component={POSScreen} />
      <Tab.Screen name="Sales" component={SalesHistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AdminTabs"
        component={AdminTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Restock"
        component={RestockScreen}
        options={{ title: 'Restock Produk' }}
      />
      <Stack.Screen
        name="Adjustment"
        component={StockAdjustmentScreen}
        options={{ title: 'Stock Adjustment / Opname' }}
      />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { user } = useAuth();
  const isOwnerOrManager = user?.role === 'owner' || user?.role === 'manager';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : isOwnerOrManager ? (
        <Stack.Screen name="AdminStack" component={AdminStack} />
      ) : (
        <Stack.Screen name="CashierTabs" component={CashierTabs} />
      )}
    </Stack.Navigator>
  );
}
