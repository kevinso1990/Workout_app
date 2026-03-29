import { ScrollView, ScrollViewProps } from "react-native";

type Props = ScrollViewProps;

/**
 * Temporary fallback without react-native-keyboard-controller
 * to isolate iOS startup crash.
 */
export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  ...props
}: Props) {
  return (
    <ScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </ScrollView>
  );
}
