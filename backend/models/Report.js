const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportId: { type: String, unique: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'Road Hazard Report' },
  description: { type: String, default: '' },
  
  // Location
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' }
  },
  
  // Image
  imageUrl: { type: String, required: true },
  imagePublicId: { type: String },
  
  // AI Analysis
  aiAnalysis: {
    detectedIssues: [{
      type: { type: String, enum: ['pothole', 'crack', 'waterlogging', 'broken_surface', 'unknown'] },
      confidence: { type: Number, min: 0, max: 1 },
      boundingBox: {
        x: Number, y: Number, width: Number, height: Number
      }
    }],
    primaryIssue: { type: String, default: 'unknown' },
    severityScore: { type: Number, min: 0, max: 100 },
    severityLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    severityExplanation: { type: String, default: '' },
    overallConfidence: { type: Number, min: 0, max: 1, default: 0 },
    aiExplanation: { type: String, default: '' },
    safetyPrecautions: [String],
    analysisTimestamp: { type: Date, default: Date.now }
  },
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'resolved', 'rejected'], 
    default: 'pending' 
  },
  
  // Municipality fields
  assignedTo: { type: String, default: '' },
  municipalityNotes: { type: String, default: '' },
  resolvedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Sustainability metrics
  sustainabilityImpact: {
    accidentRiskReduced: { type: Number, default: 0 },
    estimatedFuelSavingsLiters: { type: Number, default: 0 },
    estimatedCO2ReductionKg: { type: Number, default: 0 }
  },
  
  upvotes: { type: Number, default: 0 },
  upvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  isAnonymous: { type: Boolean, default: false }
}, { timestamps: true });

reportSchema.index({ location: '2dsphere' });
reportSchema.index({ status: 1 });
reportSchema.index({ 'aiAnalysis.severityLevel': 1 });
reportSchema.index({ createdAt: -1 });

// Generate report ID
reportSchema.pre('save', function(next) {
  if (!this.reportId) {
    this.reportId = 'PV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Report', reportSchema);
