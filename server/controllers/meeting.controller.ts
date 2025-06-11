import { Request, Response } from 'express';
import { db } from '../db';
import { meetings, insertMeetingSchema, deals } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../utils/auth';
import { z } from 'zod';

// GET /api/meetings
export const getMeetings = [
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const allMeetings = await db.query.meetings.findMany({
        orderBy: (meetings, { desc }) => [desc(meetings.date)],
      });
      
      // Join the dealId with the deal name
      const meetingsWithDeals = await Promise.all(
        allMeetings.map(async (meeting) => {
          const [deal] = await db.query.deals.findMany({
            where: eq(deals.id, meeting.dealId),
            columns: {
              name: true,
            }
          });
          return {
            ...meeting,
            dealName: deal?.name || 'Unknown Deal',
          };
        })
      );

      return res.status(200).json(meetingsWithDeals);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      return res.status(500).json({ error: 'Failed to fetch meetings' });
    }
  }
];

// POST /api/meetings
export const createMeeting = [
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      // Validate the request body against the schema
      const validatedData = insertMeetingSchema.parse(req.body);
      
      // Insert the new meeting
      const [newMeeting] = await db.insert(meetings).values(validatedData).returning();
      
      // Get the deal name for the response
      const [deal] = await db.query.deals.findMany({
        where: eq(deals.id, newMeeting.dealId),
        columns: {
          name: true,
        }
      });
      
      // Return the new meeting with the deal name
      return res.status(201).json({
        ...newMeeting,
        dealName: deal?.name || 'Unknown Deal',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating meeting:', error);
      return res.status(500).json({ error: 'Failed to create meeting' });
    }
  }
];

// GET /api/meetings/:id
export const getMeetingById = [
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid meeting ID' });
      }
      
      const [meeting] = await db.query.meetings.findMany({
        where: eq(meetings.id, id),
      });
      
      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      
      // Get the deal name
      const [deal] = await db.query.deals.findMany({
        where: eq(deals.id, meeting.dealId),
        columns: {
          name: true,
        }
      });
      
      return res.status(200).json({
        ...meeting,
        dealName: deal?.name || 'Unknown Deal',
      });
    } catch (error) {
      console.error('Error fetching meeting:', error);
      return res.status(500).json({ error: 'Failed to fetch meeting' });
    }
  }
];

// PUT /api/meetings/:id
export const updateMeeting = [
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid meeting ID' });
      }
      
      // Validate the request body
      const validatedData = insertMeetingSchema.parse(req.body);
      
      // Check if meeting exists
      const [existingMeeting] = await db.query.meetings.findMany({
        where: eq(meetings.id, id),
      });
      
      if (!existingMeeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      
      // Update the meeting
      const [updatedMeeting] = await db
        .update(meetings)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(meetings.id, id))
        .returning();
      
      // Get the deal name
      const [deal] = await db.query.deals.findMany({
        where: eq(deals.id, updatedMeeting.dealId),
        columns: {
          name: true,
        }
      });
      
      return res.status(200).json({
        ...updatedMeeting,
        dealName: deal?.name || 'Unknown Deal',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error updating meeting:', error);
      return res.status(500).json({ error: 'Failed to update meeting' });
    }
  }
];

// DELETE /api/meetings/:id
export const deleteMeeting = [
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid meeting ID' });
      }
      
      // Check if meeting exists
      const [existingMeeting] = await db.query.meetings.findMany({
        where: eq(meetings.id, id),
      });
      
      if (!existingMeeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      
      // Delete the meeting
      await db.delete(meetings).where(eq(meetings.id, id));
      
      return res.status(200).json({ message: 'Meeting deleted successfully' });
    } catch (error) {
      console.error('Error deleting meeting:', error);
      return res.status(500).json({ error: 'Failed to delete meeting' });
    }
  }
];

// GET /api/meetings/deal/:dealId - Get meetings for a specific deal
export const getMeetingsByDeal = [
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ error: 'Invalid deal ID' });
      }
      
      const dealMeetings = await db.query.meetings.findMany({
        where: eq(meetings.dealId, dealId),
        orderBy: (meetings, { desc }) => [desc(meetings.date)],
      });
      
      // Get the deal name for all meetings
      const [deal] = await db.query.deals.findMany({
        where: eq(deals.id, dealId),
        columns: {
          name: true,
        }
      });
      
      // Add deal name to each meeting
      const meetingsWithDealName = dealMeetings.map(meeting => ({
        ...meeting,
        dealName: deal?.name || 'Unknown Deal',
      }));
      
      return res.status(200).json(meetingsWithDealName);
    } catch (error) {
      console.error(`Error fetching meetings for deal ${req.params.dealId}:`, error);
      return res.status(500).json({ error: 'Failed to fetch meetings for this deal' });
    }
  }
];