import express from 'express';
import { prisma } from '../prismaClient.js';
import { notifyAdminEvent } from '../utils/notifier.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const authenticate = (req, res, next) => {
  req.user = { id: "dummy", role: "USER" };
  next();
};

router.get('/me', authenticate, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { totalAmount, itemsJson, userId, customerName, email, address, phone } = req.body;
    
    let validUserId = undefined;
    if (userId) {
      const existingUser = await prisma.user.findUnique({ where: { id: userId } });
      if (existingUser) validUserId = userId;
    }

    const order = await prisma.order.create({
      data: {
        totalAmount: parseFloat(totalAmount),
        items: itemsJson ? JSON.parse(itemsJson) : [],
        userId: validUserId,
        customerInfo: {
          customerName,
          email,
          address,
          phone
        }
      }
    });
    
    await notifyAdminEvent('ORDER', order);
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

export default router;
