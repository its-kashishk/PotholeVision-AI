const express = require('express');
const { protect } = require('../middleware/auth');
const { answerRoadSafetyQuestion, generateRoadExplanation, analyzeRoadImage } = require('../services/aiService');
const { DetectionError } = require('../services/roadDamageDetector');
const Report = require('../models/Report');

const router = express.Router();

// AI Chat - ask road safety questions
router.post('/chat', protect, async (req, res) => {
  try {
    const { question, reportId } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });

    let reportContext = '';
    if (reportId) {
      const report = await Report.findById(reportId);
      if (report) {
        reportContext = `Report ID: ${report.reportId}, Issue: ${report.aiAnalysis.primaryIssue}, Severity: ${report.aiAnalysis.severityLevel}, Location: ${report.location.address}`;
      }
    }

    const answer = await answerRoadSafetyQuestion(question, reportContext);
    res.json({ success: true, answer, timestamp: new Date() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Re-analyze a report
router.post('/reanalyze/:reportId', protect, async (req, res) => {
  try {
    const report = await Report.findById(req.params.reportId);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    let cvAnalysis;
    try {
      cvAnalysis = await analyzeRoadImage(report.imageUrl);
    } catch (err) {
      if (err instanceof DetectionError) {
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      throw err;
    }
    const { explanation, safetyPrecautions } = await generateRoadExplanation(cvAnalysis, report.description);

    report.aiAnalysis = { ...cvAnalysis, aiExplanation: explanation, safetyPrecautions };
    await report.save();

    res.json({ success: true, aiAnalysis: report.aiAnalysis });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get AI summary for a report
router.get('/summary/:reportId', protect, async (req, res) => {
  try {
    const report = await Report.findById(req.params.reportId).populate('submittedBy', 'name');
    if (!report) return res.status(404).json({ error: 'Report not found' });

    res.json({
      success: true,
      summary: {
        reportId: report.reportId,
        primaryIssue: report.aiAnalysis.primaryIssue,
        severityLevel: report.aiAnalysis.severityLevel,
        explanation: report.aiAnalysis.aiExplanation,
        safetyPrecautions: report.aiAnalysis.safetyPrecautions,
        location: report.location.address,
        status: report.status,
        sustainabilityImpact: report.sustainabilityImpact
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
