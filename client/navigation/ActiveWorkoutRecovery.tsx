import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  createNavigationContainerRef,
  CommonActions,
} from "@react-navigation/native";

import { loadActiveWorkoutDraft } from "@/lib/activeWorkoutPersistence";
import { flushWorkoutSyncQueue } from "@/lib/workoutSessionSyncQueue";
import { toast } from "@/lib/toast";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export const rootNavigationRef =
  createNavigationContainerRef<RootStackParamList>();

type Props = {
  bootstrapReady: boolean;
  initialRoute: keyof RootStackParamList;
};

/**
 * After bootstrap, restore an in-progress workout or flush the offline sync queue.
 */
export function ActiveWorkoutRecovery({ bootstrapReady, initialRoute }: Props) {
  const { t } = useTranslation();
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!bootstrapReady || restoredRef.current) return;
    if (!rootNavigationRef.isReady()) return;
    if (initialRoute !== "Main") return;

    void (async () => {
      const draft = await loadActiveWorkoutDraft();
      if (!draft) return;

      restoredRef.current = true;
      void flushWorkoutSyncQueue();

      rootNavigationRef.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: "Main" },
            {
              name: "ActiveWorkout",
              params: {
                planId: draft.route.planId,
                planName: draft.route.planName,
                dayIndex: draft.route.dayIndex,
                restored: true,
              },
            },
          ],
        }),
      );

      toast.success(t("activeWorkout.offline.restored"));
    })();
  }, [bootstrapReady, initialRoute, t]);

  return null;
}
