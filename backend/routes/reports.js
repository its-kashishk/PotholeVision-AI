const express = require('express');
const Report = require('../models/Report');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');
const { cloudinary, upload } = require('../config/cloudinary');
const { analyzeRoadImage, generateRoadExplanation, calculateSustainabilityImpact } = require('../services/aiService');
const { DetectionError } = require('../services/roadDamageDetector');

const router = express.Router();

// Best-effort cleanup: remove an already-uploaded Cloudinary asset when analysis
// fails after upload, so we don't accumulate orphaned images for reports that
// were never saved.
const cleanupUpload = async (req) => {
  if (req.file && req.file.filename) {
    try { await cloudinary.uploader.destroy(req.file.filename); }
    catch (err) { console.error('Cloudinary cleanup failed:', err.message); }
  }
};

// Submit new report
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { description, latitude, longitude, address, city, state, pincode, isAnonymous } = req.body;

    if (!req.file) return res.status(400).json({ error: 'Please upload a road image' });
    if (!latitude || !longitude) {
      await cleanupUpload(req);
      return res.status(400).json({ error: 'Location is required' });
    }

    const imageUrl = req.file.path;
    const imagePublicId = req.file.filename;

    // Run AI analysis (real YOLOv8 model — see ml/README.md). On failure,
    // DetectionError carries the right HTTP status/code; the report is not
    // created and the already-uploaded Cloudinary asset is removed.
    let cvAnalysis;
    try {
      cvAnalysis = await analyzeRoadImage(imageUrl);
    } catch (err) {
      await cleanupUpload(req);
      if (err instanceof DetectionError) {
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      throw err;
    }

    const { explanation, safetyPrecautions } = await generateRoadExplanation(cvAnalysis, description);
    const sustainabilityImpact = calculateSustainabilityImpact(cvAnalysis.severityLevel, cvAnalysis.primaryIssue);

    const report = await Report.create({
      submittedBy: req.user._id,
      description: description || '',
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
        address: address || '',
        city: city || '',
        state: state || '',
        pincode: pincode || ''
      },
      imageUrl,
      imagePublicId,
      aiAnalysis: {
        ...cvAnalysis,
        aiExplanation: explanation,
        safetyPrecautions
      },
      sustainabilityImpact,
      isAnonymous: isAnonymous === 'true'
    });

    // Update user's report count
    await User.findByIdAndUpdate(req.user._id, { $inc: { reportsSubmitted: 1 } });

    await report.populate('submittedBy', 'name email');
    res.status(201).json({ success: true, report });
  } catch (err) {
    console.error('Report submission error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Get all reports (with filters)
router.get('/', protect, async (req, res) => {
  try {
    const { status, severity, city, limit = 50, page = 1, sortBy = '-createdAt' } = req.query;
    const filter = {};

    // Citizens only see their own reports unless municipality/admin
    if (req.user.role === 'citizen') filter.submittedBy = req.user._id;
    if (status) filter.status = status;
    if (severity) filter['aiAnalysis.severityLevel'] = severity;
    if (city) filter['location.city'] = new RegExp(city, 'i');

    const reports = await Report.find(filter)
      .populate('submittedBy', 'name email')
      .sort(sortBy)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Report.countDocuments(filter);
    res.json({ success: true, reports, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get single report
router.get('/:id', protect, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).populate('submittedBy', 'name email');
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ success: true, report });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update report status (municipality/admin only)
router.patch('/:id/status', protect, restrictTo('municipality', 'admin'), async (req, res) => {
  try {
    const { status, municipalityNotes, assignedTo } = req.body;
    const update = { status, municipalityNotes, assignedTo };
    if (status === 'resolved') {
      update.resolvedAt = new Date();
      update.resolvedBy = req.user._id;
    }
    const report = await Report.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('submittedBy', 'name email');
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ success: true, report });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upvote report
router.post('/:id/upvote', protect, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const alreadyVoted = report.upvotedBy.includes(req.user._id);
    if (alreadyVoted) {
      report.upvotedBy.pull(req.user._id);
      report.upvotes = Math.max(0, report.upvotes - 1);
    } else {
      report.upvotedBy.push(req.user._id);
      report.upvotes += 1;
    }
    await report.save();
    res.json({ success: true, upvotes: report.upvotes, voted: !alreadyVoted });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get user's own reports
router.get('/user/my-reports', protect, async (req, res) => {
  try {
    const reports = await Report.find({ submittedBy: req.user._id }).sort('-createdAt');
    res.json({ success: true, reports });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
