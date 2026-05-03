'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function ManagerDashboardPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Manager Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Coming in Phase 6 — Team & user analytics with scope filter
        </p>
      </div>

      <Card>
        <CardContent className="py-16 flex flex-col items-center text-center gap-3">
          <Construction className="h-12 w-12 text-muted-foreground/50" />
          <div>
            <p className="font-medium">Under Construction</p>
            <p className="text-sm text-muted-foreground mt-1">
              Manager Dashboard is being rebuilt with team-scoped queries.
              <br />
              For now, please use the standard Dashboard.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}