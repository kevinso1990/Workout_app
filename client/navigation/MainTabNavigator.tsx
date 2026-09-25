import React, { useMemo } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import MyPlansScreen from "@/screens/MyPlansScreen";
import ExercisesScreen from "@/screens/ExercisesScreen";
import CalendarScreen from "@/screens/CalendarScreen";
import ProgressScreen from "@/screens/ProgressScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import { useTheme } from "@/hooks/useTheme";
import { HeaderTitle } from "@/components/HeaderTitle";
import { Colors } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";

export type MainTabParamList = {
  MyPlans: undefined;
  Exercises: undefined;
  Calendar: undefined;
  Progress: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Active-tab treatment.
 *
 * Active and inactive previously differed only in brightness — chalk against
 * chalkDim — and on the blurred dark bar both simply read as "light grey", so
 * you could not tell at a glance which tab you were on. The active tab now gets
 * a positive marker (a chalk-tinted pill behind the glyph) and the inactive
 * ones drop to chalkFaint, which widens the gap in both directions instead of
 * relying on a shade difference alone.
 */
function TabBarIcon({
  name,
  color,
  focused,
}: {
  name: keyof typeof Feather.glyphMap;
  color: string;
  focused: boolean;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Feather name={name} size={20} color={color} />
    </View>
  );
}

function TabBarLabel({
  label,
  color,
  focused,
}: {
  label: string;
  color: string;
  focused: boolean;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Text style={[styles.tabLabel, focused && styles.tabLabelActive, { color }]}>
      {label}
    </Text>
  );
}

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Tab.Navigator
        initialRouteName="MyPlans"
        screenOptions={{
          tabBarActiveTintColor: theme.chalk,
          tabBarInactiveTintColor: theme.chalkFaint,
          tabBarItemStyle: { paddingTop: 6 },
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
          // Frosted-glass header background (matches the tab bar). Without this
          // the transparent header let content scroll straight under the logo
          // with no separation — the logo looked like it was covering the page.
          headerBackground: () =>
            Platform.OS === "ios" ? (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : null,
          headerStyle: {
            backgroundColor: Platform.select({
              ios: "transparent",
              android: theme.backgroundRoot,
              web: theme.backgroundRoot,
            }),
          },
          sceneStyle: {
            backgroundColor: theme.backgroundRoot,
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
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="clipboard" color={color} focused={focused} />
            ),
            tabBarLabel: ({ color, focused }) => (
              <TabBarLabel label={t("nav.plans")} color={color} focused={focused} />
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
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="search" color={color} focused={focused} />
            ),
            tabBarLabel: ({ color, focused }) => (
              <TabBarLabel label={t("nav.exercises")} color={color} focused={focused} />
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
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="calendar" color={color} focused={focused} />
            ),
            tabBarLabel: ({ color, focused }) => (
              <TabBarLabel label={t("nav.calendar")} color={color} focused={focused} />
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
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="trending-up" color={color} focused={focused} />
            ),
            tabBarLabel: ({ color, focused }) => (
              <TabBarLabel label={t("nav.progress")} color={color} focused={focused} />
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
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="user" color={color} focused={focused} />
            ),
            tabBarLabel: ({ color, focused }) => (
              <TabBarLabel label={t("nav.profile")} color={color} focused={focused} />
            ),
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  iconWrap: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    // Chalk at low alpha over the blurred bar: reads as material, not as a
    // coloured highlight, and keeps the glyph legible on top.
    backgroundColor: "rgba(236,233,225,0.16)",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  tabLabelActive: {
    fontWeight: "700",
  },
});
