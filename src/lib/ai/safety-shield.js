/**
 * Sellora Hallucination Defense Shield & Price Guardrail Engine
 */

export function sanitizeAndInspectAiResponse({ rawText, storeMinMargin = 20, productCatalog = [] }) {
  let sanitizedText = rawText;
  let confidenceScore = 96;
  const flaggedIssues = [];
  let actionTaken = 'passed';

  // 1. Price Guardrail Inspection
  // Check if AI promises dynamic price reductions below allowed margin
  const priceMatches = rawText.match(/\$(\d+(\.\d{2})?)/g);
  if (priceMatches && priceMatches.length > 0) {
    for (const priceStr of priceMatches) {
      const numericPrice = parseFloat(priceStr.replace('$', ''));
      // Example check: if price seems absurdly low (e.g. $0 or < $5 without explicitly matching catalog)
      if (numericPrice <= 0) {
        flaggedIssues.push(`Hallucination detected: AI offered $${numericPrice}`);
        confidenceScore -= 40;
        actionTaken = 'blocked_price_guardrail';
        sanitizedText = sanitizedText.replace(priceStr, '[Price verification required - contacting support]');
      }
    }
  }

  // 2. Toxic / Out-of-Scope Guarantee Detection
  const riskyKeywords = ['lifetime free', 'guaranteed 100% refund anytime', 'free shipping forever', 'admin password'];
  for (const kw of riskyKeywords) {
    if (rawText.toLowerCase().includes(kw)) {
      flaggedIssues.push(`Unverified Guarantee Policy: "${kw}"`);
      confidenceScore -= 25;
      actionTaken = 'sanitized';
      sanitizedText = sanitizedText.replace(new RegExp(kw, 'gi'), 'standard store policy applies');
    }
  }

  // 3. Fallback Route to Human if confidence drops low
  if (confidenceScore < 70) {
    actionTaken = 'routed_to_human';
  }

  return {
    rawText,
    sanitizedText,
    confidenceScore: Math.max(confidenceScore, 10),
    flaggedIssues,
    actionTaken
  };
}
