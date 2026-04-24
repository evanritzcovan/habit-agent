import { TabEmptyState } from "@/components/shell/TabEmptyState";

/** Track: history and stats (Phase 12). Pastel yellow shell. */
export default function TrackScreen() {
  return (
    <TabEmptyState subtitle="History and trends" variant="track">
      Completion history, rates, and weekly overview will land here. Per-habit stats and
      cross-habit summaries will appear after you start logging steps.
    </TabEmptyState>
  );
}
