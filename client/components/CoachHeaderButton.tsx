import React from "react";
import { Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

/** Header shortcut into the coach chat. */
export function CoachHeaderButton() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        navigation.navigate("CoachChat");
      }}
      hitSlop={10}
      style={{ paddingHorizontal: 16 }}
      accessibilityRole="button"
      accessibilityLabel={t("coachChat.open")}
      testID="button-open-coach-chat"
    >
      <Feather name="message-circle" size={22} color={theme.text} />
    </Pressable>
  );
}
