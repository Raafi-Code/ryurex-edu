import { StatsDetailContent } from './stats-detail-content';
import CompactNavbar from '@/components/CompactNavbar';

export const metadata = {
  title: 'Progress Statistics | RyuLearn',
  description: 'Track your vocabulary learning progress with detailed statistics and charts',
};

export default function ProgressStatsPage() {
  return (
    <>
      <CompactNavbar title="Learning Progress" />
      <StatsDetailContent />
    </>
  );
}
