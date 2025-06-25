/**
 * Modular Totals Row Component
 * 
 * Dynamically calculates and displays totals based on the active capital view tab
 * Scales with any number of allocations and adapts to different metric types
 */

import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/services/formatters';
import type { FundAllocation } from '@/lib/types';

export type CapitalView = 'committed' | 'called' | 'paid' | 'uncalled' | 'outstanding';

interface ModularTotalsRowProps {
  allocations: FundAllocation[];
  capitalView: CapitalView;
  className?: string;
}

interface TotalsMetrics {
  totalAmount: number;
  totalWeight: number;
  totalMarketValue: number;
  totalReturned: number;
  averageMOIC: number;
  averageIRR: number;
  count: number;
  label: string;
  description: string;
}

export function ModularTotalsRow({ allocations, capitalView, className }: ModularTotalsRowProps) {
  
  const calculateTotals = (): TotalsMetrics => {
    if (!allocations || allocations.length === 0) {
      return {
        totalAmount: 0,
        totalWeight: 0,
        totalMarketValue: 0,
        totalReturned: 0,
        averageMOIC: 0,
        averageIRR: 0,
        count: 0,
        label: getViewLabel(capitalView),
        description: getViewDescription(capitalView)
      };
    }

    // Calculate base totals
    let totalAmount = 0;
    let totalWeight = 0;
    let totalMarketValue = 0;
    let totalReturned = 0;
    let totalMOIC = 0;
    let totalIRR = 0;
    let validMOICCount = 0;
    let validIRRCount = 0;

    allocations.forEach(allocation => {
      // Calculate amount based on capital view
      const amount = getAmountForView(allocation, capitalView);
      totalAmount += amount;
      
      totalWeight += allocation.portfolioWeight || 0;
      totalMarketValue += allocation.marketValue || 0;
      totalReturned += allocation.totalReturned || 0;
      
      // Track MOIC and IRR for averaging
      if (allocation.moic && allocation.moic > 0) {
        totalMOIC += allocation.moic;
        validMOICCount++;
      }
      
      if (allocation.irr && allocation.irr !== 0) {
        totalIRR += allocation.irr;
        validIRRCount++;
      }
    });

    return {
      totalAmount,
      totalWeight,
      totalMarketValue,
      totalReturned,
      averageMOIC: validMOICCount > 0 ? totalMOIC / validMOICCount : 0,
      averageIRR: validIRRCount > 0 ? totalIRR / validIRRCount : 0,
      count: allocations.length,
      label: getViewLabel(capitalView),
      description: getViewDescription(capitalView)
    };
  };

  const getAmountForView = (allocation: FundAllocation, view: CapitalView): number => {
    switch (view) {
      case 'committed':
        return allocation.amount || 0;
      case 'called':
        return allocation.calledAmount || 0;
      case 'paid':
        return allocation.paidAmount || 0;
      case 'uncalled':
        return (allocation.amount || 0) - (allocation.calledAmount || 0);
      case 'outstanding':
        return (allocation.calledAmount || 0) - (allocation.paidAmount || 0);
      default:
        return allocation.amount || 0;
    }
  };

  const getViewLabel = (view: CapitalView): string => {
    switch (view) {
      case 'committed':
        return 'Total Committed';
      case 'called':
        return 'Total Called';
      case 'paid':
        return 'Total Paid';
      case 'uncalled':
        return 'Total Uncalled';
      case 'outstanding':
        return 'Total Outstanding';
      default:
        return 'Total';
    }
  };

  const getViewDescription = (view: CapitalView): string => {
    switch (view) {
      case 'committed':
        return 'Total committed capital across all allocations';
      case 'called':
        return 'Total capital called through capital calls';
      case 'paid':
        return 'Total capital actually paid/funded';
      case 'uncalled':
        return 'Remaining committed capital not yet called';
      case 'outstanding':
        return 'Called capital awaiting payment';
      default:
        return 'Total amount';
    }
  };

  const getAmountColorClass = (view: CapitalView): string => {
    switch (view) {
      case 'committed':
        return 'text-blue-700';
      case 'called':
        return 'text-amber-700';
      case 'paid':
        return 'text-green-700';
      case 'uncalled':
        return 'text-gray-600';
      case 'outstanding':
        return 'text-red-600';
      default:
        return 'text-neutral-700';
    }
  };

  const getBadgeVariant = (view: CapitalView): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (view) {
      case 'committed':
        return 'default';
      case 'called':
        return 'outline';
      case 'paid':
        return 'secondary';
      case 'uncalled':
        return 'outline';
      case 'outstanding':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const totals = calculateTotals();

  return (
    <TableRow className={`border-t-2 border-gray-200 bg-gray-50 font-semibold ${className}`}>
      <TableCell className="font-bold text-neutral-800">
        <div className="flex items-center gap-2">
          <span>{totals.label}</span>
          <Badge variant={getBadgeVariant(capitalView)} className="text-xs">
            {totals.count}
          </Badge>
        </div>
        <div className="text-xs font-normal text-gray-600 mt-0.5">
          {totals.description}
        </div>
      </TableCell>
      
      <TableCell className="text-right">
        <span className="text-sm text-gray-600">
          {totals.totalWeight.toFixed(1)}%
        </span>
      </TableCell>
      
      <TableCell className={`text-right font-bold ${getAmountColorClass(capitalView)}`}>
        {formatCurrency(totals.totalAmount)}
      </TableCell>
      
      <TableCell className="text-right">
        <div className="space-y-1">
          <div className="text-sm font-medium">
            {formatCurrency(totals.totalMarketValue)}
          </div>
          {totals.totalReturned > 0 && (
            <div className="text-xs text-green-600">
              +{formatCurrency(totals.totalReturned)}
            </div>
          )}
        </div>
      </TableCell>
      
      <TableCell className="text-right">
        <div className="space-y-1">
          <div className="text-sm font-medium">
            {totals.averageMOIC > 0 ? `${totals.averageMOIC.toFixed(2)}x` : '-'}
          </div>
          <div className="text-xs text-gray-600">
            {totals.averageIRR !== 0 ? `${totals.averageIRR.toFixed(1)}%` : '-'}
          </div>
        </div>
      </TableCell>
      
      <TableCell className="text-right">
        <Badge variant="outline" className="text-xs">
          {totals.count} deals
        </Badge>
      </TableCell>
    </TableRow>
  );
}

export default ModularTotalsRow;