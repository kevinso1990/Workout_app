import React, { useMemo, useRef } from "react";
import { StyleSheet, Pressable, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import type { Palette } from "@/constants/palettes";
import { useTheme } from "@/hooks/useTheme";

export type SwipeAction = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  /** Destructive actions take the error colour and sit outermost, as on iOS. */
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  actions: SwipeAction[];
  children: React.ReactNode;
};

/**
 * Swipe a row left to reveal its actions — the gesture iOS users reach for
 * before they look for a menu.
 *
 * This does not replace the existing buttons. On iOS the swipe is a shortcut,
 * not the only route: the "..." menu stays for discoverability and for anyone
 * who does not swipe, and both call the same handler, so confirmation and
 * error handling cannot drift apart between them.
 *
 * The row closes itself before running the action. Leaving it open while an
 * alert is up strands it half-swiped behind the dialog, and if the row is
 * deleted the open state outlives the row it belonged to.
 */
export function SwipeRowActions({ actions, children }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const ref = useRef<Swipeable>(null);

  if (actions.length === 0) return <>{children}</>;

  return (
    <Swipeable
      ref={ref}
      overshootRight={false}
      rightThreshold={40}
      friction={2}
      onSwipeableWillOpen={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      renderRightActions={() => (
        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => {
                ref.current?.close();
                a.onPress();
              }}
              style={[
                styles.action,
                { backgroundColor: a.destructive ? theme.error : theme.ironElevated3 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              testID={`swipe-action-${a.icon}`}
            >
              <Feather
                name={a.icon}
                size={18}
                color={a.destructive ? "#FFFFFF" : theme.chalk}
              />
              <ThemedText
                style={[
                  styles.label,
                  { color: a.destructive ? "#FFFFFF" : theme.chalk },
                ]}
                numberOfLines={1}
              >
                {a.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}
    >
      {children}
    </Swipeable>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  actions: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  action: {
    width: 84,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
});
