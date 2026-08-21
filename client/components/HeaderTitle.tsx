import React from "react";
import { View, StyleSheet } from "react-native";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { ThemedText } from "@/components/ThemedText";
import { FontFamily } from "@/constants/theme";

interface HeaderTitleProps {
  title?: string;
  /** When true, show brand wordmark instead of text (default for My Plans). */
  brand?: boolean;
}

export function HeaderTitle({ title, brand = false }: HeaderTitleProps) {
  // React Navigation already positions the title inside the (safe-area aware)
  // header bar — adding our own top inset here pushed the mark down into the
  // page content, where it floated over the list. Let the header place it.
  if (brand || !title || title === "TrackYourLift" || title === "Track Your Lift") {
    return (
      <View style={styles.container}>
        <BrandLogo height={26} centered />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedText style={styles.title} numberOfLines={1}>
        {title}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
  },
  title: {
    fontSize: 17,
    fontFamily: FontFamily.displaySemi,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
