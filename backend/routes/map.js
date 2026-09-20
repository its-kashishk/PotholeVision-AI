const express = require('express');
const Report = require('../models/Report');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get all reports for map display
router.get('/hazards', protect, async (req, res) => {
  try {
    const { severity, status, bounds } = req.query;
    const filter = {};
    if (severity) filter['aiAnalysis.severityLevel'] = { $in: severity.split(',') };
    if (status) filter.status = { $in: status.split(',') };

    // Bounding box filter: bounds=swLng,swLat,neLng,neLat
    if (bounds) {
      const [swLng, swLat, neLng, neLat] = bounds.split(',').map(Number);
      filter.location = {
        $geoWithin: {
          $box: [[swLng, swLat], [neLng, neLat]]
        }
      };
    }

    const reports = await Report.find(filter)
      .select('location aiAnalysis.severityLevel aiAnalysis.primaryIssue aiAnalysis.overallConfidence status reportId createdAt upvotes')
      .limit(500);

    const features = reports.map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: r.location.coordinates },
      properties: {
        id: r._id,
        reportId: r.reportId,
        severity: r.aiAnalysis.severityLevel,
        issue: r.aiAnalysis.primaryIssue,
        confidence: r.aiAnalysis.overallConfidence,
        status: r.status,
        upvotes: r.upvotes,
        address: r.location.address,
        createdAt: r.createdAt
      }
    }));

    res.json({
      type: 'FeatureCollection',
      features,
      total: features.length
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get nearby hazards
router.get('/nearby', protect, async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const reports = await Report.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(radius)
        }
      }
    }).limit(20).select('location aiAnalysis status reportId createdAt');

    res.json({ success: true, reports });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get heatmap data
router.get('/heatmap', protect, async (req, res) => {
  try {
    const reports = await Report.find({ status: { $ne: 'resolved' } })
      .select('location aiAnalysis.severityLevel')
      .limit(1000);

    const heatmapData = reports.map(r => {
      const weights = { critical: 1.0, high: 0.75, medium: 0.5, low: 0.25 };
      return {
        lat: r.location.coordinates[1],
        lng: r.location.coordinates[0],
        weight: weights[r.aiAnalysis.severityLevel] || 0.5
      };
    });

    res.json({ success: true, heatmapData });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
