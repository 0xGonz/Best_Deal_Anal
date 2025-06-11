import { Request, Response } from 'express';
import { capitalCallService } from '../services/capital-call.service';
import { insertCapitalCallSchema } from '@shared/schema';
import { ZodError } from 'zod';
import { formatZodError } from '../utils/errorHandlers';

/**
 * Controller for capital call related endpoints
 */
export class CapitalCallController {
  /**
   * Create a new capital call
   */
  async createCapitalCall(req: Request, res: Response) {
    try {
      // Validate request body
      const validatedCapitalCall = insertCapitalCallSchema.parse(req.body);
      
      // Create capital call
      const result = await capitalCallService.createCapitalCall(validatedCapitalCall);
      
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      console.error('Failed to create capital call', error);
      res.status(500).json({ error: 'An error occurred while creating the capital call' });
    }
  }

  /**
   * Get a capital call by ID
   */
  async getCapitalCallById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid capital call ID' });
      }
      
      const capitalCall = await capitalCallService.getCapitalCall(id);
      
      if (!capitalCall) {
        return res.status(404).json({ error: 'Capital call not found' });
      }
      
      res.json(capitalCall);
    } catch (error) {
      console.error('Failed to get capital call', error);
      res.status(500).json({ error: 'An error occurred while retrieving the capital call' });
    }
  }

  /**
   * Get all capital calls
   */
  async getAllCapitalCalls(req: Request, res: Response) {
    try {
      const capitalCalls = await capitalCallService.getAllCapitalCalls();
      res.json(capitalCalls);
    } catch (error) {
      console.error('Failed to get all capital calls', error);
      res.status(500).json({ error: 'An error occurred while retrieving capital calls' });
    }
  }

  /**
   * Get capital calls by allocation ID
   */
  async getCapitalCallsByAllocation(req: Request, res: Response) {
    try {
      const allocationId = parseInt(req.params.allocationId);
      
      if (isNaN(allocationId)) {
        return res.status(400).json({ error: 'Invalid allocation ID' });
      }
      
      const capitalCalls = await capitalCallService.getCapitalCallsByAllocation(allocationId);
      res.json(capitalCalls);
    } catch (error) {
      console.error('Failed to get capital calls by allocation', error);
      res.status(500).json({ error: 'An error occurred while retrieving capital calls' });
    }
  }

  /**
   * Get capital calls by deal ID
   */
  async getCapitalCallsByDeal(req: Request, res: Response) {
    try {
      const dealId = parseInt(req.params.dealId);
      
      if (isNaN(dealId)) {
        return res.status(400).json({ error: 'Invalid deal ID' });
      }
      
      const capitalCalls = await capitalCallService.getCapitalCallsByDeal(dealId);
      res.json(capitalCalls);
    } catch (error) {
      console.error('Failed to get capital calls by deal', error);
      res.status(500).json({ error: 'An error occurred while retrieving capital calls' });
    }
  }

  /**
   * Update capital call status
   */
  async updateCapitalCallStatus(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid capital call ID' });
      }
      
      const { status, paidAmount } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      
      const updatedCall = await capitalCallService.updateCapitalCallStatus(id, status, paidAmount);
      
      if (!updatedCall) {
        return res.status(404).json({ error: 'Capital call not found' });
      }
      
      res.json(updatedCall);
    } catch (error) {
      console.error('Failed to update capital call status', error);
      res.status(500).json({ error: 'An error occurred while updating the capital call' });
    }
  }

  /**
   * Update capital call dates
   */
  async updateCapitalCallDates(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid capital call ID' });
      }
      
      const { callDate, dueDate } = req.body;
      
      if (!callDate || !dueDate) {
        return res.status(400).json({ error: 'Call date and due date are required' });
      }
      
      const updatedCall = await capitalCallService.updateCapitalCallDates(id, new Date(callDate), new Date(dueDate));
      
      if (!updatedCall) {
        return res.status(404).json({ error: 'Capital call not found' });
      }
      
      res.json(updatedCall);
    } catch (error) {
      console.error('Failed to update capital call dates', error);
      res.status(500).json({ error: 'An error occurred while updating the capital call' });
    }
  }

  /**
   * Get capital calls for calendar view
   */
  async getCapitalCallsForCalendar(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      
      const result = await capitalCallService.getCapitalCallsForCalendar(start, end);
      res.json(result);
    } catch (error) {
      console.error('Failed to get capital calls for calendar', error);
      res.status(500).json({ error: 'An error occurred while retrieving capital calls' });
    }
  }
}

export const capitalCallController = new CapitalCallController();