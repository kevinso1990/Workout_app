import React from "react";

const animBuilder = () => {
  const self: any = {
    duration: () => self,
    delay: () => self,
    easing: () => self,
    springify: () => self,
    damping: () => self,
    mass: () => self,
    stiffness: () => self,
    restDisplacementThreshold: () => self,
    restSpeedThreshold: () => self,
    withCallback: () => self,
    withInitialValues: () => self,
    randomDelay: () => self,
  };
  return self;
};

const Animated = {
  View: ({ entering: _entering, exiting: _exiting, layout: _layout, ...props }: any) =>
    React.createElement("div", props),
  Text: ({ entering: _entering, ...props }: any) =>
    React.createElement("span", props),
  ScrollView: ({ entering: _entering, ...props }: any) =>
    React.createElement("div", props),
  Image: ({ entering: _entering, ...props }: any) =>
    React.createElement("img", props),
  createAnimatedComponent: (c: any) => c,
  FlatList: ({ data, renderItem, keyExtractor, ...props }: any) =>
    React.createElement("div", props, data?.map((item: any, index: number) =>
      renderItem({ item, index })
    )),
};

export default Animated;
export const FadeInDown = animBuilder();
export const FadeInUp = animBuilder();
export const FadeOut = animBuilder();
export const FadeIn = animBuilder();
export const ZoomIn = animBuilder();
export const ZoomOut = animBuilder();
export const SlideInLeft = animBuilder();
export const SlideOutRight = animBuilder();
export const useAnimatedStyle = (_fn: any) => ({});
export const useSharedValue = (v: any) => ({ value: v, addListener: () => {} });
export const withSpring = (v: any) => v;
export const withTiming = (v: any) => v;
export const withSequence = (...args: any[]) => args[0];
export const withRepeat = (v: any) => v;
export const withDelay = (_d: any, v: any) => v;
export const runOnJS = (fn: any) => fn;
export const runOnUI = (fn: any) => fn;
export const interpolate = (v: any) => v;
export const interpolateColor = (v: any) => v;
export const Extrapolation = { CLAMP: "clamp", EXTEND: "extend" };
export const cancelAnimation = () => {};
export const useAnimatedRef = () => ({ current: null });
export const measure = () => ({});
export const scrollTo = () => {};
