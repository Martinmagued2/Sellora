// Shared helpers for revenue automation suite

/**
 * Generate a unique discount code with a prefix.
 * Format: PREFIX-XXXXXX (alphanumeric, uppercase)
 */
export function generateDiscountCode(prefix = 'DSC') {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no confusing chars (I, O, 0, 1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${code}`;
}

/**
 * Personalize a message template by replacing {placeholders} with values.
 */
export function personalizeMessage(template, vars = {}) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? String(vars[key]) : match;
  });
}

/**
 * Get stats for a revenue automation table.
 */
export async function getAutomationStats(db, table, accountId, days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db.from(table)
    .select('status, created_at')
    .eq('account_id', accountId)
    .gte('created_at', cutoff);
  if (error || !data) return { total: 0, sent: 0, recovered: 0, expired: 0 };
  return {
    total: data.length,
    sent: data.filter(r => r.status === 'sent').length,
    recovered: data.filter(r => r.status === 'recovered' || r.status === 'converted').length,
    expired: data.filter(r => r.status === 'expired').length,
  };
}
