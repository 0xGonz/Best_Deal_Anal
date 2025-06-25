/**
 * Capital View Tabs Component
 * 
 * Modular tab system for switching between different capital allocation views
 * Integrates with ModularTotalsRow for dynamic total calculations
 */

import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/services/formatters';
import type { FundAllocation } from '@/lib/types';
import type { CapitalView } from './ModularTotalsRow';

interface CapitalViewTabsProps {
  allocations: FundAllocation[];
  activeView: CapitalView;
  onViewChange: (view: CapitalView) => void;
  className?: string;
}

interface TabMetrics {
  amount: number;
  percentage: number;
  count: number;
}

export function CapitalViewTabs({ 
  allocations, 
  activeView, 
  onViewChange, 
  className 
}: CapitalViewTabsProps) {

  const calculateTabMetrics = (): Record<CapitalView, TabMetrics> => {
    if (!allocations || allocations.length === 0) {
      return {
        committed: { amount: 0, percentage: 0, count: 0 },
        called: { amount: 0, percentage: 0, count: 0 },
        paid: { amount: 0, percentage: 0, count: 0 },
        uncalled: { amount: 0, percentage: 0, count: 0 },
        outstanding: { amount: 0, percentage: 0, count: 0 }
      };
    }

    let totalCommitted = 0;
    let totalCalled = 0;
    let totalPaid = 0;
    let totalUncalled = 0;
    let totalOutstanding = 0;

    // Count allocations by status for each view
    let committedCount = 0;
    let calledCount = 0;
    let paidCount = 0;
    let uncalledCount = 0;
    let outstandingCount = 0;

    allocations.forEach(allocation => {
      const committed = allocation.amount || 0;
      const called = allocation.calledAmount || 0;
      const paid = allocation.paidAmount || 0;
      const uncalled = committed - called;
      const outstanding = called - paid;

      totalCommitted += committed;
      totalCalled += called;
      totalPaid += paid;
      totalUncalled += uncalled;
      totalOutstanding += outstanding;

      // Count allocations with significant amounts in each category
      if (committed > 0) committedCount++;
      if (called > 0) calledCount++;
      if (paid > 0) paidCount++;
      if (uncalled > 0) uncalledCount++;
      if (outstanding > 0) outstandingCount++;
    });

    // Calculate percentages based on committed capital
    const committedBase = totalCommitted > 0 ? totalCommitted : 1;

    return {
      committed: {
        amount: totalCommitted,
        percentage: 100,
        count: committedCount
      },
      called: {
        amount: totalCalled,
        percentage: (totalCalled / committedBase) * 100,
        count: calledCount
      },
      paid: {
        amount: totalPaid,
        percentage: (totalPaid / committedBase) * 100,
        count: paidCount
      },
      uncalled: {
        amount: totalUncalled,
        percentage: (totalUncalled / committedBase) * 100,
        count: uncalledCount
      },
      outstanding: {
        amount: totalOutstanding,
        percentage: totalCalled > 0 ? (totalOutstanding / totalCalled) * 100 : 0,
        count: outstandingCount
      }
    };
  };

  const getTabConfig = (view: CapitalView) => {
    const configs = {
      committed: {
        label: 'Committed',
        description: 'Total commitments',
        color: 'bg-blue-100 text-blue-800',
        icon: '💰'
      },
      called: {
        label: 'Called',
        description: 'Capital called',
        color: 'bg-amber-100 text-amber-800',
        icon: '📞'
      },
      paid: {
        label: 'Paid',
        description: 'Capital funded',
        color: 'bg-green-100 text-green-800',
        icon: '✅'
      },
      uncalled: {
        label: 'Uncalled',
        description: 'Remaining to call',
        color: 'bg-gray-100 text-gray-800',
        icon: '⏳'
      },
      outstanding: {
        label: 'Outstanding',
        description: 'Awaiting payment',
        color: 'bg-red-100 text-red-800',
        icon: '⚠️'
      }
    };
    return configs[view];
  };

  const metrics = calculateTabMetrics();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Tab Navigation */}
      <Tabs value={activeView} onValueChange={(value) => onViewChange(value as CapitalView)}>
        <TabsList className="grid w-full grid-cols-5">
          {(Object.keys(metrics) as CapitalView[]).map((view) => {
            const metric = metrics[view];
            const config = getTabConfig(view);
            const isActive = activeView === view;
            
            return (
              <TabsTrigger 
                key={view} 
                value={view}
                className={`flex flex-col p-3 h-auto ${isActive ? 'bg-white shadow-sm' : ''}`}
              >
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs">{config.icon}</span>
                  <span className="font-medium text-sm">{config.label}</span>
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  {config.description}
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-sm">
                    {formatCurrency(metric.amount, { compact: true })}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${config.color} border-current`}
                    >
                      {metric.percentage.toFixed(0)}%
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {metric.count}
                    </span>
                  </div>
                </div>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Quick Metrics Summary */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
        <div className="text-sm font-medium text-gray-700">
          Viewing: {getTabConfig(activeView).description}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-gray-600">
            <span className="font-medium">{metrics[activeView].count}</span> allocations
          </div>
          <div className="text-gray-600">
            <span className="font-medium">{metrics[activeView].percentage.toFixed(1)}%</span> of fund
          </div>
          <div className="font-bold text-lg">
            {formatCurrency(metrics[activeView].amount)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CapitalViewTabs;