const fetch = require('node-fetch');
const { detectRoadDamage } = require('./roadDamageDetector');
const { calculateSeverity } = require('./severityService');

// ── Groq API Config ───────────────────────────────────────
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama3-8b-8192'; // free, fast, great quality

// Keep only detection records that match the API contract used by the frontend.
// This protects older/malformed persisted records from breaking the UI and does
// not invent replacement values for invalid detections.
const sanitizeDetections = (detections) => {
  if (!Array.isArray(detections)) return [];

  return detections
    .map((d) => {
      if (!d || (d.class !== 'pothole' && d.class !== 'crack')) return null;

      const confidence = Number(d.confidence);
      const box = d.bbox_normalized;
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
      if (!box || typeof box !== 'object') return null;

      const x = Number(box.x);
      const y = Number(box.y);
      const width = Number(box.width);
      const height = Number(box.height);
      if (![x, y, width, height].every(Number.isFinite)) return null;
      if (x < 0 || y < 0 || width <= 0 || height <= 0 || x > 1 || y > 1) return null;
      if (x + width > 1 || y + height > 1) return null;

      return {
        type: d.class,
        confidence,
        boundingBox: { x, y, width, height }
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence);
};

// ── CV Analysis — REAL YOLOv8 road-damage model (see ml/README.md) ──
// No simulated/random detection values are created here.
const analyzeRoadImage = async (imageUrl) => {
  const result = await detectRoadDamage(imageUrl);
  const detectedIssues = sanitizeDetections(result.detections);

  const primaryIssue = detectedIssues.length > 0 ? detectedIssues[0].type : 'unknown';
  const overallConfidence = detectedIssues.length > 0 ? detectedIssues[0].confidence : 0;

  // YOLO detects damage, not severity. Severity is derived separately from
  // the observable detection evidence using a transparent deterministic heuristic.
  const severity = calculateSeverity(detectedIssues);

  return {
    detectedIssues,
    primaryIssue,
    severityScore: severity.score,
    severityLevel: severity.level,
    severityExplanation: severity.explanation,
    overallConfidence
  };
};

// ── Groq LLM call ─────────────────────────────────────────
const askGroq = async (userMessage, systemPrompt = '') => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    return getFallbackExplanation(userMessage);
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: userMessage }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Groq API error:', err);
      return getFallbackExplanation(userMessage);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || getFallbackExplanation(userMessage);
  } catch (err) {
    console.error('Groq fetch error:', err.message);
    return getFallbackExplanation(userMessage);
  }
};

// ── Fallback when no API key ───────────────────────────────
const getFallbackExplanation = (context = '') => {
  const ctx = context.toLowerCase();

  if (ctx.includes('waterlogging')) {
    return `Waterlogging has been detected on the road surface. Standing water reduces road friction dramatically, increasing aquaplaning risk for vehicles. It can also hide underlying potholes or structural damage beneath the surface. The root cause is typically blocked drainage or inadequate road camber. Desilting of drains and regrading of the road surface are recommended fixes.

Safety Precautions:
1. Do not attempt to cross if water depth is unknown — avoid the area
2. Reduce speed drastically to prevent aquaplaning
3. Switch on hazard lights to warn other drivers
4. Test brakes after passing through standing water

Environmental Impact: Waterlogged roads increase vehicle idle time by up to 25%, raising fuel consumption and CO₂ emissions in the affected zone.`;
  }

  if (ctx.includes('crack')) {
    return `Road cracking has been detected, indicating pavement fatigue from repeated heavy traffic loads and/or temperature fluctuations. If untreated, water seeps into cracks and causes rapid deterioration during monsoon season. Crack sealing with bituminous emulsion within 30 days can extend road life by 3–5 years.

Safety Precautions:
1. Reduce speed when driving over cracked sections
2. Keep heavy vehicles off this stretch until repaired
3. Check wheel alignment after traversing this area
4. Alert local PWD office for urgent crack sealing

Environmental Impact: Cracked roads increase rolling resistance, leading to an estimated 2–3% additional fuel use per vehicle per km.`;
  }

  if (ctx.includes('broken')) {
    return `Extensive broken road surface has been detected, indicating complete failure of the wearing course and possible sub-base damage. This is a critical safety hazard capable of causing tyre blowouts, vehicle loss of control, and serious accidents — especially for two-wheelers at night.

Safety Precautions:
1. ⚠️ AVOID this section — use alternate routes where possible
2. If unavoidable, proceed at below 10 km/h
3. Keep both hands firmly on the steering wheel / handlebars
4. Do not drive this section in low light without extra caution

Environmental Impact: Broken roads force vehicles to decelerate and accelerate repeatedly, increasing fuel use by 5–8% and CO₂ emissions significantly in the corridor.`;
  }

  // Default — pothole
  return `A pothole has been detected on the road surface. Potholes form when water infiltrates cracks in asphalt, weakens the sub-base, and repeated vehicle loads cause the surface to collapse inward. This pothole poses a risk of tyre damage, suspension failure, and sudden vehicle swerving — which is particularly dangerous for two-wheelers and vehicles travelling at highway speeds.

Safety Precautions:
1. Reduce speed to 20–25 km/h when approaching this section
2. Maintain a safe following distance of at least 50 metres
3. Avoid sudden braking — brake before reaching the damaged area
4. Two-wheelers should use alternative roads until repair is done

Environmental Impact: Vehicles avoid potholes by braking and re-accelerating, increasing fuel consumption by ~4% per affected km and contributing avoidable CO₂ emissions.`;
};

// ── Generate full AI explanation for a report ─────────────
const generateRoadExplanation = async (analysisResult, description = '') => {
  const { primaryIssue, severityLevel, severityScore, severityExplanation, detectedIssues } = analysisResult;

  // No qualifying detection: don't ask the LLM to explain damage that was never
  // found, and don't fall back to a generic "pothole" message — that would
  // present an invented issue as if the model had actually seen one.
  if (!detectedIssues || detectedIssues.length === 0) {
    const explanation = `Automated analysis did not detect road damage meeting the confidence threshold in this image.` +
      (description ? ` Reporter description: "${description}".` : '') +
      ` This report has been kept for manual review — the detector has limited recall, so absence of a detection does not confirm the road is undamaged.`;
    return { explanation, safetyPrecautions: extractPrecautions(primaryIssue, severityLevel) };
  }

  const issuesList = detectedIssues
    .map(i => `${i.type} (${Math.round(i.confidence * 100)}% confidence)`)
    .join(', ');

  const systemPrompt = `You are PotholeVision AI, an expert road safety and infrastructure analyst assistant.
You analyse road damage reports and provide clear, actionable information for citizens and municipal engineers in India.
Be concise, professional, and practical. Always mention sustainability/environmental impact briefly.
Respond in plain text, no markdown formatting.`;

  const prompt = `Analyse this road damage detection report:
- Primary Issue Detected: ${primaryIssue}
- All Detected Issues: ${issuesList}
- Derived Severity Level: ${severityLevel.toUpperCase()}
- Derived Severity Score: ${severityScore}/100
- Severity Basis: ${severityExplanation}
- Reporter Description: ${description || 'Not provided'}

The severity score and level were calculated by the application from YOLO detection evidence. Do not modify, reinterpret, replace, or recalculate them. Detection confidence is evidence strength, not severity.

Please provide:
1. A 2–3 sentence explanation of the detected damage and its likely cause
2. Exactly 4 safety precautions for road users until repairs are done
3. One sentence on environmental/sustainability impact

Do not claim that YOLO directly predicts severity. Do not invent accident probability, repair cost, vehicle damage, structural integrity, or unsupported statistics.

Keep it brief and practical.`;

  const explanation = await askGroq(prompt, systemPrompt);
  const safetyPrecautions = extractPrecautions(primaryIssue, severityLevel);

  return { explanation, safetyPrecautions };
};

// ── Extract safety precautions by issue type ──────────────
// NOTE: the real model (ml/) only ever outputs 'pothole' or 'crack' — it does not
// detect waterlogging or broken_surface. Those sets are kept only for schema/UI
// compatibility (e.g. a future model, or manually-created reports) and are
// currently unreachable via analyzeRoadImage().
const extractPrecautions = (primaryIssue, severityLevel) => {
  const sets = {
    pothole: [
      'Reduce speed to 20–25 km/h when approaching this section',
      'Maintain 50-metre following distance from vehicles ahead',
      'Avoid sudden braking — brake before reaching the damaged area',
      'Two-wheelers should use an alternative route if possible'
    ],
    crack: [
      'Drive slowly and steadily over cracked road sections',
      'Avoid heavy or loaded commercial vehicles on this stretch',
      'Check vehicle wheel alignment after passing through this area',
      'Report any visible worsening to local PWD or municipality immediately'
    ],
    waterlogging: [
      'Do NOT cross if water depth is unknown — choose an alternate route',
      'Reduce speed drastically to prevent aquaplaning',
      'Switch on hazard lights to warn drivers behind you',
      'Test your brakes after passing through any standing water'
    ],
    broken_surface: [
      '⚠️ AVOID this road section — use alternate routes wherever possible',
      'If unavoidable, reduce speed to below 10 km/h',
      'Watch for loose debris that can puncture tyres',
      'Keep roadside assistance contacts accessible while travelling this route'
    ],
    unknown: [
      'Exercise normal caution while driving through this area',
      'This report has been flagged for manual review by a municipal officer',
      'If the hazard is severe, consider resubmitting with a clearer, closer photo',
      'Contact local authorities directly if the hazard poses an immediate danger'
    ]
  };

  const precautions = sets[primaryIssue] || sets.unknown;

  if (severityLevel === 'critical') {
    return ['⚠️ CRITICAL HAZARD: Avoid this area entirely if at all possible', ...precautions.slice(0, 3)];
  }
  return precautions;
};

// ── Answer road safety questions (chatbot) ────────────────
const answerRoadSafetyQuestion = async (question, reportContext = '') => {
  const systemPrompt = `You are PotholeVision AI Assistant, an expert in road safety, infrastructure maintenance, and sustainable urban development for Indian cities.
You help citizens and municipal officers with road safety questions.
Be helpful, accurate, and concise. Keep answers under 150 words.
${reportContext ? `Context about the current report: ${reportContext}` : ''}`;

  return await askGroq(question, systemPrompt);
};

// ── Sustainability impact calculator ──────────────────────
const calculateSustainabilityImpact = (severityLevel) => {
  const map = {
    critical: { accidentRisk: 85, fuelSavings: 15.5, co2Reduction: 36.5 },
    high:     { accidentRisk: 60, fuelSavings: 8.2,  co2Reduction: 19.3 },
    medium:   { accidentRisk: 35, fuelSavings: 4.1,  co2Reduction: 9.6  },
    low:      { accidentRisk: 15, fuelSavings: 1.5,  co2Reduction: 3.5  }
  };
  const impact = map[severityLevel] || map.medium;
  return {
    accidentRiskReduced: impact.accidentRisk,
    estimatedFuelSavingsLiters: impact.fuelSavings,
    estimatedCO2ReductionKg: impact.co2Reduction
  };
};

module.exports = {
  analyzeRoadImage,
  sanitizeDetections,
  generateRoadExplanation,
  answerRoadSafetyQuestion,
  calculateSustainabilityImpact
};
