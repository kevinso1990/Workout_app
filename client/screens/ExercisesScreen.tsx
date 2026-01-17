import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ExerciseItem {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
}

const EXERCISE_LIBRARY: ExerciseItem[] = [
  { id: "1", name: "Bench Press", muscleGroup: "Chest", equipment: "Barbell" },
  { id: "2", name: "Incline Dumbbell Press", muscleGroup: "Chest", equipment: "Dumbbells" },
  { id: "3", name: "Cable Flyes", muscleGroup: "Chest", equipment: "Cable" },
  { id: "4", name: "Push-ups", muscleGroup: "Chest", equipment: "Bodyweight" },
  { id: "5", name: "Squat", muscleGroup: "Legs", equipment: "Barbell" },
  { id: "6", name: "Leg Press", muscleGroup: "Legs", equipment: "Machine" },
  { id: "7", name: "Lunges", muscleGroup: "Legs", equipment: "Dumbbells" },
  { id: "8", name: "Leg Curl", muscleGroup: "Legs", equipment: "Machine" },
  { id: "9", name: "Deadlift", muscleGroup: "Back", equipment: "Barbell" },
  { id: "10", name: "Barbell Rows", muscleGroup: "Back", equipment: "Barbell" },
  { id: "11", name: "Lat Pulldown", muscleGroup: "Back", equipment: "Cable" },
  { id: "12", name: "Pull-ups", muscleGroup: "Back", equipment: "Bodyweight" },
  { id: "13", name: "Overhead Press", muscleGroup: "Shoulders", equipment: "Barbell" },
  { id: "14", name: "Lateral Raises", muscleGroup: "Shoulders", equipment: "Dumbbells" },
  { id: "15", name: "Face Pulls", muscleGroup: "Shoulders", equipment: "Cable" },
  { id: "16", name: "Bicep Curls", muscleGroup: "Arms", equipment: "Dumbbells" },
  { id: "17", name: "Tricep Pushdowns", muscleGroup: "Arms", equipment: "Cable" },
  { id: "18", name: "Hammer Curls", muscleGroup: "Arms", equipment: "Dumbbells" },
  { id: "19", name: "Skull Crushers", muscleGroup: "Arms", equipment: "Barbell" },
  { id: "20", name: "Calf Raises", muscleGroup: "Legs", equipment: "Machine" },
];

const MUSCLE_GROUPS = ["All", "Chest", "Back", "Shoulders", "Legs", "Arms"];

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: selected
            ? Colors.light.primary
            : theme.backgroundDefault,
        },
      ]}
    >
      <ThemedText
        style={[
          styles.filterChipText,
          { color: selected ? "#FFFFFF" : theme.text },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ExerciseCard({
  exercise,
  index,
}: {
  exercise: ExerciseItem;
  index: number;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getMuscleGroupColor = (group: string) => {
    const colors: Record<string, string> = {
      Chest: "#FF6B6B",
      Back: "#4ECDC4",
      Shoulders: "#45B7D1",
      Legs: "#96CEB4",
      Arms: "#DDA0DD",
    };
    return colors[group] || Colors.light.primary;
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300)}
      style={styles.cardWrapper}
    >
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          animatedStyle,
          styles.exerciseCard,
          { backgroundColor: theme.backgroundDefault },
        ]}
        testID={`card-exercise-${exercise.id}`}
      >
        <View
          style={[
            styles.exerciseIcon,
            { backgroundColor: getMuscleGroupColor(exercise.muscleGroup) + "20" },
          ]}
        >
          <Feather
            name="activity"
            size={24}
            color={getMuscleGroupColor(exercise.muscleGroup)}
          />
        </View>
        <ThemedText style={styles.exerciseName} numberOfLines={2}>
          {exercise.name}
        </ThemedText>
        <View
          style={[
            styles.muscleTag,
            { backgroundColor: getMuscleGroupColor(exercise.muscleGroup) + "20" },
          ]}
        >
          <ThemedText
            style={[
              styles.muscleTagText,
              { color: getMuscleGroupColor(exercise.muscleGroup) },
            ]}
          >
            {exercise.muscleGroup}
          </ThemedText>
        </View>
        <ThemedText
          style={[styles.equipmentText, { color: theme.textSecondary }]}
        >
          {exercise.equipment}
        </ThemedText>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function ExercisesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");

  const filteredExercises = useMemo(() => {
    return EXERCISE_LIBRARY.filter((exercise) => {
      const matchesSearch = exercise.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesFilter =
        selectedFilter === "All" || exercise.muscleGroup === selectedFilter;
      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, selectedFilter]);

  const handleFilterPress = (filter: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFilter(filter);
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: ExerciseItem;
    index: number;
  }) => <ExerciseCard exercise={item} index={index} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={filteredExercises}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <View
              style={[
                styles.searchContainer,
                { backgroundColor: theme.backgroundDefault },
              ]}
            >
              <Feather name="search" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search exercises..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Feather name="x" size={20} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>
            <FlatList
              horizontal
              data={MUSCLE_GROUPS}
              renderItem={({ item }) => (
                <FilterChip
                  label={item}
                  selected={selectedFilter === item}
                  onPress={() => handleFilterPress(item)}
                />
              )}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersContainer}
            />
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  headerContainer: {
    marginBottom: Spacing.lg,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filtersContainer: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  row: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardWrapper: {
    flex: 1,
    maxWidth: "50%",
  },
  exerciseCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  exerciseIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    textAlign: "center",
    marginBottom: Spacing.sm,
    minHeight: 40,
  },
  muscleTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.xs,
  },
  muscleTagText: {
    fontSize: 12,
    fontWeight: "500",
  },
  equipmentText: {
    fontSize: 12,
  },
});
