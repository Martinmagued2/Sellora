'use client';

import { useState } from 'react';
import { 
  Radar, Activity, Zap, ShoppingCart, AlertTriangle, 
  CheckCircle2, ArrowRight, ShieldAlert, Sparkles, Filter 
} from 'lucide-react';

export default function IntentRadarPage() {
  const [sessions, setSessions] = useState([
    { id: 'sess_1', name: 'Sophia R.', page: '/checkout/step-2', cartValue: '$240.00', score: 88, status: 'hesitating', time: '12s ago', issue: 'Hovering on Shipping Policy' },
    { id: 'sess_2', name: 'Marcus K.', page: '/products/silk-shirt', cartValue: '$89.00', score: 94, status: 'high_intent', time: '4s ago', issue: 'Viewed 4 photos' },
    { id: 'sess_3', name: 'Elena B.', page: '/cart', cartValue: '$410.00', score: 45, status: 'cart_risk', time: '45s ago', issue: 'Inactive cursor near exit' },
    { id: 'sess_4', name: 'David W.', page: '/onboarding', cartValue: '$0.00', score: 62, status: 'browsing', time: '2m ago', issue: 'Reading reviews' }
  ]);

  const [activeNotification, setActiveNotification] = useState(null);

  const triggerIntervention = (sessionId, type) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return { ...s, status: 'converted', score: 99, issue: `Intervention Sent: ${type}` };
      }
      return s;
    }));
    setActiveNotification(`🚀 Micro-Offer (${type}) automatically dispatched to visitor session ${sessionId}!`);
    setTimeout(() => setActiveNotification(null), 4000);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-950 text-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Radar className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
                Predictive Intent Radar
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Real-Time Live Visitor Scoring & One-Click Autonomous Conversion Interventions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-xl">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            4 Active Live Streamers
          </div>
        </div>
      </div>

      {activeNotification && (
        <div className="p-4 bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 rounded-xl flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span>{activeNotification}</span>
          </div>
        </div>
      )}

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>High Intent Buyers</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-2">2 Visitors</div>
          <div className="text-xs text-emerald-400 mt-1 font-medium">90%+ Conversion Probability</div>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Hesitating at Checkout</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-2">1 Visitor</div>
          <div className="text-xs text-amber-400 mt-1 font-medium">Needs Shipping / Discount Push</div>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>High Cart Abandon Risk</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-2">$410.00 At Risk</div>
          <div className="text-xs text-rose-400 mt-1 font-medium">1 Idle Cart Session</div>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Auto Interventions</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-2">94.2% Success</div>
          <div className="text-xs text-indigo-400 mt-1 font-medium">+ $1,280 Recovered Today</div>
        </div>
      </div>

      {/* Live Stream Table */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Live Visitor Intent Radar & Direct Actions
          </h2>
          <span className="text-xs text-slate-400">Auto-refreshing live telemetry</span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {sessions.map((session) => (
            <div key={session.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                  session.score > 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                  session.score > 60 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                  'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}>
                  {session.score}%
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">{session.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      {session.page}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                    <span>Cart: <strong className="text-slate-200">{session.cartValue}</strong></span>
                    <span>•</span>
                    <span className="text-indigo-400 font-medium">{session.issue}</span>
                    <span>•</span>
                    <span className="text-slate-500">{session.time}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {session.status === 'converted' ? (
                  <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Intervention Active
                  </span>
                ) : (
                  <>
                    <button 
                      onClick={() => triggerIntervention(session.id, 'Free Shipping Popup')}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition"
                    >
                      Offer Free Shipping
                    </button>
                    <button 
                      onClick={() => triggerIntervention(session.id, 'AI Dynamic Discount')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg transition"
                    >
                      10% AI Coupon
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
