/**
 * Allocation State Machine Service
 * 
 * Implements the state machine from the "everything has to balance" playbook.
 * Enforces one-way transitions and prevents invalid state changes.
 */

export type AllocationStatus = 
  | 'committed' 
  | 'partially_called' 
  | 'called' 
  | 'partially_funded' 
  | 'funded';

export interface AllocationState {
  id: number;
  amount: number;
  calledAmount: number;
  fundedAmount: number;
  status: AllocationStatus;
}

export interface FSMTransition {
  from: AllocationStatus;
  to: AllocationStatus;
  event: string;
  validator?: (state: AllocationState) => boolean;
}

export class AllocationStateMachine {
  private static transitions: FSMTransition[] = [
    // From committed
    {
      from: 'committed',
      to: 'partially_called',
      event: 'CREATE_CALL',
      validator: (state) => state.calledAmount > 0 && state.calledAmount < state.amount
    },
    {
      from: 'committed',
      to: 'called',
      event: 'CREATE_FULL_CALL',
      validator: (state) => state.calledAmount === state.amount
    },

    // From partially_called
    {
      from: 'partially_called',
      to: 'called',
      event: 'CALL_REMAINDER',
      validator: (state) => state.calledAmount === state.amount
    },
    {
      from: 'partially_called',
      to: 'partially_funded',
      event: 'PAYMENT_RECEIVED',
      validator: (state) => state.fundedAmount > 0 && state.fundedAmount < state.calledAmount
    },

    // From called
    {
      from: 'called',
      to: 'partially_funded',
      event: 'PAYMENT_RECEIVED',
      validator: (state) => state.fundedAmount > 0 && state.fundedAmount < state.calledAmount
    },
    {
      from: 'called',
      to: 'funded',
      event: 'FULL_PAYMENT_RECEIVED',
      validator: (state) => state.fundedAmount === state.calledAmount && state.calledAmount === state.amount
    },

    // From partially_funded
    {
      from: 'partially_funded',
      to: 'funded',
      event: 'FULL_PAYMENT_RECEIVED',
      validator: (state) => state.fundedAmount === state.calledAmount && state.calledAmount === state.amount
    }
  ];

  /**
   * Calculate the correct status based on amounts
   */
  static calculateStatus(state: Pick<AllocationState, 'amount' | 'calledAmount' | 'fundedAmount'>): AllocationStatus {
    const { amount, calledAmount, fundedAmount } = state;

    if (calledAmount === 0) {
      return 'committed';
    }
    
    if (calledAmount > 0 && calledAmount < amount) {
      if (fundedAmount > 0) {
        return 'partially_funded';
      }
      return 'partially_called';
    }
    
    if (calledAmount === amount) {
      if (fundedAmount === 0) {
        return 'called';
      }
      if (fundedAmount > 0 && fundedAmount < calledAmount) {
        return 'partially_funded';
      }
      if (fundedAmount === calledAmount) {
        return 'funded';
      }
    }

    // Fallback to committed for any edge cases
    return 'committed';
  }

  /**
   * Validate a state transition
   */
  static validateTransition(fromStatus: AllocationStatus, toStatus: AllocationStatus, event: string, state: AllocationState): boolean {
    const transition = this.transitions.find(t => 
      t.from === fromStatus && 
      t.to === toStatus && 
      t.event === event
    );

    if (!transition) {
      return false;
    }

    if (transition.validator) {
      return transition.validator(state);
    }

    return true;
  }

  /**
   * Attempt a state transition
   */
  static transition(currentState: AllocationState, event: string, newAmounts: Partial<Pick<AllocationState, 'calledAmount' | 'fundedAmount'>>): {
    success: boolean;
    newStatus?: AllocationStatus;
    error?: string;
  } {
    const updatedState: AllocationState = {
      ...currentState,
      ...newAmounts
    };

    const calculatedStatus = this.calculateStatus(updatedState);
    
    // If the calculated status is the same as current, no transition needed
    if (calculatedStatus === currentState.status) {
      return { success: true, newStatus: calculatedStatus };
    }

    // Validate the transition
    const isValid = this.validateTransition(currentState.status, calculatedStatus, event, updatedState);
    
    if (!isValid) {
      return {
        success: false,
        error: `Invalid transition from ${currentState.status} to ${calculatedStatus} via ${event}`
      };
    }

    return {
      success: true,
      newStatus: calculatedStatus
    };
  }

  /**
   * Get valid next states for a given status
   */
  static getValidNextStates(currentStatus: AllocationStatus): Array<{ status: AllocationStatus; event: string }> {
    return this.transitions
      .filter(t => t.from === currentStatus)
      .map(t => ({ status: t.to, event: t.event }));
  }

  /**
   * Check if a status is terminal
   */
  static isTerminalStatus(status: AllocationStatus): boolean {
    return status === 'funded';
  }

  /**
   * Get status color for UI
   */
  static getStatusColor(status: AllocationStatus): string {
    switch (status) {
      case 'committed': return 'gray';
      case 'partially_called': return 'blue';
      case 'called': return 'orange';
      case 'partially_funded': return 'yellow';
      case 'funded': return 'green';
      default: return 'gray';
    }
  }

  /**
   * Get status label for UI
   */
  static getStatusLabel(status: AllocationStatus): string {
    switch (status) {
      case 'committed': return 'Committed';
      case 'partially_called': return 'Partially Called';
      case 'called': return 'Called';
      case 'partially_funded': return 'Partially Funded';
      case 'funded': return 'Funded';
      default: return 'Unknown';
    }
  }
}