import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import MyPlansScreen from "@/screens/MyPlansScreen";
import ExercisesScreen from "@/screens/ExercisesScreen";
import CalendarScreen from "@/screens/CalendarScreen";
import ProgressScreen from "@/screens/ProgressScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import { useTheme } from "@/hooks/useTheme";
import { HeaderTitle } from "@/components/HeaderTitle";
import { Colors } from "@/constants/theme";

export type MainTabParamList = {
  MyPlans: undefined;
  Exercises: undefined;
  Calendar: undefined;
  Progress: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Tab.Navigator
        initialRouteName="MyPlans"
        screenOptions={{
          tabBarActiveTintColor: Colors.light.primary,
          tabBarInactiveTintColor: theme.tabIconDefault,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: Platform.select({
              ios: "transparent",
              android: theme.backgroundRoot,
            }),
            borderTopWidth: 0,
            elevation: 0,
          },
          tabBarBackground: () =>
            Platform.OS === "ios" ? (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : null,
          headerTransparent: true,
          headerTintColor: theme.text,
          headerStyle: {
            backgroundColor: Platform.select({
              ios: "transparent",
              android: theme.backgroundRoot,
              web: theme.backgroundRoot,
            }),
          },
          sceneStyle: {
            backgroundColor: "#F5F5F7",
          },
        }}
      >
        <Tab.Screen
          name="MyPlans"
          component={MyPlansScreen}
          options={{
            title: t("nav.plans"),
            headerTitle: () => <HeaderTitle brand />,
            headerTitleAlign: "center",
            tabBarIcon: ({ color, size }) => (
              <Feather name="clipboard" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Exercises"
          component={ExercisesScreen}
          options={{
            title: t("nav.exercises"),
            headerTitle: () => <HeaderTitle brand />,
            headerTitleAlign: "center",
            tabBarIcon: ({ color, size }) => (
              <Feather name="search" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Calendar"
          component={CalendarScreen}
          options={{
            title: t("nav.calendar"),
            headerTitle: () => <HeaderTitle brand />,
            headerTitleAlign: "center",
            tabBarIcon: ({ color, size }) => (
              <Feather name="calendar" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Progress"
          component={ProgressScreen}
          options={{
            title: t("nav.progress"),
            headerTitle: () => <HeaderTitle brand />,
            headerTitleAlign: "center",
            tabBarIcon: ({ color, size }) => (
              <Feather name="trending-up" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: t("nav.profile"),
            headerTitle: () => <HeaderTitle brand />,
            headerTitleAlign: "center",
            tabBarIcon: ({ color, size }) => (
              <Feather name="user" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
