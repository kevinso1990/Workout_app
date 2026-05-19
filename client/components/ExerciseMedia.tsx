import React, { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";

interface ExerciseMediaProps {
  exerciseName: string;
  compact?: boolean;
  showInstructions?: boolean;
}

const mediaCache = new Map<string, any[]>();

export default function ExerciseMedia({ exerciseName, compact = false, showInstructions = false }: ExerciseMediaProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    if (mediaCache.has(exerciseName)) {
      setData(mediaCache.get(exerciseName)!);
      return;
    }
    setLoading(true);
    try {
      const results = await api.searchMuscleWiki(exerciseName);
      mediaCache.set(exerciseName, results);
      setData(results);
    } catch {
      setData([]);
    }
    setLoading(false);
  }, [exerciseName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <div className="h-8 animate-pulse rounded bg-[var(--color-surface-alt)]" />;
  if (!data || data.length === 0) return null;

  // Pick the result whose name best matches the queried exercise name
  const words = exerciseName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  let bestIdx = 0;
  let bestScore = -1;
  data.forEach((r: any, i: number) => {
    const rName = r.name.toLowerCase();
    const score = words.filter((w: string) => rName.includes(w)).length;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  });
  const match = data[bestIdx];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {match.video_url && (
          <img
            src={match.video_url}
            alt={match.name}
            className="w-10 h-10 rounded-lg object-cover bg-[var(--color-surface-alt)]"
            loading="lazy"
            decoding="async"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        {match.muscles_primary?.length > 0 && (
          <div className="flex gap-1">
            {match.muscles_primary.map((m: string) => (
              <span key={m} className="text-[10px] tag-pill">{m}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {match.video_url && (
          <img
            src={match.video_url}
            alt={match.name}
            className="w-20 h-20 rounded-xl object-cover bg-[var(--color-surface-alt)] flex-shrink-0"
            loading="lazy"
            decoding="async"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="flex-1 min-w-0">
          {match.muscles_primary?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {match.muscles_primary.map((m: string) => (
                <span key={m} className="tag-pill text-[10px]">{m}</span>
              ))}
              {match.muscles_secondary?.map((m: string) => (
                <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">{m}</span>
              ))}
            </div>
          )}
          {match.difficulty && (
            <span className="text-[10px] text-[var(--color-text-muted)]">{t("exerciseMedia.difficulty", { level: match.difficulty })}</span>
          )}
          {match.body_map_front && (
            <div className="flex gap-1 mt-1">
              <img src={match.body_map_front} alt="front" className="h-12 rounded" loading="lazy" />
              {match.body_map_back && <img src={match.body_map_back} alt="back" className="h-12 rounded" loading="lazy" />}
            </div>
          )}
        </div>
      </div>

      {showInstructions && match.correct_steps?.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-[var(--color-accent)] font-semibold"
          >
            {expanded ? t("exerciseMedia.hideInstructions") : t("exerciseMedia.showInstructions")}
          </button>
          {expanded && (
            <ol className="mt-2 space-y-1.5 text-xs text-[var(--color-text-secondary)] list-decimal list-inside">
              {match.correct_steps.map((step: string, i: number) => (
                <li key={i} className="leading-relaxed">{step}</li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
