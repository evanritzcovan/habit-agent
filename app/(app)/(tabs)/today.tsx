import { TabEmptyState } from "@/components/shell/TabEmptyState";

/** Today: due steps across habits (Phase 9). */
export default function TodayScreen() {
  return (
    <TabEmptyState title="Today" variant="today">
      When you have habits with active plans, steps due today will show up here. Nothing due
      yet—add a habit from Build or Break first.
    </TabEmptyState>
  );
}
