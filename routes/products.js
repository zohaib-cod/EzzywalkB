import express from 'express';
import { prisma } from '../prismaClient.js';
import { notifyAdminEvent } from '../utils/notifier.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { category, brand, search } = req.query;
    const where = {};
    if (category) where.category = category;
    if (brand) where.brand = brand;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    
    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id }
    });
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/sale', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isSeasonEndSale: true }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

export default router;
