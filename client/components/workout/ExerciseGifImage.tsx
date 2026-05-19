import React from "react";
import { type StyleProp, type ImageStyle } from "react-native";
import { Image, type ImageContentFit } from "expo-image";

type ExerciseGifImageProps = {
  uri: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  recyclingKey?: string;
  testID?: string;
  onLoad?: () => void;
  onError?: () => void;
};

/** Hardware-accelerated animated GIF (and static) via expo-image. */
export function ExerciseGifImage({
  uri,
  style,
  contentFit = "cover",
  recyclingKey,
  testID,
  onLoad,
  onError,
}: ExerciseGifImageProps) {
  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      autoplay
      transition={120}
      recyclingKey={recyclingKey ?? uri}
      testID={testID}
      onLoad={onLoad}
      onError={onError}
    />
  );
}
