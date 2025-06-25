/**
 * Payment Workflow Guards
 * 
 * Enforces business logic constraints to prevent the drift issues:
 * 1. No payments without capital calls
 * 2. Proper numeric type handling
 * 3. State machine validation
 */

import { Request, Response, NextFunction } from 'express';
import { StorageFactory } from '../storage-factory';
import { z } from 'zod';

const storage = StorageFactory.getStorage();

// Strict payment validation schema
const paymentSchema = z.object({
  capitalCallId: z.number().positive('Capital call ID is required'),
  amount: z.number().positive('Payment amount must be greater than 0'),
  paymentDate: z.string().optional(),
  paymentType: z.enum(['wire', 'check', 'ach', 'other']).optional().default('wire'),
  notes: z.string().optional()
});

// Allocation state machine states
const VALID_STATUS_TRANSITIONS = {
  'committed': ['partially_paid', 'funded'],
  'partially_paid': ['funded', 'committed'],
  'funded': ['partially_paid'], // Allow corrections
  'unfunded': ['committed', 'partially_paid', 'funded'],
  'written_off': [] // Terminal state
};

export class PaymentWorkflowGuards {
  /**
   * Ensures payments can only be made against existing capital calls
   */
  static validateCapitalCallExists = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = paymentSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid payment data',
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }

      const { capitalCallId } = validation.data;
      
      // Verify capital call exists
      const capitalCall = await storage.getCapitalCall(capitalCallId);
      if (!capitalCall) {
        return res.status(404).json({
          error: 'Capital call not found',
          message: 'Payments must be made against existing capital calls. Create a capital call first.'
        });
      }

      // Verify capital call is in payable state
      if (!['called', 'partially_paid', 'scheduled'].includes(capitalCall.status)) {
        return res.status(400).json({
          error: 'Invalid capital call state',
          message: `Cannot make payment against capital call with status: ${capitalCall.status}`
        });
      }

      // Attach validated data and capital call to request
      req.body = validation.data;
      (req as any).capitalCall = capitalCall;
      
      next();
    } catch (error) {
      console.error('Payment validation error:', error);
      res.status(500).json({ error: 'Payment validation failed' });
    }
  };

  /**
   * Prevents overpayment of capital calls
   */
  static validatePaymentAmount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount } = req.body;
      const capitalCall = (req as any).capitalCall;
      
      if (!capitalCall) {
        return res.status(500).json({ error: 'Capital call data missing from request' });
      }

      const currentPaid = Number(capitalCall.paidAmount) || 0;
      const callAmount = Number(capitalCall.callAmount);
      const paymentAmount = Number(amount);
      
      // Check for overpayment
      if (currentPaid + paymentAmount > callAmount) {
        const maxAllowed = callAmount - currentPaid;
        return res.status(400).json({
          error: 'Payment exceeds capital call amount',
          message: `Maximum payment allowed: $${maxAllowed.toLocaleString()}`,
          details: {
            callAmount: callAmount,
            alreadyPaid: currentPaid,
            attemptedPayment: paymentAmount,
            maxAllowed: maxAllowed
          }
        });
      }

      next();
    } catch (error) {
      console.error('Payment amount validation error:', error);
      res.status(500).json({ error: 'Payment amount validation failed' });
    }
  };

  /**
   * Validates allocation status transitions
   */
  static validateStatusTransition = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const capitalCall = (req as any).capitalCall;
      const paymentAmount = Number(req.body.amount);
      
      // Get the allocation
      const allocation = await storage.getFundAllocation(capitalCall.allocationId);
      if (!allocation) {
        return res.status(404).json({ error: 'Allocation not found' });
      }

      const currentStatus = allocation.status;
      const currentPaid = Number(allocation.paidAmount) || 0;
      const newPaidAmount = currentPaid + paymentAmount;
      const commitmentAmount = Number(allocation.amount);
      
      // Calculate new status
      let newStatus = currentStatus;
      if (newPaidAmount >= commitmentAmount) {
        newStatus = 'funded';
      } else if (newPaidAmount > 0) {
        newStatus = 'partially_paid';
      }

      // Check if transition is valid
      const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus as keyof typeof VALID_STATUS_TRANSITIONS] || [];
      if (newStatus !== currentStatus && !validTransitions.includes(newStatus)) {
        return res.status(400).json({
          error: 'Invalid status transition',
          message: `Cannot transition from ${currentStatus} to ${newStatus}`,
          validTransitions: validTransitions
        });
      }

      // Attach allocation and calculated status to request
      (req as any).allocation = allocation;
      (req as any).calculatedStatus = newStatus;
      
      next();
    } catch (error) {
      console.error('Status transition validation error:', error);
      res.status(500).json({ error: 'Status transition validation failed' });
    }
  };

  /**
   * Ensures numeric type safety for money operations
   */
  static enforceNumericTypes = (req: Request, res: Response, next: NextFunction) => {
    try {
      // Convert all money fields to numbers to prevent string concatenation
      const moneyFields = ['amount', 'callAmount', 'paidAmount', 'paymentAmount'];
      
      for (const field of moneyFields) {
        if (req.body[field] !== undefined) {
          const value = req.body[field];
          const numericValue = Number(value);
          
          if (isNaN(numericValue)) {
            return res.status(400).json({
              error: `Invalid numeric value for ${field}`,
              message: `${field} must be a valid number, received: ${value}`
            });
          }
          
          // Ensure proper precision for money (2 decimal places)
          req.body[field] = Math.round(numericValue * 100) / 100;
        }
      }
      
      next();
    } catch (error) {
      console.error('Numeric type enforcement error:', error);
      res.status(500).json({ error: 'Numeric type validation failed' });
    }
  };

  /**
   * Prevents duplicate allocations for the same fund-deal pair
   */
  static validateUniqueAllocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fundId, dealId } = req.body;
      
      if (fundId && dealId) {
        const existingAllocation = await storage.getAllocationsByFund(fundId);
        const duplicate = existingAllocation.find(a => a.dealId === dealId);
        
        if (duplicate) {
          return res.status(409).json({
            error: 'Duplicate allocation',
            message: `An allocation already exists for this fund-deal pair`,
            existingAllocationId: duplicate.id
          });
        }
      }
      
      next();
    } catch (error) {
      console.error('Unique allocation validation error:', error);
      res.status(500).json({ error: 'Allocation uniqueness validation failed' });
    }
  };

  /**
   * Complete payment workflow validation chain
   */
  static paymentWorkflowChain = [
    PaymentWorkflowGuards.enforceNumericTypes,
    PaymentWorkflowGuards.validateCapitalCallExists,
    PaymentWorkflowGuards.validatePaymentAmount,
    PaymentWorkflowGuards.validateStatusTransition
  ];

  /**
   * Complete allocation workflow validation chain
   */
  static allocationWorkflowChain = [
    PaymentWorkflowGuards.enforceNumericTypes,
    PaymentWorkflowGuards.validateUniqueAllocation
  ];
}

export default PaymentWorkflowGuards;