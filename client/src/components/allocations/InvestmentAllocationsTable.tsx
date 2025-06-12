import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CreditCard, Eye, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { FundAllocation } from '@/lib/types';

interface InvestmentAllocationsTableProps {
  allocations: FundAllocation[];
  isLoading?: boolean;
  onEditAllocation?: (allocation: FundAllocation) => void;
  onDeleteAllocation?: (allocationId: number) => void;
  onViewCapitalCalls?: (allocationId: number) => void;
  capitalView?: 'committed' | 'called' | 'paid';
  showCapitalCallColumn?: boolean;
}

export const InvestmentAllocationsTable: React.FC<InvestmentAllocationsTableProps> = ({
  allocations,
  isLoading = false,
  onEditAllocation,
  onDeleteAllocation,
  onViewCapitalCalls,
  capitalView = 'committed',
  showCapitalCallColumn = true
}) => {
  const [sortField, setSortField] = useState<keyof FundAllocation>('allocationDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'funded': return 'bg-green-100 text-green-800';
      case 'partially_paid': return 'bg-yellow-100 text-yellow-800';
      case 'committed': return 'bg-blue-100 text-blue-800';
      case 'unfunded': return 'bg-gray-100 text-gray-800';
      case 'written_off': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCapitalViewColorClass = (view: string) => {
    switch (view) {
      case 'called': return 'text-orange-600';
      case 'paid': return 'text-green-600';
      default: return 'text-blue-600';
    }
  };

  const getDisplayAmount = (allocation: FundAllocation) => {
    switch (capitalView) {
      case 'called':
        return allocation.calledAmount || 0;
      case 'paid':
        return allocation.paidAmount || 0;
      default:
        return allocation.amount || 0;
    }
  };

  const sortedAllocations = React.useMemo(() => {
    if (!allocations?.length) return [];
    
    return [...allocations].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? -1 : 1;
      if (bValue == null) return sortDirection === 'asc' ? 1 : -1;
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allocations, sortField, sortDirection]);

  const handleSort = (field: keyof FundAllocation) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Investment Allocations</CardTitle>
          <CardDescription>Loading allocation data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse flex space-x-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!allocations?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Investment Allocations</CardTitle>
          <CardDescription>No allocations have been created for this fund yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-8">
            When investments are allocated to this fund, they will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investment Allocations</CardTitle>
        <CardDescription>
          {allocations.length} allocation{allocations.length !== 1 ? 's' : ''} • 
          Showing {capitalView} amounts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('dealName' as keyof FundAllocation)}
                >
                  Deal
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('securityType')}
                >
                  Security
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('status')}
                >
                  Status
                </TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('amount')}
                >
                  {capitalView === 'called' ? 'Called' : capitalView === 'paid' ? 'Paid' : 'Committed'}
                </TableHead>
                <TableHead className="text-right">Distributions</TableHead>
                <TableHead className="text-right">Returns</TableHead>
                {showCapitalCallColumn && (
                  <TableHead className="text-center">Capital Calls</TableHead>
                )}
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAllocations.map((allocation) => {
                const displayAmount = getDisplayAmount(allocation);
                
                return (
                  <TableRow key={allocation.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold text-sm">
                          {allocation.dealName || 'Unknown Deal'}
                        </div>
                        {allocation.dealSector && (
                          <div className="text-xs text-gray-500">
                            {allocation.dealSector}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {allocation.dealSector || allocation.securityType || 'equity'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${getStatusColor(allocation.status || 'committed')}`}>
                        {allocation.status || 'committed'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-sm ${getCapitalViewColorClass(capitalView)}`}>
                        {allocation.portfolioWeight ? `${allocation.portfolioWeight.toFixed(1)}%` : 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-sm font-medium ${getCapitalViewColorClass(capitalView)}`}>
                        {formatCurrency(displayAmount)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm">
                        {formatCurrency(allocation.distributionPaid || 0)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm">
                        {allocation.moic && allocation.moic !== 1 
                          ? `${allocation.moic.toFixed(2)}x` 
                          : 'N/A'}
                      </span>
                    </TableCell>
                    {showCapitalCallColumn && (
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => onViewCapitalCalls?.(allocation.id)}
                          title="View capital calls"
                        >
                          <CreditCard className="h-4 w-4 text-gray-600" />
                        </Button>
                      </TableCell>
                    )}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {showCapitalCallColumn && (
                            <DropdownMenuItem 
                              onClick={() => onViewCapitalCalls?.(allocation.id)}
                              className="cursor-pointer"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Capital Calls
                            </DropdownMenuItem>
                          )}
                          {onEditAllocation && (
                            <DropdownMenuItem 
                              onClick={() => onEditAllocation(allocation)}
                              className="cursor-pointer"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Allocation
                            </DropdownMenuItem>
                          )}
                          {onDeleteAllocation && (
                            <DropdownMenuItem 
                              onClick={() => onDeleteAllocation(allocation.id)}
                              className="cursor-pointer text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Allocation
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvestmentAllocationsTable;