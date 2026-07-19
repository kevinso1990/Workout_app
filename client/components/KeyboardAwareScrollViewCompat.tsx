import React from "react";
import { ScrollView, ScrollViewProps } from "react-native";

type Props = ScrollViewProps;

/**
 * Temporary fallback without react-native-keyboard-controller
 */
export const KeyboardAwareScrollViewCompat = React.forwardRef<
  ScrollView,
  Props
>(function KeyboardAwareScrollViewCompat(
  { children, keyboardShouldPersistTaps = "handled", ...props },
  ref,
) {
  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </ScrollView>
  );
});
