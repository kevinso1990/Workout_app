import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), "");

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client"),
      },
    },
    root: path.resolve(__dirname, "client"),
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
    },
    define: {
      "process.env.VITE_RAPIDAPI_KEY": JSON.stringify(env.VITE_RAPIDAPI_KEY ?? ""),
      "process.env.VITE_EXPO_PUBLIC_RAPIDAPI_KEY": JSON.stringify(
        env.VITE_EXPO_PUBLIC_RAPIDAPI_KEY ?? "",
      ),
    },
    server: {
      hmr: true,
      allowedHosts: true,
    },
    optimizeDeps: {
      exclude: [
        "react-native",
        "react-native-reanimated",
        "react-native-gesture-handler",
        "react-native-view-shot",
        "react-native-keyboard-controller",
        "react-native-screens",
        "react-native-safe-area-context",
        "expo",
        "expo-haptics",
        "expo-linear-gradient",
        "expo-blur",
        "expo-glass-effect",
        "expo-sharing",
        "expo-notifications",
        "expo-splash-screen",
        "expo-status-bar",
        "expo-font",
        "@expo/vector-icons",
        "@react-navigation/native",
        "@react-navigation/native-stack",
        "@react-navigation/bottom-tabs",
        "@react-navigation/elements",
        "@react-native-community/slider",
        "@react-native-async-storage/async-storage",
      ],
    },
  };
});
