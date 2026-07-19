module.exports = function (api) {
  api.cache.using(() => process.env.NODE_ENV);
  const isProduction = process.env.NODE_ENV === "production";

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          unstable_transformImportMeta: true,
        },
      ],
    ],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./client",
            "@shared": "./shared",
          },
          extensions: [".ios.js", ".android.js", ".js", ".ts", ".tsx", ".json"],
        },
      ],
      ...(isProduction
        ? [["transform-remove-console", { exclude: ["error"] }]]
        : []),
      "react-native-reanimated/plugin",
    ],
  };
};
