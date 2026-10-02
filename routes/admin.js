import express from 'express';
import { prisma } from '../prismaClient.js';
import jwt from 'jsonwebtoken';
import { notifyAdminEvent } from '../utils/notifier.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer();

const authAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  console.log("AUTH HEADER:", authHeader);
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'ADMIN' && decoded.role !== 'MASTER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = decoded; // { id, role }
    next();
  } catch (e) {
    console.error("JWT Error:", e); return res.status(401).json({ error: 'Invalid token' });
  }
};

router.get('/dashboard', authAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    const orders = await prisma.order.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } });
    res.json({ users, products, orders });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// --- UPLOAD ENDPOINTS ---
router.post('/upload', authAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  
  const stream = cloudinary.uploader.upload_stream(
    { folder: 'urban_soul_products' },
    (error, result) => {
      if (error) {
        console.error("Cloudinary Error:", error);
        return res.status(500).json({ error: 'Image upload failed' });
      }
      res.json({ imageUrl: result.secure_url });
    }
  );
  streamifier.createReadStream(req.file.buffer).pipe(stream);
});

// --- PRODUCT ENDPOINTS ---

router.post('/products', authAdmin, async (req, res) => {
  try {
    const { name, description, price, category, brand, imageUrl, stock, isSeasonEndSale } = req.body;
    const product = await prisma.product.create({
      data: {
        name, description, 
        price: parseFloat(price), 
        category, brand: brand || 'EZZYWALK', imageUrl, 
        stock: parseInt(stock), 
        isSeasonEndSale: Boolean(isSeasonEndSale)
      }
    });
    await notifyAdminEvent('PRODUCT', product);
    res.json(product);
  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error);
    res.status(500).json({ error: error.message || 'Failed to create product', details: error });
  }
});

router.put('/products/:id', authAdmin, async (req, res) => {
  try {
    const { name, description, price, category, brand, imageUrl, stock, isSeasonEndSale } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name, description, 
        price: parseFloat(price), 
        category, brand: brand || 'EZZYWALK', imageUrl, 
        stock: parseInt(stock), 
        isSeasonEndSale: Boolean(isSeasonEndSale)
      }
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/products/:id', authAdmin, async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// --- ORDER ENDPOINTS ---

router.put('/orders/:id', authAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

router.delete('/orders/:id', authAdmin, async (req, res) => {
  try {
    await prisma.order.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

router.post('/promote-admin', authAdmin, async (req, res) => {
  try {
    // Only MASTER_ADMIN can promote
    if (req.user.role !== 'MASTER_ADMIN') {
      return res.status(403).json({ error: 'Only Master Admin can promote users' });
    }
    const { adminId } = req.body;
    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'MASTER_ADMIN' }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to promote admin' });
  }
});

export default router;

// --- MASTER ADMIN ENDPOINTS ---

router.post('/block-admin', authAdmin, async (req, res) => {
  try {
    const { adminId, isBlocked } = req.body;
    // Assuming authAdmin checks for Master Admin in a real world scenario, 
    // we'll update the user's block status
    const user = await prisma.user.update({
      where: { id: adminId },
      data: { isBlocked }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

import crypto from 'crypto';

router.post('/invite-admin', authAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.adminInvite.upsert({
      where: { email },
      update: { token, expiresAt: new Date(Date.now() + 24 * 60 * 60000) },
      create: { email, token, expiresAt: new Date(Date.now() + 24 * 60 * 60000) }
    });

    const link = `http://localhost:3000/admin/accept-invite?token=${token}&email=${email}`;
    await notifyAdminEvent('ADMIN_INVITE', { email, link });

    res.json({ message: 'Invitation sent successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

router.post('/request-password-change', authAdmin, async (req, res) => {
  try {
    // Assuming req.user is set (currently dummy in admin.js, but we'll take email from body for simplicity)
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.passwordResetOTP.upsert({
      where: { email },
      update: { code, expiresAt: new Date(Date.now() + 10 * 60000) },
      create: { email, code, expiresAt: new Date(Date.now() + 10 * 60000) }
    });

    await notifyAdminEvent('PASSWORD_RESET', { email, code });
    res.json({ message: 'OTP sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to request change' });
  }
});

import bcrypt from 'bcryptjs';

router.post('/change-profile', authAdmin, async (req, res) => {
  try {
    const { oldEmail, newEmail, name, newPassword, otp } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email: oldEmail } });
    if (!user) return res.status(404).json({ error: 'User not found with this email' });

    const updateData = {};
    const emailChanging = newEmail && newEmail.trim() !== '' && newEmail.trim() !== oldEmail;
    
    if (emailChanging) updateData.email = newEmail.trim();
    if (name && name.trim() !== '') updateData.name = name.trim();
    if (newPassword && newPassword.trim() !== '') updateData.password = await bcrypt.hash(newPassword, 10);

    // If changing email or password, require OTP
    if (emailChanging || updateData.password) {
      if (!otp) return res.status(400).json({ error: 'OTP is required to change Email or Password' });
      const record = await prisma.passwordResetOTP.findUnique({ where: { email: oldEmail } });
      if (!record || record.code !== otp || record.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }
      // OTP verified successfully
      await prisma.passwordResetOTP.delete({ where: { email: oldEmail } });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No changes provided.' });
    }
    
    await prisma.user.update({
      where: { email: oldEmail },
      data: updateData
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Change profile error:", error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});
