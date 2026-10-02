import express from 'express';
import { prisma } from '../prismaClient.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const authAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'ADMIN' && decoded.role !== 'MASTER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

router.get('/', async (req, res) => {
  try {
    const slides = await prisma.heroSlide.findMany({
      orderBy: { order: 'asc' }
    });
    res.json(slides);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch slides' });
  }
});

router.post('/', authAdmin, async (req, res) => {
  try {
    const { id, ...data } = req.body;
    const slide = await prisma.heroSlide.create({
      data: data
    });
    res.status(201).json(slide);
  } catch (error) {
    console.error('Create Slide Error:', error);
    res.status(500).json({ error: 'Failed to create slide' });
  }
});

router.put('/:id', authAdmin, async (req, res) => {
  try {
    const { id, ...data } = req.body;
    const slide = await prisma.heroSlide.update({
      where: { id: req.params.id },
      data: data
    });
    res.json(slide);
  } catch (error) {
    console.error('Update Slide Error:', error);
    res.status(500).json({ error: 'Failed to update slide' });
  }
});

router.delete('/:id', authAdmin, async (req, res) => {
  try {
    await prisma.heroSlide.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete slide' });
  }
});

export default router;
