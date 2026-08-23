import { Text, StyleSheet, type TextProps } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { Typography } from "@/constants/theme";

/**
 * A lineHeight smaller than fontSize clips ascenders/caps (e.g. a heading's
 * "T" losing its top) — this shipped multiple times because a style object
 * set fontSize without its own lineHeight and silently inherited a smaller
 * one from the base type style. Guard it here once, centrally, so no future
 * style object can reintroduce the bug: if the flattened style's fontSize
 * would clip against its lineHeight, compute a safe one automatically.
 */
function withSafeLineHeight(
  style: TextProps["style"],
): TextProps["style"] {
  const flat = StyleSheet.flatten(style) ?? {};
  const fontSize = typeof flat.fontSize === "number" ? flat.fontSize : undefined;
  if (fontSize == null) return style;
  const lineHeight = typeof flat.lineHeight === "number" ? flat.lineHeight : undefined;
  if (lineHeight != null && lineHeight >= fontSize * 1.05) return style;
  return [style, { lineHeight: Math.round(fontSize * 1.25) }];
}

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "display" | "h1" | "h2" | "h3" | "h4" | "body" | "small" | "link";
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "body",
  ...rest
}: ThemedTextProps) {
  const { theme, isDark } = useTheme();

  const getColor = () => {
    if (isDark && darkColor) {
      return darkColor;
    }

    if (!isDark && lightColor) {
      return lightColor;
    }

    if (type === "link") {
      return theme.link;
    }

    return theme.text;
  };

  const getTypeStyle = () => {
    switch (type) {
      case "display":
        return Typography.display;
      case "h1":
        return Typography.h1;
      case "h2":
        return Typography.h2;
      case "h3":
        return Typography.h3;
      case "h4":
        return Typography.h4;
      case "body":
        return Typography.body;
      case "small":
        return Typography.small;
      case "link":
        return Typography.link;
      default:
        return Typography.body;
    }
  };

  const merged = [{ color: getColor() }, getTypeStyle(), style];

  return <Text style={withSafeLineHeight(merged)} {...rest} />;
}
