const express = require('express');
const Report = require('../models/Report');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Dashboard analytics
router.get('/analytics', protect, restrictTo('municipality', 'admin'), async (req, res) => {
  try {
    const [total, pending, inProgress, resolved, rejected] = await Promise.all([
      Report.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments({ status: 'in_progress' }),
      Report.countDocuments({ status: 'resolved' }),
      Report.countDocuments({ status: 'rejected' })
    ]);

    const bySeverity = await Report.aggregate([
      { $group: { _id: '$aiAnalysis.severityLevel', count: { $sum: 1 } } }
    ]);

    const byIssue = await Report.aggregate([
      { $group: { _id: '$aiAnalysis.primaryIssue', count: { $sum: 1 } } }
    ]);

    // Reports over last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyReports = await Report.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Top cities
    const topCities = await Report.aggregate([
      { $group: { _id: '$location.city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      analytics: {
        totals: { total, pending, inProgress, resolved, rejected },
        bySeverity: bySeverity.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        byIssue: byIssue.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        dailyReports,
        topCities,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get priority queue (critical & high first)
router.get('/priority-queue', protect, restrictTo('municipality', 'admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = status ? { status } : { status: { $in: ['pending', 'in_progress'] } };

    const reports = await Report.find(filter)
      .populate('submittedBy', 'name email')
      .sort({
        'aiAnalysis.severityScore': -1,
        upvotes: -1,
        createdAt: 1
      })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Report.countDocuments(filter);
    res.json({ success: true, reports, total });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bulk update status
router.patch('/bulk-status', protect, restrictTo('municipality', 'admin'), async (req, res) => {
  try {
    const { reportIds, status, notes } = req.body;
    const update = { status };
    if (notes) update.municipalityNotes = notes;
    if (status === 'resolved') update.resolvedAt = new Date();

    await Report.updateMany({ _id: { $in: reportIds } }, update);
    res.json({ success: true, message: `Updated ${reportIds.length} reports` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all users (admin only)
router.get('/users', protect, restrictTo('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort('-createdAt');
    res.json({ success: true, users });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
