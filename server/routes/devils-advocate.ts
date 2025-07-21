import express from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db';
import { devilsAdvocateComments, users } from '@shared/schema';
import { z } from 'zod';
import { requireAuth } from '../utils/auth';

const router = express.Router();

// Validation schemas
const createCommentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  category: z.enum(['market_risk', 'execution_risk', 'financial_risk', 'competitive_risk', 'regulatory_risk', 'team_risk', 'technology_risk', 'timing_risk', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});

const respondSchema = z.object({
  response: z.string().min(1, 'Response is required'),
});

const statusSchema = z.object({
  status: z.enum(['open', 'addressed', 'dismissed']),
});

// GET /api/deals/:dealId/devils-advocate - Get all devil's advocate comments for a deal
router.get('/:dealId/devils-advocate', requireAuth, async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    // Fetch comments with user information
    const comments = await db
      .select({
        id: devilsAdvocateComments.id,
        dealId: devilsAdvocateComments.dealId,
        userId: devilsAdvocateComments.userId,
        title: devilsAdvocateComments.title,
        content: devilsAdvocateComments.content,
        category: devilsAdvocateComments.category,
        severity: devilsAdvocateComments.severity,
        status: devilsAdvocateComments.status,
        response: devilsAdvocateComments.response,
        respondedBy: devilsAdvocateComments.respondedBy,
        respondedAt: devilsAdvocateComments.respondedAt,
        createdAt: devilsAdvocateComments.createdAt,
        updatedAt: devilsAdvocateComments.updatedAt,
        // User who created the comment
        userName: users.fullName,
        userInitials: users.initials,
        userAvatarColor: users.avatarColor,
      })
      .from(devilsAdvocateComments)
      .leftJoin(users, eq(devilsAdvocateComments.userId, users.id))
      .where(eq(devilsAdvocateComments.dealId, dealId))
      .orderBy(desc(devilsAdvocateComments.createdAt));

    // Fetch respondent information for comments that have responses
    const commentsWithRespondents = await Promise.all(
      comments.map(async (comment) => {
        let respondent = null;
        if (comment.respondedBy) {
          const [respondentData] = await db
            .select({
              id: users.id,
              fullName: users.fullName,
              initials: users.initials,
              avatarColor: users.avatarColor,
            })
            .from(users)
            .where(eq(users.id, comment.respondedBy));
          
          respondent = respondentData || null;
        }

        return {
          id: comment.id,
          dealId: comment.dealId,
          userId: comment.userId,
          title: comment.title,
          content: comment.content,
          category: comment.category,
          severity: comment.severity,
          status: comment.status,
          response: comment.response,
          respondedBy: comment.respondedBy,
          respondedAt: comment.respondedAt,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          user: comment.userName ? {
            id: comment.userId,
            fullName: comment.userName,
            initials: comment.userInitials,
            avatarColor: comment.userAvatarColor,
          } : null,
          respondent,
        };
      })
    );

    res.json(commentsWithRespondents);
  } catch (error) {
    console.error('Error fetching devil\'s advocate comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/deals/:dealId/devils-advocate - Create a new devil's advocate comment
router.post('/:dealId/devils-advocate', requireAuth, async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const userId = req.session.userId!;
    
    if (isNaN(dealId)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    const validatedData = createCommentSchema.parse(req.body);

    const [newComment] = await db
      .insert(devilsAdvocateComments)
      .values({
        dealId,
        userId,
        ...validatedData,
      })
      .returning();

    // Fetch the comment with user information
    const [commentWithUser] = await db
      .select({
        id: devilsAdvocateComments.id,
        dealId: devilsAdvocateComments.dealId,
        userId: devilsAdvocateComments.userId,
        title: devilsAdvocateComments.title,
        content: devilsAdvocateComments.content,
        category: devilsAdvocateComments.category,
        severity: devilsAdvocateComments.severity,
        status: devilsAdvocateComments.status,
        response: devilsAdvocateComments.response,
        respondedBy: devilsAdvocateComments.respondedBy,
        respondedAt: devilsAdvocateComments.respondedAt,
        createdAt: devilsAdvocateComments.createdAt,
        updatedAt: devilsAdvocateComments.updatedAt,
        userName: users.fullName,
        userInitials: users.initials,
        userAvatarColor: users.avatarColor,
      })
      .from(devilsAdvocateComments)
      .leftJoin(users, eq(devilsAdvocateComments.userId, users.id))
      .where(eq(devilsAdvocateComments.id, newComment.id));

    const result = {
      ...commentWithUser,
      user: commentWithUser.userName ? {
        id: commentWithUser.userId,
        fullName: commentWithUser.userName,
        initials: commentWithUser.userInitials,
        avatarColor: commentWithUser.userAvatarColor,
      } : null,
      respondent: null,
    };

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating devil\'s advocate comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// PATCH /api/deals/:dealId/devils-advocate/:commentId/respond - Add response to a comment
router.patch('/:dealId/devils-advocate/:commentId/respond', requireAuth, async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const commentId = parseInt(req.params.commentId);
    const userId = req.session.userId!;
    
    if (isNaN(dealId) || isNaN(commentId)) {
      return res.status(400).json({ error: 'Invalid deal ID or comment ID' });
    }

    const validatedData = respondSchema.parse(req.body);

    const [updatedComment] = await db
      .update(devilsAdvocateComments)
      .set({
        response: validatedData.response,
        respondedBy: userId,
        respondedAt: new Date(),
        status: 'addressed',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(devilsAdvocateComments.id, commentId),
          eq(devilsAdvocateComments.dealId, dealId)
        )
      )
      .returning();

    if (!updatedComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json(updatedComment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error responding to devil\'s advocate comment:', error);
    res.status(500).json({ error: 'Failed to respond to comment' });
  }
});

// PATCH /api/deals/:dealId/devils-advocate/:commentId/status - Update comment status
router.patch('/:dealId/devils-advocate/:commentId/status', requireAuth, async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const commentId = parseInt(req.params.commentId);
    
    if (isNaN(dealId) || isNaN(commentId)) {
      return res.status(400).json({ error: 'Invalid deal ID or comment ID' });
    }

    const validatedData = statusSchema.parse(req.body);

    const [updatedComment] = await db
      .update(devilsAdvocateComments)
      .set({
        status: validatedData.status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(devilsAdvocateComments.id, commentId),
          eq(devilsAdvocateComments.dealId, dealId)
        )
      )
      .returning();

    if (!updatedComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json(updatedComment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating devil\'s advocate comment status:', error);
    res.status(500).json({ error: 'Failed to update comment status' });
  }
});

// DELETE /api/deals/:dealId/devils-advocate/:commentId - Delete a comment (optional)
router.delete('/:dealId/devils-advocate/:commentId', requireAuth, async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const commentId = parseInt(req.params.commentId);
    const userId = req.session.userId!;
    
    if (isNaN(dealId) || isNaN(commentId)) {
      return res.status(400).json({ error: 'Invalid deal ID or comment ID' });
    }

    // Only allow the comment author or admin to delete
    const [comment] = await db
      .select()
      .from(devilsAdvocateComments)
      .where(
        and(
          eq(devilsAdvocateComments.id, commentId),
          eq(devilsAdvocateComments.dealId, dealId)
        )
      );

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.userId !== userId && req.session.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    await db
      .delete(devilsAdvocateComments)
      .where(eq(devilsAdvocateComments.id, commentId));

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting devil\'s advocate comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;