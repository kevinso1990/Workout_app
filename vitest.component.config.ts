import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

const RNW_CJS = path.resolve(__dirname, "node_modules/react-native-web/dist/cjs/index.js");
const MOCKS = path.resolve(__dirname, "client/__tests__/components/__mocks__");

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["client/__tests__/components/**/*.test.{ts,tsx}"],
    globals: true,
    setupFiles: ["client/__tests__/components/setup.ts"],
    pool: "forks",
    alias: {
      "react-native": RNW_CJS,
      "@/": path.resolve(__dirname, "client") + "/",
      // Expo native packages
      "expo-linear-gradient": path.join(MOCKS, "expo-linear-gradient.tsx"),
      "expo-haptics": path.join(MOCKS, "expo-haptics.ts"),
      "@expo/vector-icons": path.join(MOCKS, "@expo/vector-icons.tsx"),
      // React Native ecosystem
      "react-native-reanimated": path.join(MOCKS, "react-native-reanimated.tsx"),
      "react-native-gesture-handler": path.join(MOCKS, "react-native-gesture-handler.tsx"),
      "react-native-safe-area-context": path.join(MOCKS, "react-native-safe-area-context.tsx"),
      "react-native-screens": path.join(MOCKS, "react-native-screens.tsx"),
      // React Navigation
      "@react-navigation/native": path.join(MOCKS, "@react-navigation/native.tsx"),
      "@react-navigation/native-stack": path.join(MOCKS, "@react-navigation/native-stack.tsx"),
      "@react-navigation/bottom-tabs": path.join(MOCKS, "@react-navigation/bottom-tabs.tsx"),
      "@react-navigation/elements": path.join(MOCKS, "@react-navigation/elements.tsx"),
    },
  },
  resolve: {
    alias: {
      "react-native": RNW_CJS,
      "@/": path.resolve(__dirname, "client") + "/",
      "expo-linear-gradient": path.join(MOCKS, "expo-linear-gradient.tsx"),
      "expo-haptics": path.join(MOCKS, "expo-haptics.ts"),
      "@expo/vector-icons": path.join(MOCKS, "@expo/vector-icons.tsx"),
      "react-native-reanimated": path.join(MOCKS, "react-native-reanimated.tsx"),
      "react-native-gesture-handler": path.join(MOCKS, "react-native-gesture-handler.tsx"),
      "react-native-safe-area-context": path.join(MOCKS, "react-native-safe-area-context.tsx"),
      "react-native-screens": path.join(MOCKS, "react-native-screens.tsx"),
      "@react-navigation/native": path.join(MOCKS, "@react-navigation/native.tsx"),
      "@react-navigation/native-stack": path.join(MOCKS, "@react-navigation/native-stack.tsx"),
      "@react-navigation/bottom-tabs": path.join(MOCKS, "@react-navigation/bottom-tabs.tsx"),
      "@react-navigation/elements": path.join(MOCKS, "@react-navigation/elements.tsx"),
    },
  },
});
