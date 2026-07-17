import "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { WorkspaceProvider } from "./lib/store";
import { registerForPush } from "./lib/push";
import { colors } from "./lib/theme";
import type { RootStackParamList, TabsParamList } from "./lib/navigation";
import { AuthScreen } from "./screens/AuthScreen";
import { ListScreen } from "./screens/ListScreen";
import { BoardScreen } from "./screens/BoardScreen";
import { CalendarScreen } from "./screens/CalendarScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TaskDetailScreen } from "./screens/TaskDetailScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { PaywallScreen } from "./screens/PaywallScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabsParamList>();

const TAB_ICON: Record<keyof TabsParamList, string> = {
  List: "☰",
  Board: "▦",
  Calendar: "▤",
  Settings: "⚙",
};

function AppTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: "center",
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ color }) => (
          <TabIcon glyph={TAB_ICON[route.name]} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="List" component={ListScreen} options={{ title: "My Tasks" }} />
      <Tabs.Screen name="Board" component={BoardScreen} />
      <Tabs.Screen name="Calendar" component={CalendarScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontSize: 18, color }}>{glyph}</Text>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Register this device for push once signed in (#42). Best-effort.
  useEffect(() => {
    if (session?.user.id) registerForPush(session.user.id).catch(() => {});
  }, [session?.user.id]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        {session ? (
          <WorkspaceProvider userId={session.user.id}>
            <NavigationContainer>
              <Stack.Navigator>
                <Stack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
                <Stack.Screen
                  name="TaskDetail"
                  component={TaskDetailScreen}
                  options={{ title: "Task", presentation: "modal" }}
                />
                <Stack.Screen
                  name="Notifications"
                  component={NotificationsScreen}
                  options={{ title: "Notifications", presentation: "modal" }}
                />
                <Stack.Screen
                  name="Paywall"
                  component={PaywallScreen}
                  options={{ title: "Upgrade", presentation: "modal" }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </WorkspaceProvider>
        ) : (
          <AuthScreen />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
