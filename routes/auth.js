import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prismaClient.js';
import { notifyAdminEvent } from '../utils/notifier.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const count = await prisma.user.count();
    const role = count === 0 ? 'MASTER_ADMIN' : 'USER';
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role
      }
    });

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, keepLogged } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (user.isBlocked) {
      return res.status(403).json({ error: 'Your account has been blocked by the Master Admin.' });
    }

    const expiresIn = keepLogged ? '30d' : '2h';
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

export default router;

router.post('/admin-register-init', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    // Generate 6 digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    await prisma.adminOTP.upsert({
      where: { email },
      update: { code, expiresAt: new Date(Date.now() + 10 * 60000) },
      create: { email, code, expiresAt: new Date(Date.now() + 10 * 60000) }
    });

    await notifyAdminEvent('OTP', { code });
    res.json({ message: 'OTP generated and sent to master admin.' });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/admin-register-verify', async (req, res) => {
  try {
    const { name, email, password, otp } = req.body;
    
    const record = await prisma.adminOTP.findUnique({ where: { email } });
    if (!record || record.code !== otp || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'ADMIN' // They successfully verified OTP
      }
    });

    await prisma.adminOTP.delete({ where: { email } });
    res.json({ message: 'Admin account created successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/admin-accept-invite', async (req, res) => {
  try {
    const { email, token, name, password, useMasterPassword } = req.body;

    const invite = await prisma.adminInvite.findUnique({ where: { token } });
    if (!invite || invite.email !== email || invite.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired invitation link.' });
    }

    let finalPassword = password;
    if (useMasterPassword) {
      // Find master admin to copy password hash
      const master = await prisma.user.findFirst({ where: { role: 'MASTER_ADMIN' } });
      if (!master) return res.status(500).json({ error: 'Master admin not found' });
      finalPassword = master.password; // Note: We just assign the existing hash directly
    } else {
      finalPassword = await bcrypt.hash(password, 10);
    }

    await prisma.user.create({
      data: {
        name,
        email,
        password: finalPassword,
        role: 'ADMIN'
      }
    });

    await prisma.adminInvite.delete({ where: { token } });
    res.json({ message: 'Co-Admin account created successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept invitation.' });
  }
});

router.post('/subscribe-push', async (req, res) => {
  try {
    const { email, subscription } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    await prisma.pushSubscription.create({
      data: {
        userId: user.id,
        endpoint: subscription.endpoint,
        keys: subscription.keys
      }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

