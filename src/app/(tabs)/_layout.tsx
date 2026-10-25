import AppTabs from '@/components/app-tabs';
import { useOpenCloseFromReminder } from '@/services/close-reminder';

export default function TabLayout() {
  useOpenCloseFromReminder();
  return <AppTabs />;
}
