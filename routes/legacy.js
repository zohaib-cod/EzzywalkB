import express from 'express';
import { prisma } from '../prismaClient.js';
import { notifyAdminEvent } from '../utils/notifier.js';

const router = express.Router();

const authAdmin = (req, res, next) => {
  req.user = { id: "dummy", role: "ADMIN" };
  next();
};

// 1. Get active Legacy Section
router.get('/', async (req, res) => {
  try {
    const legacy = await prisma.legacySection.findFirst({
      where: { isActive: true }
    });
    res.json(legacy || null);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch legacy section' });
  }
});

// 2. Admin: Update or Create Legacy Section
router.put('/', authAdmin, async (req, res) => {
  try {
    const { 
      label, 
      title, 
      description, 
      imageUrl, 
      stat1Value, 
      stat1Label, 
      stat2Value, 
      stat2Label, 
      stat3Value, 
      stat3Label, 
      buttonText, 
      buttonLink 
    } = req.body;

    const existing = await prisma.legacySection.findFirst();
    let legacy;

    const dataPayload = {
      label: label ?? 'Our Legacy',
      title: title ?? 'Crafting footwear the right way, since 1998.',
      description: description ?? 'Ezzywalk began in 1998 with one standard: make shoes that last, in every style our customers live in.',
      imageUrl: imageUrl ?? 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&q=80',
      stat1Value: stat1Value ?? '27',
      stat1Label: stat1Label ?? 'years of craft',
      stat2Value: stat2Value ?? '40+',
      stat2Label: stat2Label ?? 'retail stores',
      stat3Value: stat3Value ?? '300',
      stat3Label: stat3Label ?? 'wholesale partners',
      buttonText: buttonText ?? 'Shop the collection',
      buttonLink: buttonLink ?? '/products',
      isActive: true
    };

    if (existing) {
      legacy = await prisma.legacySection.update({
        where: { id: existing.id },
        data: dataPayload
      });
    } else {
      legacy = await prisma.legacySection.create({
        data: dataPayload
      });
    }

    try {
      await notifyAdminEvent('LEGACY_SECTION', legacy);
    } catch (_) {}

    res.json(legacy);
  } catch (error) {
    console.error('Error updating legacy section:', error);
    res.status(500).json({ error: 'Failed to update legacy section' });
  }
});

// 3. Admin: Delete Legacy Section
router.delete('/', authAdmin, async (req, res) => {
  try {
    await prisma.legacySection.deleteMany({});
    res.json({ message: 'Legacy section deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete legacy section' });
  }
});

// 4. Admin: Delete Legacy Section by ID
router.delete('/:id', authAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.legacySection.delete({
      where: { id }
    });
    res.json({ message: 'Legacy section deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete legacy section' });
  }
});

export default router;
