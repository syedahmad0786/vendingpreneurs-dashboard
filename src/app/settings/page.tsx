import { ComingSoon } from "@/components/ComingSoon";

export default function SettingsPage() {
  return (
    <ComingSoon
      title="Settings"
      subtitle="Configure verification schedules, error thresholds, and team access."
      description="This area will house n8n workflow toggles, Airtable field mapping, retry cadences, and Slack alert preferences."
    />
  );
}
