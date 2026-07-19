import React from "react";
import {
  Platform,
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Text,
} from "react-native";

import { ERROR_FALLBACK_COPY } from "@/constants/errorCopy";
import {
  formatCapturedErrorText,
  reloadWebApp,
  type CapturedError,
} from "@/lib/globalErrorReporter";

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
  componentStack?: string;
  source?: string;
};

function buildDetails(
  error: Error,
  componentStack?: string,
  source?: string,
): string {
  const captured: CapturedError = {
    message: error.message || error.name || "Error",
    stack: error.stack ?? "",
    componentStack: componentStack ?? "",
    source: source ?? "react-error-boundary",
    at: Date.now(),
  };
  return formatCapturedErrorText(captured);
}

/**
 * Crash screen — always shows full message + stack (also on production web / Safari).
 * Avoids theme hooks so it still renders if context providers failed.
 */
export function ErrorFallback({
  error,
  resetError,
  componentStack,
  source,
}: ErrorFallbackProps) {
  const details = buildDetails(error, componentStack, source);

  const handleRestart = () => {
    resetError();
    if (Platform.OS === "web") {
      reloadWebApp();
      return;
    }
    void import("expo").then(({ reloadAppAsync }) => reloadAppAsync()).catch(() => {
      resetError();
    });
  };

  const buildTag =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    (window as Window & { __FITPLAN_BUILD_ID?: string }).__FITPLAN_BUILD_ID
      ? `\n\nBuild: ${(window as Window & { __FITPLAN_BUILD_ID?: string }).__FITPLAN_BUILD_ID}`
      : "";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{ERROR_FALLBACK_COPY.title}</Text>
      <Text style={styles.subtitle}>{ERROR_FALLBACK_COPY.subtitle}</Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <Text style={styles.errorText} selectable>
          {details}
          {buildTag}
        </Text>
      </ScrollView>

      <Pressable
        onPress={handleRestart}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{ERROR_FALLBACK_COPY.reload}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#111111",
    paddingTop: Platform.OS === "web" ? 16 : 48,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "web" ? 16 : 32,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    color: "#AAAAAA",
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  scroll: {
    flex: 1,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: "#1C1C1E",
  },
  scrollContent: {
    padding: 12,
  },
  errorText: {
    color: "#F2F2F7",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
  },
  button: {
    backgroundColor: "#34C759",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
});
