/**
 * Capital Call Mutations with automatic cache invalidation
 * Ensures UI updates immediately after capital call operations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface CreateCapitalCallData {
  allocationId: number;
  callAmount: number;
  callPercentage?: number;
  dueDate: string;
  notes?: string;
}

interface ProcessPaymentData {
  capitalCallId: number;
  paymentAmount: number;
  paymentDate: string;
  paymentType?: string;
  notes?: string;
}

/**
 * Create capital call mutation with automatic cache invalidation
 */
export function useCreateCapitalCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCapitalCallData) =>
      apiRequest(`/api/capital-calls`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables) => {
      // Invalidate all related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['fund-overview'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['production-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['capital-calls'] });
      
      // Invalidate specific fund queries
      if (data?.allocation?.fundId) {
        queryClient.invalidateQueries({ queryKey: ['fund-overview', data.allocation.fundId] });
        queryClient.invalidateQueries({ queryKey: ['production-allocations', 'fund', data.allocation.fundId] });
      }
    },
  });
}

/**
 * Process payment mutation with automatic cache invalidation
 */
export function useProcessPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProcessPaymentData) =>
      apiRequest(`/api/capital-calls/${data.capitalCallId}/payments`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables) => {
      // Invalidate all related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['fund-overview'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['production-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['capital-calls'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      
      // Invalidate specific fund queries
      if (data?.fundId) {
        queryClient.invalidateQueries({ queryKey: ['fund-overview', data.fundId] });
        queryClient.invalidateQueries({ queryKey: ['production-allocations', 'fund', data.fundId] });
      }
    },
  });
}

/**
 * Update capital call mutation with automatic cache invalidation
 */
export function useUpdateCapitalCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateCapitalCallData> }) =>
      apiRequest(`/api/capital-calls/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables) => {
      // Invalidate all related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['fund-overview'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['production-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['capital-calls'] });
      
      // Invalidate specific capital call
      queryClient.invalidateQueries({ queryKey: ['capital-calls', variables.id] });
    },
  });
}

/**
 * Delete capital call mutation with automatic cache invalidation
 */
export function useDeleteCapitalCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/capital-calls/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: (data, variables) => {
      // Invalidate all related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['fund-overview'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['production-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['capital-calls'] });
      
      // Remove specific capital call from cache
      queryClient.removeQueries({ queryKey: ['capital-calls', variables] });
    },
  });
}