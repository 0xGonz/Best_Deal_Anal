import { Request, Response } from "express";
import { z } from "zod";
import { 
  Fund, 
  insertFundSchema,
  InsertFund 
} from "@shared/schema";

// Import interface from service
import { FundWithAllocations } from "../services/fund.service";
import { fundService } from "../services";

/**
 * Fund Controller - Handles HTTP requests and responses for fund resources
 */
export class FundController {
  /**
   * Get all funds with allocations
   */
  async getFunds(req: Request, res: Response) {
    try {
      const funds = await fundService.getAllFundsWithAllocations();
      return res.json(funds);
    } catch (error) {
      console.error("Error fetching funds:", error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  }

  /**
   * Get a specific fund by ID
   */
  async getFundById(req: Request, res: Response) {
    try {
      const fundId = parseInt(req.params.id);
      
      if (isNaN(fundId)) {
        return res.status(400).json({ message: "Invalid fund ID" });
      }

      const fund = await fundService.getFundWithAllocations(fundId);
      
      if (!fund) {
        return res.status(404).json({ message: "Fund not found" });
      }
      
      return res.json(fund);
    } catch (error) {
      console.error(`Error fetching fund ${req.params.id}:`, error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  }

  /**
   * Create a new fund
   */
  async createFund(req: Request, res: Response) {
    try {
      // Validate request body
      const fundData = insertFundSchema.parse(req.body);
      
      // Get current user ID from session
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const fund = await fundService.createFund(fundData);
      return res.status(201).json(fund);
    } catch (error) {
      console.error("Error creating fund:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  }

  /**
   * Update an existing fund
   */
  async updateFund(req: Request, res: Response) {
    try {
      const fundId = parseInt(req.params.id);
      
      if (isNaN(fundId)) {
        return res.status(400).json({ message: "Invalid fund ID" });
      }
      
      // Partial validation of request body
      const updateSchema = insertFundSchema.partial();
      const fundUpdate = updateSchema.parse(req.body);
      
      const updatedFund = await fundService.updateFund(fundId, fundUpdate);
      
      if (!updatedFund) {
        return res.status(404).json({ message: "Fund not found" });
      }
      
      return res.json(updatedFund);
    } catch (error) {
      console.error(`Error updating fund ${req.params.id}:`, error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  }

  /**
   * Delete a fund
   */
  async deleteFund(req: Request, res: Response) {
    try {
      const fundId = parseInt(req.params.id);
      
      if (isNaN(fundId)) {
        return res.status(400).json({ message: "Invalid fund ID" });
      }

      const result = await fundService.deleteFund(fundId);
      
      if (!result) {
        return res.status(404).json({ message: "Fund not found" });
      }
      
      return res.status(204).end();
    } catch (error) {
      console.error(`Error deleting fund ${req.params.id}:`, error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  }
}

export const fundController = new FundController();