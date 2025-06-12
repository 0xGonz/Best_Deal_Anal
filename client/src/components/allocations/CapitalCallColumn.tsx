import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Plus, Eye } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { FundAllocation } from '@/lib/types';

interface CapitalCallColumnProps {
  allocation: FundAllocation;
  onViewCapitalCalls?: (allocationId: number) => void;
  onCreateCapitalCall?: (allocationId: number) => void;
  showActions?: boolean;
}

export const CapitalCallColumn: React.FC<CapitalCallColumnProps> = ({
  allocation,
  onViewCapitalCalls,
  onCreateCapitalCall,
  showActions = true
}) => {
  const getCallProgress = () => {
    const committed = allocation.amount || 0;
    const called = allocation.calledAmount || 0;
    const paid = allocation.paidAmount || 0;
    
    return {
      committed,
      called,
      paid,
      uncalled: committed - called,
      outstanding: called - paid,
      calledPercentage: committed > 0 ? (called / committed) * 100 : 0,
      paidPercentage: called > 0 ? (paid / called) * 100 : 0
    };
  };

  const progress = getCallProgress();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'funded': return 'bg-green-100 text-green-800';
      case 'partially_paid': return 'bg-yellow-100 text-yellow-800';
      case 'committed': return 'bg-blue-100 text-blue-800';
      case 'unfunded': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-2">
      {/* Status Badge */}
      <Badge className={`text-xs ${getStatusColor(allocation.status || 'committed')}`}>
        {allocation.status || 'committed'}
      </Badge>

      {/* Capital Call Summary */}
      <div className="text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Called:</span>
          <span className="font-medium text-orange-600">
            {formatCurrency(progress.called)} ({progress.calledPercentage.toFixed(0)}%)
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Paid:</span>
          <span className="font-medium text-green-600">
            {formatCurrency(progress.paid)} ({progress.paidPercentage.toFixed(0)}%)
          </span>
        </div>
        {progress.outstanding > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">Outstanding:</span>
            <span className="font-medium text-red-600">
              {formatCurrency(progress.outstanding)}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-green-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress.paidPercentage}%` }}
        />
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex space-x-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onViewCapitalCalls?.(allocation.id)}
            title="View capital calls"
          >
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onCreateCapitalCall?.(allocation.id)}
            title="Create capital call"
          >
            <Plus className="h-3 w-3 mr-1" />
            Call
          </Button>
        </div>
      )}
    </div>
  );
};

export default CapitalCallColumn;