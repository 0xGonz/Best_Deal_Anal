/**
 * Allocation Finite State Machine - Fixed Version
 * Enforces strict state transitions and blocks invalid payment events
 */

export enum AllocationState {
  COMMITTED = 'committed',
  PARTIALLY_CALLED = 'partially_called', 
  CALLED = 'called',
  PARTIALLY_PAID = 'partially_paid',
  FUNDED = 'funded',
  WRITTEN_OFF = 'written_off'
}

export enum AllocationEvent {
  CAPITAL_CALL_ISSUED = 'capital_call_issued',
  PAYMENT_RECEIVED = 'payment_received',
  FULL_PAYMENT_RECEIVED = 'full_payment_received',
  WRITE_OFF = 'write_off',
  ALLOCATION_ADJUSTMENT = 'allocation_adjustment'
}

export interface AllocationStateContext {
  allocationId: number;
  committedAmount: number;
  calledAmount: number;
  paidAmount: number;
  hasOpenCapitalCalls: boolean;
}

export class AllocationFSMFixed {
  
  /**
   * Get valid transitions for current state
   */
  static getValidTransitions(currentState: AllocationState): AllocationEvent[] {
    const transitions: Record<AllocationState, AllocationEvent[]> = {
      [AllocationState.COMMITTED]: [
        AllocationEvent.CAPITAL_CALL_ISSUED,
        AllocationEvent.WRITE_OFF,
        AllocationEvent.ALLOCATION_ADJUSTMENT
      ],
      [AllocationState.PARTIALLY_CALLED]: [
        AllocationEvent.CAPITAL_CALL_ISSUED,
        AllocationEvent.PAYMENT_RECEIVED,
        AllocationEvent.WRITE_OFF
      ],
      [AllocationState.CALLED]: [
        AllocationEvent.PAYMENT_RECEIVED,
        AllocationEvent.FULL_PAYMENT_RECEIVED,
        AllocationEvent.WRITE_OFF
      ],
      [AllocationState.PARTIALLY_PAID]: [
        AllocationEvent.CAPITAL_CALL_ISSUED,
        AllocationEvent.PAYMENT_RECEIVED,
        AllocationEvent.FULL_PAYMENT_RECEIVED,
        AllocationEvent.WRITE_OFF
      ],
      [AllocationState.FUNDED]: [
        AllocationEvent.WRITE_OFF // Only allow write-off from funded state
      ],
      [AllocationState.WRITTEN_OFF]: [] // Terminal state
    };

    return transitions[currentState] || [];
  }

  /**
   * Validate if an event is allowed in current state
   * FIXES: Blocks PAYMENT_RECEIVED when no capital calls exist
   */
  static canTransition(
    currentState: AllocationState, 
    event: AllocationEvent,
    context: AllocationStateContext
  ): { 
    allowed: boolean; 
    reason?: string; 
    nextState?: AllocationState 
  } {
    const validEvents = this.getValidTransitions(currentState);
    
    if (!validEvents.includes(event)) {
      return {
        allowed: false,
        reason: `Event ${event} not allowed in state ${currentState}`
      };
    }

    // CRITICAL FIX: Block payments without capital calls
    if (event === AllocationEvent.PAYMENT_RECEIVED) {
      if (!context.hasOpenCapitalCalls) {
        return {
          allowed: false,
          reason: 'Cannot process payment without an active capital call. Create a capital call first.'
        };
      }

      // Additional validation: ensure payment doesn't exceed called amount
      if (context.paidAmount >= context.calledAmount && context.calledAmount > 0) {
        return {
          allowed: false,
          reason: 'Payment would exceed called amount. No outstanding capital call balance.'
        };
      }
    }

    // Calculate next state based on event and context
    const nextState = this.calculateNextState(currentState, event, context);
    
    return {
      allowed: true,
      nextState
    };
  }

  /**
   * Calculate next state based on current state, event, and context
   */
  static calculateNextState(
    currentState: AllocationState,
    event: AllocationEvent,
    context: AllocationStateContext
  ): AllocationState {
    const { committedAmount, calledAmount, paidAmount } = context;
    
    switch (event) {
      case AllocationEvent.CAPITAL_CALL_ISSUED:
        if (calledAmount >= committedAmount) {
          return AllocationState.CALLED;
        } else if (calledAmount > 0) {
          return AllocationState.PARTIALLY_CALLED;
        }
        return currentState;

      case AllocationEvent.PAYMENT_RECEIVED:
      case AllocationEvent.FULL_PAYMENT_RECEIVED:
        if (paidAmount >= committedAmount) {
          return AllocationState.FUNDED;
        } else if (paidAmount > 0) {
          return AllocationState.PARTIALLY_PAID;
        }
        return currentState;

      case AllocationEvent.WRITE_OFF:
        return AllocationState.WRITTEN_OFF;

      case AllocationEvent.ALLOCATION_ADJUSTMENT:
        // Recalculate state based on new amounts
        if (paidAmount >= committedAmount) {
          return AllocationState.FUNDED;
        } else if (paidAmount > 0) {
          return AllocationState.PARTIALLY_PAID;
        } else if (calledAmount >= committedAmount) {
          return AllocationState.CALLED;
        } else if (calledAmount > 0) {
          return AllocationState.PARTIALLY_CALLED;
        }
        return AllocationState.COMMITTED;

      default:
        return currentState;
    }
  }

  /**
   * Process state transition with validation
   */
  static processTransition(
    currentState: AllocationState,
    event: AllocationEvent,
    context: AllocationStateContext
  ): {
    success: boolean;
    newState?: AllocationState;
    error?: string;
  } {
    const validation = this.canTransition(currentState, event, context);
    
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason
      };
    }

    return {
      success: true,
      newState: validation.nextState || currentState
    };
  }

  /**
   * Get allocation state from amounts
   */
  static determineStateFromAmounts(
    committedAmount: number,
    calledAmount: number,
    paidAmount: number
  ): AllocationState {
    const paidPercentage = committedAmount > 0 ? (paidAmount / committedAmount) * 100 : 0;
    const calledPercentage = committedAmount > 0 ? (calledAmount / committedAmount) * 100 : 0;

    if (paidPercentage >= 100) {
      return AllocationState.FUNDED;
    } else if (paidPercentage > 0) {
      return AllocationState.PARTIALLY_PAID;
    } else if (calledPercentage >= 100) {
      return AllocationState.CALLED;
    } else if (calledPercentage > 0) {
      return AllocationState.PARTIALLY_CALLED;
    }
    
    return AllocationState.COMMITTED;
  }

  /**
   * Validate payment event with FSM rules
   */
  static validatePaymentEvent(context: AllocationStateContext): {
    canPay: boolean;
    error?: string;
    requiredAction?: string;
  } {
    const currentState = this.determineStateFromAmounts(
      context.committedAmount,
      context.calledAmount,
      context.paidAmount
    );

    const validation = this.canTransition(
      currentState,
      AllocationEvent.PAYMENT_RECEIVED,
      context
    );

    if (!validation.allowed) {
      return {
        canPay: false,
        error: validation.reason,
        requiredAction: 'Create a capital call before processing payment'
      };
    }

    return {
      canPay: true
    };
  }
}