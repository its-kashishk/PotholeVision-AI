const express = require('express');
const PDFDocument = require('pdfkit');
const Report = require('../models/Report');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/report/:reportId', protect, async (req, res) => {
  try {
    const report = await Report.findById(req.params.reportId).populate('submittedBy', 'name email');
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PotholeVision-${report.reportId}.pdf"`);
    doc.pipe(res);

    // Header
    doc.rect(0, 0, doc.page.width, 100).fill('#1a56db');
    doc.fillColor('white').fontSize(24).font('Helvetica-Bold').text('PotholeVision AI', 50, 30);
    doc.fontSize(12).font('Helvetica').text('Intelligent Road Damage Detection & Reporting System', 50, 58);
    doc.fontSize(10).text(`Report ID: ${report.reportId}`, 50, 78);

    doc.fillColor('#1a1a2e').moveDown(2);

    // Report Details
    doc.fontSize(16).font('Helvetica-Bold').text('ROAD HAZARD REPORT', 50, 120);
    doc.moveTo(50, 140).lineTo(545, 140).stroke('#1a56db');

    doc.fontSize(11).font('Helvetica');
    const leftX = 50, rightX = 300;
    let y = 155;

    const addRow = (label, value, x = leftX, currentY = y) => {
      doc.font('Helvetica-Bold').text(`${label}:`, x, currentY);
      doc.font('Helvetica').text(value || 'N/A', x + 120, currentY, { width: 180 });
    };

    addRow('Report ID', report.reportId, leftX, y);
    addRow('Date', new Date(report.createdAt).toLocaleDateString('en-IN'), rightX, y);
    y += 20;
    addRow('Reported By', report.isAnonymous ? 'Anonymous' : report.submittedBy?.name, leftX, y);
    addRow('Status', report.status.toUpperCase(), rightX, y);
    y += 20;
    addRow('Location', report.location.address || `${report.location.city}, ${report.location.state}`, leftX, y);
    y += 20;
    addRow('Coordinates', `${report.location.coordinates[1]?.toFixed(4)}, ${report.location.coordinates[0]?.toFixed(4)}`, leftX, y);

    // AI Analysis Section
    y += 40;
    doc.rect(50, y, 495, 30).fill('#f0f4ff');
    doc.fillColor('#1a56db').fontSize(13).font('Helvetica-Bold').text('AI ANALYSIS RESULTS', 60, y + 8);
    doc.fillColor('#1a1a2e').fontSize(11);
    y += 40;

    const severityColors = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a' };
    const sevColor = severityColors[report.aiAnalysis.severityLevel] || '#1a56db';

    addRow('Primary Issue', (report.aiAnalysis.primaryIssue || 'N/A').replace('_', ' ').toUpperCase(), leftX, y);
    addRow('Severity Level', report.aiAnalysis.severityLevel?.toUpperCase(), rightX, y);
    y += 20;
    addRow('Severity Score', `${report.aiAnalysis.severityScore}/100`, leftX, y);
    addRow('Confidence', `${Math.round((report.aiAnalysis.overallConfidence || 0) * 100)}%`, rightX, y);

    // Detected Issues
    y += 30;
    doc.font('Helvetica-Bold').text('Detected Issues:', leftX, y);
    y += 15;
    (report.aiAnalysis.detectedIssues || []).forEach(issue => {
      doc.font('Helvetica').text(`• ${issue.type?.replace('_', ' ')} — ${Math.round((issue.confidence || 0) * 100)}% confidence`, leftX + 10, y);
      y += 15;
    });

    // AI Explanation
    y += 10;
    doc.rect(50, y, 495, 20).fill('#f8fafc');
    doc.fillColor('#1a56db').fontSize(12).font('Helvetica-Bold').text('AI EXPLANATION', 60, y + 4);
    doc.fillColor('#1a1a2e').fontSize(10).font('Helvetica');
    y += 25;
    doc.text(report.aiAnalysis.aiExplanation || 'Analysis not available', leftX, y, { width: 495, align: 'justify' });
    y = doc.y + 15;

    // Safety Precautions
    doc.rect(50, y, 495, 20).fill('#fef3c7');
    doc.fillColor('#92400e').fontSize(12).font('Helvetica-Bold').text('⚠ SAFETY PRECAUTIONS', 60, y + 4);
    doc.fillColor('#1a1a2e').fontSize(10).font('Helvetica');
    y += 25;
    (report.aiAnalysis.safetyPrecautions || []).forEach((p, i) => {
      doc.text(`${i + 1}. ${p}`, leftX + 10, y, { width: 480 });
      y = doc.y + 5;
    });

    // Sustainability Impact
    y += 10;
    doc.rect(50, y, 495, 20).fill('#dcfce7');
    doc.fillColor('#166534').fontSize(12).font('Helvetica-Bold').text('🌿 SUSTAINABILITY IMPACT (if resolved)', 60, y + 4);
    doc.fillColor('#1a1a2e').fontSize(10).font('Helvetica');
    y += 25;
    doc.text(`• Estimated Fuel Savings: ${report.sustainabilityImpact?.estimatedFuelSavingsLiters || 0} liters/month`, leftX + 10, y);
    y = doc.y + 5;
    doc.text(`• CO₂ Reduction: ${report.sustainabilityImpact?.estimatedCO2ReductionKg || 0} kg/month`, leftX + 10, y);
    y = doc.y + 5;
    doc.text(`• Accident Risk Reduction: ${report.sustainabilityImpact?.accidentRiskReduced || 0}%`, leftX + 10, y);

    // Footer
    doc.rect(0, doc.page.height - 60, doc.page.width, 60).fill('#1a56db');
    doc.fillColor('white').fontSize(9).font('Helvetica')
      .text('Generated by PotholeVision AI | Powered by Groq LLaMA3 & YOLOv8', 50, doc.page.height - 45)
      .text(`SDG 11: Sustainable Cities | SDG 9: Innovation | SDG 13: Climate Action | ${new Date().toLocaleDateString()}`, 50, doc.page.height - 28);

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Bulk municipality report
router.get('/municipality-report', protect, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const filter = {};
    if (startDate && endDate) filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    if (status) filter.status = status;

    const reports = await Report.find(filter).populate('submittedBy', 'name').sort('-aiAnalysis.severityScore');
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Municipality-Report.pdf"');
    doc.pipe(res);

    doc.rect(0, 0, doc.page.width, 80).fill('#1a56db');
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold').text('PotholeVision AI — Municipality Report', 40, 20);
    doc.fontSize(11).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString()} | Total Reports: ${reports.length}`, 40, 50);

    let y = 100;
    doc.fillColor('#1a1a2e').fontSize(10).font('Helvetica-Bold');
    const cols = [40, 120, 220, 320, 400, 480, 570, 660];
    ['Report ID', 'Issue', 'Severity', 'Location', 'Status', 'Date', 'Confidence', 'Score'].forEach((h, i) => {
      doc.text(h, cols[i], y);
    });
    doc.moveTo(40, y + 15).lineTo(750, y + 15).stroke();
    y += 20;

    reports.slice(0, 40).forEach(r => {
      doc.font('Helvetica').fontSize(9);
      doc.text(r.reportId || '-', cols[0], y, { width: 75 });
      doc.text((r.aiAnalysis.primaryIssue || '-').replace('_', ' '), cols[1], y, { width: 95 });
      doc.text(r.aiAnalysis.severityLevel?.toUpperCase() || '-', cols[2], y, { width: 95 });
      doc.text(r.location.city || '-', cols[3], y, { width: 75 });
      doc.text(r.status || '-', cols[4], y, { width: 85 });
      doc.text(new Date(r.createdAt).toLocaleDateString('en-IN'), cols[5], y, { width: 85 });
      doc.text(`${Math.round((r.aiAnalysis.overallConfidence || 0) * 100)}%`, cols[6], y, { width: 80 });
      doc.text(`${r.aiAnalysis.severityScore || 0}/100`, cols[7], y, { width: 60 });
      y += 18;
      if (y > doc.page.height - 80) { doc.addPage({ layout: 'landscape' }); y = 50; }
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
