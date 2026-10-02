import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import bannerRoutes from './routes/banners.js';
import productsRoutes from './routes/products.js';
import ordersRoutes from './routes/orders.js';
import heroSlidesRoutes from './routes/heroSlides.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
import aiRoutes from './routes/ai.js';

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/heroSlides', heroSlidesRoutes);
app.use('/api/ai', aiRoutes);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;

// Trigger nodemon restart for env vars
