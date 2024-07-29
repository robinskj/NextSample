// note: loading.tsx is a special file built on top of Suspense, 
// displays fallback UI while page content loads

import DashboardSkeleton from '@/app/ui/skeletons';
 
export default function Loading() {
  return <DashboardSkeleton />;
}