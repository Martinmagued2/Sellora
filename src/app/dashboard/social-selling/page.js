'use client';

import { useState } from 'react';
import { 
  MessageSquare, ShieldCheck, DollarSign, Zap, Link, 
  CheckCircle, Sliders, ShoppingBag, ArrowUpRight 
} from 'lucide-react';

export default function SocialSellingPage() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [maxDiscount, setMaxDiscount] = useState(15);
  const [minMargin, setMinMargin] = useState(25);
  const [personality, setPersonality] = useState('friendly_negotiator');
  const [copiedLink, setCopiedLink] = useState(false);

  const sampleCheckoutLink = 'https://sellora.store/checkout/fast?bundle=silk_shirt&discount=HAGGLE12';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(sampleCheckoutLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-950 text-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
              Social Selling & Dynamic Haggle Engine
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Automated Conversational Negotiation Guardrails & Instant WhatsApp / Instagram Checkout Cards
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsEnabled(!isEnabled)}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border transition flex items-center gap-2 ${
              isEnabled 
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' 
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            <Zap className="w-4 h-4" />
            Haggle Bot: {isEnabled ? 'ACTIVE' : 'PAUSED'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Guardrail Controls */}
        <div className="lg:col-span-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            Merchant Dynamic Haggling Thresholds
          </h2>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
                <span>Maximum Allowed Dynamic Discount Cap</span>
                <span className="text-emerald-400 font-mono text-sm">{maxDiscount}%</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="40" 
                value={maxDiscount} 
                onChange={(e) => setMaxDiscount(parseInt(e.target.value))}
                className="w-full accent-emerald-500 h-2 bg-slate-950 rounded-lg cursor-pointer"
              />
              <p className="text-xs text-slate-500 mt-1">AI bot will never exceed this discount rate during WhatsApp / IG haggling.</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
                <span>Minimum Required Profit Margin Guardrail</span>
                <span className="text-emerald-400 font-mono text-sm">{minMargin}%</span>
              </div>
              <input 
                type="range" 
                min="10" 
                max="50" 
                value={minMargin} 
                onChange={(e) => setMinMargin(parseInt(e.target.value))}
                className="w-full accent-emerald-500 h-2 bg-slate-950 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Negotiation Persona & Strategy
              </label>
              <select
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500/50 text-sm"
              >
                <option value="strict">Strict (Firm Pricing, High Margin Defense)</option>
                <option value="friendly_negotiator">Friendly Negotiator (Balanced Discount for Fast Closes)</option>
                <option value="generous_closer">Generous Closer (Aggressive Conversions)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Live Simulation Preview */}
        <div className="lg:col-span-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              Live WhatsApp / DM Conversation Simulator
            </h2>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 font-sans text-xs">
              <div className="bg-slate-900 p-3 rounded-xl max-w-[80%] text-slate-300 border border-slate-800">
                Buyer: "Hey! Love the Silk Shirt. Can you give me a discount if I buy 2 today?"
              </div>
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl max-w-[85%] ml-auto text-emerald-200 space-y-2">
                <div>
                  AI Bot: "I can definitely help with that! If you bundle 2 Silk Shirts right now, I can unlock an exclusive <strong>12% discount</strong> for you!"
                </div>
                {/* 1-Tap Checkout Card Preview */}
                <div className="bg-slate-900/90 border border-slate-700/80 p-3 rounded-lg flex items-center justify-between gap-3 mt-2">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="font-semibold text-slate-100 text-[11px]">2x Silk Shirts Bundle</div>
                      <div className="text-[10px] text-slate-400 line-through">$178.00 → <strong className="text-emerald-400">$156.64</strong></div>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-md text-[10px] hover:bg-emerald-400 flex items-center gap-1">
                    1-Tap Pay <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Dynamic 1-Tap Checkout Link Generator:</span>
              <button 
                onClick={handleCopyLink}
                className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 text-xs"
              >
                {copiedLink ? <CheckCircle className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied Link' : 'Copy Test Link'}
              </button>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-400 truncate">
              {sampleCheckoutLink}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
