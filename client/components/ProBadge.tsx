/**
 * ProBadge — lightweight "coming soon" placeholder for Pro-gated features.
 *
 * Rules:
 * - Shown only when SUBSCRIPTIONS_ENABLED is false (i.e. always in current builds).
 * - Never blocks access to the feature — the feature content is still rendered.
 * - Communicates to the user that this area will be part of Pro later.
 *
 * Usage:
 *   <ProBadge feature="Advanced muscle-balance analytics" />
 *   {/* the actual feature content still follows *\/}
 */

import React from "react";
import { SUBSCRIPTIONS_ENABLED } from "../lib/subscriptionConfig";

interface ProBadgeProps {
  /** Short feature description shown in the banner text. */
  feature?: string;
  /**
   * When true the badge renders as a compact inline pill rather than a
   * full-width card-style banner.
   */
  compact?: boolean;
}

export function ProBadge({ feature, compact = false }: ProBadgeProps) {
  // If subscriptions are enabled and we're doing real Pro-gating, hide this
  // placeholder — real paywall UI would replace it in a future release.
  if (SUBSCRIPTIONS_ENABLED) return null;

  const label = feature ? `${feature} will be part of Pro` : "This feature will be part of Pro";

  if (compact) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          padding: "2px 8px",
          borderRadius: 999,
          background: "rgba(79,142,247,0.12)",
          color: "var(--color-accent, #4f8ef7)",
          lineHeight: 1.6,
        }}
      >
        ✦ Pro · coming soon
      </span>
    );
  }

  return (
    <div
      style={{
        borderRadius: "0.75rem",
        padding: "10px 14px",
        background: "rgba(79,142,247,0.07)",
        border: "1px solid rgba(79,142,247,0.18)",
        marginBottom: 8,
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>✦</span>
      <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary, #888)", lineHeight: 1.5 }}>
        <strong style={{ color: "var(--color-accent, #4f8ef7)", fontWeight: 600 }}>
          {label} in a future update.
        </strong>{" "}
        For now, it&rsquo;s available to everyone while we test.
      </p>
    </div>
  );
}

export default ProBadge;
