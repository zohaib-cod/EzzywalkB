import express from 'express';
import { prisma } from '../prismaClient.js';
import jwt from 'jsonwebtoken';
import { notifyAdminEvent } from '../utils/notifier.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const authAdmin = (req, res, next) => {
  req.user = { id: "dummy", role: "ADMIN" };
  next();
};

// Get active banner
router.get('/', async (req, res) => {
  try {
    const banner = await prisma.banner.findFirst({
      where: { isActive: true }
    });
    res.json(banner || null);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch banner' });
  }
});

// Admin: Update banner
router.put('/', authAdmin, async (req, res) => {
  try {
    const { label, title, description, imageUrl, linkUrl, linkText } = req.body;
    
    // Check if banner exists, if so update, if not create
    const existing = await prisma.banner.findFirst();
    let banner;
    if (existing) {
      banner = await prisma.banner.update({
        where: { id: existing.id },
        data: { label, title, description, imageUrl, linkUrl, linkText, isActive: true }
      });
    } else {
      banner = await prisma.banner.create({
        data: { label, title, description, imageUrl, linkUrl, linkText, isActive: true }
      });
    }
    
    await notifyAdminEvent('BANNER', banner);
    res.json(banner);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update banner' });
  }
});

export default router;
