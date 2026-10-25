import AppTabs from '@/components/app-tabs';
import { useHomeWidgetSync } from '@/hooks/use-home-widget-sync';
import { useOpenCloseFromReminder } from '@/services/close-reminder';

export default function TabLayout() {
  useOpenCloseFromReminder();
  useHomeWidgetSync();
  return <AppTabs />;
}
