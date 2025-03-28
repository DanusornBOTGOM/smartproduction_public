const express = require('express');
const router = express.Router();


// Import routes
const annealingRoutes = require('./production/annealing');
const bar1Routes = require('./production/bar1')

// Use routes
router.use('/annealing', annealingRoutes);
router.use('/bar1', bar1Routes)

module.exports = router;