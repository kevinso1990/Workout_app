import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { ThemedText } from "@/components/ThemedText";

interface HeaderTitleProps {
  title?: string;
  /** When true, show brand logo instead of text (default for My Plans). */
  brand?: boolean;
}

export function HeaderTitle({ title, brand = false }: HeaderTitleProps) {
  const insets = useSafeAreaInsets();

  if (brand || !title || title === "TrackYourLift" || title === "Track Your Lift") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <BrandLogo height={38} centered />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ThemedText style={styles.title}>{title}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
});
