import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _admin;
}

function buildProvider() {
  if (process.env.GROQ_API_KEY) {
    return createGroq()('llama-3.3-70b-versatile');
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })('gemini-2.0-flash');
  }
  return null;
}

export async function POST(req) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    routing: { assigned: 0, errors: 0 },
    faq: { generated: 0, errors: 0 },
    negativeReview: { drafted: 0, errors: 0 },
  };

  const db = admin();

  // ─── 6. SMART CONVERSATION ROUTING ───
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id, routing_rules').eq('smart_routing_enabled', true);

    for (const account of accounts || []) {
      try {
        const rules = Array.isArray(account.routing_rules) ? account.routing_rules : [];
        if (rules.length === 0) continue;

        // Find unassigned open conversations
        const { data: conversations } = await db.from('conversations')
          .select('id, channel, status, customer:customers(name, tags, total_spent)')
          .eq('account_id', account.id)
          .in('status', ['new', 'open', 'in_progress'])
          .is('assigned_to', null)
          .limit(50);

        for (const conv of (conversations || [])) {
          // Get last message
          const { data: lastMsg } = await db.from('messages')
            .select('content').eq('conversation_id', conv.id)
            .order('created_at', { ascending: false }).limit(1).maybeSingle();

          const text = (lastMsg?.content || '').toLowerCase();
          let matchedRule = null;
          for (const rule of rules) {
            if (!rule.keywords || !rule.assignee_id) continue;
            const keywords = Array.isArray(rule.keywords) ? rule.keywords : String(rule.keywords).split(',');
            if (keywords.some(kw => text.includes(String(kw).toLowerCase().trim()))) {
              matchedRule = rule;
              break;
            }
          }

          if (!matchedRule) continue;

          await db.from('conversations').update({ assigned_to: matchedRule.assignee_id }).eq('id', conv.id);
          await db.from('routing_assignments').insert({
            account_id: account.id, conversation_id: conv.id,
            assigned_to: matchedRule.assignee_id, assigned_by: 'auto',
            rule_matched: matchedRule.name || 'keyword match',
          });
          results.routing.assigned++;
        }
      } catch (e) {
        console.error('[ai-suite] routing error', account.id, e.message);
        results.routing.errors++;
      }
    }
  } catch (e) { results.routing.errors++; }

  // ─── 7. AUTO-GENERATE FAQs ───
  // Weekly — only run on Sundays
  const today = new Date();
  if (today.getDay() === 0) { // Sunday
    try {
      const { data: accounts } = await db.from('accounts')
        .select('id').eq('faq_auto_generate_enabled', true);

      const provider = buildProvider();
      if (!provider) {
        results.faq.errors = 1;
      } else {
        for (const account of accounts || []) {
          try {
            // Get last 7 days of incoming messages
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data: messages } = await db.from('messages')
              .select('content, conversation_id')
              .eq('account_id', account.id) // assuming account_id exists; may need join
              .eq('direction', 'incoming')
              .gte('created_at', weekAgo)
              .limit(200);

            if (!messages || messages.length < 10) continue;

            // Use AI to detect common questions
            const conversationTexts = messages.map(m => m.content).filter(Boolean).slice(0, 100).join('\n---\n');
            const prompt = `Analyze these customer messages from the last week and identify the top 3 most frequently asked questions. For each, write a helpful answer in ${conversationTexts.length > 500 ? 'the same language as the messages' : 'English'}.

Format your response as JSON:
{"faqs": [{"question": "...", "answer": "..."}]}

Customer messages:
${conversationTexts}`;

            try {
              const aiResult = await generateText({
                model: provider, prompt, maxTokens: 600,
              });
              const match = aiResult.text.match(/\{[\s\S]*\}/);
              if (match) {
                const parsed = JSON.parse(match[0]);
                if (Array.isArray(parsed.faqs)) {
                  for (const faq of parsed.faqs.slice(0, 3)) {
                    if (!faq.question || !faq.answer) continue;
                    await db.from('faq_drafts').insert({
                      account_id: account.id,
                      question: String(faq.question).slice(0, 500),
                      answer: String(faq.answer).slice(0, 2000),
                      status: 'draft',
                    });
                    results.faq.generated++;
                  }
                }
              }
            } catch (aiErr) {
              console.error('[ai-suite] FAQ AI call failed', aiErr.message);
            }
          } catch (e) {
            console.error('[ai-suite] faq error', account.id, e.message);
            results.faq.errors++;
          }
        }
      }
    } catch (e) { results.faq.errors++; }
  }

  // ─── 8. NEGATIVE REVIEW AUTO-RESPONSE ───
  try {
    const { data: accounts } = await db.from('accounts')
      .select('id, negative_review_message_template').eq('negative_review_response_enabled', true);

    for (const account of accounts || []) {
      try {
        // Find 1-2 star reviews without a response
        const { data: reviews } = await db.from('reviews')
          .select('id, customer_id, rating, title, body, created_at, customer:customers(name, channel)')
          .eq('account_id', account.id)
          .in('rating', [1, 2])
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .limit(20);

        for (const review of (reviews || [])) {
          const { data: existing } = await db.from('negative_review_responses')
            .select('id').eq('review_id', review.id).maybeSingle();
          if (existing) continue;

          // Draft a personalized response using AI
          const provider = buildProvider();
          let draftResponse = (account.negative_review_message_template || '')
            .replace('{name}', review.customer?.name || 'there');

          if (provider) {
            try {
              const aiResult = await generateText({
                model: provider,
                prompt: `A customer left a ${review.rating}-star review. Write a brief, empathetic apology response (2-3 sentences) that acknowledges their specific concern and offers to make it right. Be sincere, not robotic.

Review title: ${review.title || 'N/A'}
Review body: ${review.body || 'N/A'}

Response:`,
                maxTokens: 150,
              });
              if (aiResult.text && aiResult.text.length > 20) {
                draftResponse = aiResult.text.trim();
              }
            } catch (aiErr) {
              console.error('[ai-suite] negative review AI failed', aiErr.message);
            }
          }

          await db.from('negative_review_responses').insert({
            account_id: account.id, review_id: review.id,
            customer_id: review.customer_id, draft_response: draftResponse,
            status: 'draft',
          });
          results.negativeReview.drafted++;
        }
      } catch (e) {
        console.error('[ai-suite] negative review error', account.id, e.message);
        results.negativeReview.errors++;
      }
    }
  } catch (e) { results.negativeReview.errors++; }

  return NextResponse.json({ success: true, results, ts: new Date().toISOString() });
}
