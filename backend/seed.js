/**
 * PotholeVision AI - Database Seed Script
 * Run: node seed.js
 * Creates demo users and sample reports for testing
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ── Models ────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name: String, email: { type: String, unique: true },
  password: String, role: { type: String, default: 'citizen' },
  location: { city: String, state: String, country: { type: String, default: 'India' } },
  reportsSubmitted: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  lastLogin: Date
}, { timestamps: true });

const reportSchema = new mongoose.Schema({
  reportId: { type: String, unique: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: String, description: String,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number],
    address: String, city: String, state: String, pincode: String
  },
  imageUrl: String, imagePublicId: String,
  aiAnalysis: {
    detectedIssues: [{
      type: { type: String }, confidence: Number,
      boundingBox: { x: Number, y: Number, width: Number, height: Number }
    }],
    primaryIssue: String, severityScore: Number,
    severityLevel: { type: String, enum: ['low','medium','high','critical'] },
    overallConfidence: Number, aiExplanation: String,
    safetyPrecautions: [String], analysisTimestamp: Date
  },
  status: { type: String, enum: ['pending','in_progress','resolved','rejected'], default: 'pending' },
  assignedTo: String, municipalityNotes: String,
  resolvedAt: Date,
  sustainabilityImpact: {
    accidentRiskReduced: Number, estimatedFuelSavingsLiters: Number, estimatedCO2ReductionKg: Number
  },
  upvotes: { type: Number, default: 0 },
  isAnonymous: { type: Boolean, default: false }
}, { timestamps: true });

reportSchema.index({ location: '2dsphere' });

const User = mongoose.model('User', userSchema);
const Report = mongoose.model('Report', reportSchema);

// ── Sample Data ───────────────────────────────────────────
const cities = [
  { city: 'Dehradun', state: 'Uttarakhand', coords: [78.0322, 30.3165] },
  { city: 'Lucknow', state: 'Uttar Pradesh', coords: [80.9462, 26.8467] },
  { city: 'Jaipur', state: 'Rajasthan', coords: [75.7873, 26.9124] },
  { city: 'Mumbai', state: 'Maharashtra', coords: [72.8777, 19.0760] },
  { city: 'Bengaluru', state: 'Karnataka', coords: [77.5946, 12.9716] },
  { city: 'Pune', state: 'Maharashtra', coords: [73.8567, 18.5204] },
  { city: 'Hyderabad', state: 'Telangana', coords: [78.4867, 17.3850] },
  { city: 'Chennai', state: 'Tamil Nadu', coords: [80.2707, 13.0827] },
];

const issues = ['pothole', 'crack', 'waterlogging', 'broken_surface'];
const severities = ['low', 'medium', 'high', 'critical'];
const statuses = ['pending', 'pending', 'pending', 'in_progress', 'in_progress', 'resolved', 'rejected'];

const explanations = {
  pothole: "A significant pothole has been detected on the road surface. Potholes form when water infiltrates cracks in the pavement and freezes during temperature drops, expanding and breaking the asphalt apart. This pothole presents a serious hazard to two-wheelers and vehicles, potentially causing tire blowouts, suspension damage, and accidents. Immediate patching with bituminous material is recommended.",
  crack: "Longitudinal and transverse cracking patterns detected on the road surface. These cracks indicate pavement fatigue, possibly caused by heavy traffic loads exceeding the road's design capacity, or inadequate sub-base compaction during construction. If left untreated, water infiltration will accelerate deterioration into more severe damage within 2-3 monsoon cycles.",
  waterlogging: "Severe waterlogging detected at this road section. The drainage infrastructure appears blocked or inadequate, causing water accumulation that poses aquaplaning risk for vehicles. Standing water can hide underlying potholes and road damage, creating compounded hazards. Drainage desilting and road camber restoration required.",
  broken_surface: "The road surface shows extensive structural failure with multiple broken sections. This indicates complete failure of the wearing course and possible base course damage. The area poses immediate risk of vehicle damage and accidents. Emergency temporary repairs with cold-mix asphalt followed by permanent reconstruction are urgently needed."
};

const precautionSets = {
  pothole: [
    "Reduce speed to 20-25 km/h when approaching this section",
    "Maintain minimum 50-meter following distance from vehicles ahead",
    "Avoid sudden braking — brake before reaching the damaged area",
    "Two-wheelers should avoid this route and use alternative roads"
  ],
  crack: [
    "Drive slowly and maintain steady speed over cracked sections",
    "Avoid heavy commercial vehicles on this stretch",
    "Check vehicle wheel alignment after passing through this area",
    "Report any visible worsening to the local PWD office immediately"
  ],
  waterlogging: [
    "Do NOT attempt to cross if water depth is unknown or appears deep",
    "Reduce speed drastically to prevent aquaplaning",
    "Switch on hazard lights to warn following drivers",
    "Test vehicle brakes after passing through any standing water"
  ],
  broken_surface: [
    "⚠️ AVOID this road section entirely — use alternative routes",
    "If unavoidable, proceed at walking speed (below 10 km/h)",
    "Watch for loose debris that can puncture tires",
    "Keep emergency contacts and roadside assistance numbers handy"
  ]
};

const sampleImageUrls = [
  'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=800',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
  'https://images.unsplash.com/photo-1504707748692-419802cf939d?w=800',
  'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800',
];

function randomBetween(min, max) { return Math.random() * (max - min) + min; }
function randomInt(min, max) { return Math.floor(randomBetween(min, max)); }
function randomFrom(arr) { return arr[randomInt(0, arr.length)]; }
function jitter(coord, amount = 0.05) { return coord + (Math.random() - 0.5) * amount; }

// ── Main Seed Function ─────────────────────────────────────
async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/potholevision');
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Report.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create Users
    const hashedPassword = await bcrypt.hash('demo123456', 12);

    const users = await User.insertMany([
      {
        name: 'Demo Citizen',
        email: 'citizen@demo.com',
        password: hashedPassword,
        role: 'citizen',
        location: { city: 'Dehradun', state: 'Uttarakhand' },
        reportsSubmitted: 15
      },
      {
        name: 'Municipal Officer Singh',
        email: 'municipality@demo.com',
        password: hashedPassword,
        role: 'municipality',
        location: { city: 'Dehradun', state: 'Uttarakhand' },
        reportsSubmitted: 0
      },
      {
        name: 'Admin User',
        email: 'admin@demo.com',
        password: hashedPassword,
        role: 'admin',
        location: { city: 'New Delhi', state: 'Delhi' },
        reportsSubmitted: 5
      },
      {
        name: 'Priya Sharma',
        email: 'priya@demo.com',
        password: hashedPassword,
        role: 'citizen',
        location: { city: 'Lucknow', state: 'Uttar Pradesh' },
        reportsSubmitted: 8
      },
      {
        name: 'Rahul Verma',
        email: 'rahul@demo.com',
        password: hashedPassword,
        role: 'citizen',
        location: { city: 'Jaipur', state: 'Rajasthan' },
        reportsSubmitted: 3
      }
    ]);
    console.log(`✅ Created ${users.length} users`);

    // Create Reports
    const reports = [];
    const citizenUsers = users.filter(u => u.role === 'citizen');

    // Generate 40 varied sample reports
    for (let i = 0; i < 40; i++) {
      const cityData = randomFrom(cities);
      const issue = randomFrom(issues);
      const severity = i < 8 ? 'critical' : i < 18 ? 'high' : i < 30 ? 'medium' : 'low';
      const status = randomFrom(statuses);
      const severityScore = severity === 'critical' ? randomInt(85, 100) :
        severity === 'high' ? randomInt(65, 84) :
          severity === 'medium' ? randomInt(40, 64) : randomInt(15, 39);

      const impactMap = {
        critical: { accidentRisk: 85, fuelSavings: 15.5, co2: 36.5 },
        high: { accidentRisk: 60, fuelSavings: 8.2, co2: 19.3 },
        medium: { accidentRisk: 35, fuelSavings: 4.1, co2: 9.6 },
        low: { accidentRisk: 15, fuelSavings: 1.5, co2: 3.5 }
      };
      const impact = impactMap[severity];

      // Spread dates over last 30 days
      const daysAgo = randomInt(0, 30);
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      const report = {
        reportId: `PV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}-${i}`,
        submittedBy: randomFrom(citizenUsers)._id,
        title: `${issue.replace('_', ' ')} on ${cityData.city} road`,
        description: `Reported ${issue.replace('_', ' ')} near ${cityData.city}. The damage is ${severity} and requires ${severity === 'critical' ? 'immediate' : severity === 'high' ? 'urgent' : 'timely'} attention.`,
        location: {
          type: 'Point',
          coordinates: [jitter(cityData.coords[0], 0.08), jitter(cityData.coords[1], 0.08)],
          address: `${randomInt(1, 200)} Main Road, ${cityData.city}`,
          city: cityData.city,
          state: cityData.state,
          pincode: `${randomInt(100000, 999999)}`
        },
        imageUrl: randomFrom(sampleImageUrls),
        imagePublicId: `potholevision/sample_${i}`,
        aiAnalysis: {
          detectedIssues: [
            { type: issue, confidence: randomBetween(0.72, 0.97), boundingBox: { x: 0.2, y: 0.3, width: 0.4, height: 0.3 } },
            ...(Math.random() > 0.5 ? [{ type: randomFrom(issues.filter(x => x !== issue)), confidence: randomBetween(0.35, 0.65), boundingBox: { x: 0.55, y: 0.55, width: 0.3, height: 0.25 } }] : [])
          ],
          primaryIssue: issue,
          severityScore,
          severityLevel: severity,
          overallConfidence: randomBetween(0.72, 0.97),
          // NOTE: this is hand-written demo/seed data for UI testing, not real model
          // output. The real detector (ml/, backend/services/roadDamageDetector.js)
          // only ever detects 'pothole' or 'crack' with a variable, per-image
          // confidence — it never outputs 'waterlogging' or 'broken_surface', and
          // never a fixed canned explanation. Do not present these seeded reports
          // as evidence of real AI accuracy.
          aiExplanation: `[Demo data — not generated by the AI model] ${explanations[issue]}`,
          safetyPrecautions: precautionSets[issue],
          analysisTimestamp: createdAt
        },
        status,
        assignedTo: status !== 'pending' ? 'PWD Department, ' + cityData.city : '',
        municipalityNotes: status === 'resolved' ? `Repair completed. Bituminous patching done on ${new Date(Date.now() - randomInt(0, 10) * 86400000).toLocaleDateString('en-IN')}.` :
          status === 'in_progress' ? 'Repair team dispatched. Materials procured.' : '',
        resolvedAt: status === 'resolved' ? new Date(Date.now() - randomInt(1, 15) * 86400000) : undefined,
        sustainabilityImpact: {
          accidentRiskReduced: impact.accidentRisk,
          estimatedFuelSavingsLiters: impact.fuelSavings,
          estimatedCO2ReductionKg: impact.co2
        },
        upvotes: randomInt(0, 25),
        isAnonymous: Math.random() > 0.8,
        createdAt,
        updatedAt: createdAt
      };
      reports.push(report);

      // Small delay to ensure unique reportId timestamps
      await new Promise(r => setTimeout(r, 5));
    }

    await Report.insertMany(reports);
    console.log(`✅ Created ${reports.length} sample reports`);

    // Summary
    console.log('\n🎉 Database seeded successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Demo Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Citizen:      citizen@demo.com     / demo123456');
    console.log('🏛️  Municipality: municipality@demo.com / demo123456');
    console.log('⚙️  Admin:        admin@demo.com       / demo123456');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seed();
