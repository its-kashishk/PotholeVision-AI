const express = require('express');
const Report = require('../models/Report');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/metrics', protect, async (req, res) => {
  try {
    const resolved = await Report.find({ status: 'resolved' });
    const total = await Report.countDocuments();
    const totalResolved = resolved.length;

    let totalFuelSavings = 0;
    let totalCO2Reduction = 0;
    let totalAccidentRisk = 0;

    resolved.forEach(r => {
      totalFuelSavings += r.sustainabilityImpact?.estimatedFuelSavingsLiters || 0;
      totalCO2Reduction += r.sustainabilityImpact?.estimatedCO2ReductionKg || 0;
      totalAccidentRisk += r.sustainabilityImpact?.accidentRiskReduced || 0;
    });

    const activeHazards = await Report.countDocuments({ status: { $ne: 'resolved' } });
    const criticalCount = await Report.countDocuments({ 'aiAnalysis.severityLevel': 'critical', status: { $ne: 'resolved' } });

    // SDG progress scores (0-100)
    const resolutionRate = total > 0 ? (totalResolved / total) * 100 : 0;
    const sdgScores = {
      sdg11: Math.min(100, Math.round(resolutionRate * 0.8 + (totalResolved * 2))),
      sdg9:  Math.min(100, Math.round(totalResolved * 1.5)),
      sdg13: Math.min(100, Math.round((totalCO2Reduction / 100) * 10))
    };

    res.json({
      success: true,
      metrics: {
        totalReports: total,
        totalResolved,
        activeHazards,
        criticalHazards: criticalCount,
        estimatedAccidentsPrevented: Math.round(totalAccidentRisk / 10),
        estimatedFuelSavingsLiters: Math.round(totalFuelSavings * 10) / 10,
        estimatedCO2ReductionKg: Math.round(totalCO2Reduction * 10) / 10,
        estimatedTreesEquivalent: Math.round(totalCO2Reduction / 21),
        resolutionRate: Math.round(resolutionRate),
        sdgProgress: sdgScores
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
