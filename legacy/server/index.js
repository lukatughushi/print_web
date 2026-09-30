const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./src/routes/auth');
const productRoutes = require('./src/routes/products');
const orderRoutes = require('./src/routes/orders');
const adminRoutes = require('./src/routes/admin');
const bannerPublicRoutes = require('./src/routes/banners');
const bannerAdminRoutes  = require('./src/routes/adminBanners');
const settingsPublicRoutes = require('./src/routes/settings');
const settingsAdminRoutes  = require('./src/routes/adminSettings');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
// Orders carry custom design artwork (uploaded images + print file) as data URLs.
app.use('/api/orders', express.json({ limit: '60mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/banners', bannerPublicRoutes);
app.use('/api/admin/banners', bannerAdminRoutes);
app.use('/api/settings', settingsPublicRoutes);
app.use('/api/admin/settings', settingsAdminRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'printify-ge API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
