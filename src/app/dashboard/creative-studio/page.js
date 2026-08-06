'use client';

import { useState } from 'react';
import { Sparkles, Palette, Send, Copy, Check, Eye, Wand2, RefreshCw } from 'lucide-react';

export default function CreativeStudioPage() {
  const [productName, setProductName] = useState('Sellora Premium Silk Shirt');
  const [targetAudience, setTargetAudience] = useState('Luxury Fashion Buyers');
  const [campaignStyle, setCampaignStyle] = useState('Luxury');
  const [loading, setLoading] = useState(false);
  const [generatedAsset, setGeneratedAsset] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/creative-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName, targetAudience, campaignStyle })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedAsset(data.asset);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-950 text-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-pink-500/10 border border-pink-500/30 rounded-xl text-pink-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-pink-400 bg-clip-text text-transparent">
              Autonomous Creative Studio
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Synthesize Multi-Style Ad Copy & Dynamic Lifestyle Visual Assets in Seconds
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Generator Controls */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-pink-400" />
            Campaign Parameters
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Product Name
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-pink-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Target Audience Profile
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-pink-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Creative Tone / Style
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Luxury', 'FOMO / Urgent', 'Social Proof'].map((style) => (
                  <button
                    key={style}
                    onClick={() => setCampaignStyle(style)}
                    className={`py-2 px-3 text-xs font-medium rounded-xl border transition ${
                      campaignStyle === style
                        ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition shadow-lg shadow-pink-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" /> Synthesizing Creative...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" /> Generate Campaign Studio Package
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Asset Preview Canvas */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-indigo-400" />
              Generated Campaign Asset Canvas
            </h2>

            {generatedAsset ? (
              <div className="space-y-6">
                {/* Visual Banner Preview */}
                <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 p-8 min-h-[220px] flex flex-col justify-end shadow-2xl">
                  <div className="absolute top-4 right-4 bg-pink-500/20 border border-pink-500/40 text-pink-300 text-xs px-3 py-1 rounded-full font-semibold">
                    {generatedAsset.campaignStyle} Theme
                  </div>
                  <h3 className="text-2xl font-bold text-white max-w-lg leading-snug">
                    {generatedAsset.headline}
                  </h3>
                  <p className="text-slate-300 text-sm mt-2 max-w-md">
                    {generatedAsset.body}
                  </p>
                  <div className="mt-4">
                    <button className="px-5 py-2.5 bg-white text-slate-950 font-bold rounded-xl text-xs hover:bg-slate-200 transition">
                      {generatedAsset.cta} →
                    </button>
                  </div>
                </div>

                {/* Asset Details & Copy Action */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Generated Ad Copy</span>
                    <button
                      onClick={() => handleCopy(`${generatedAsset.headline}\n${generatedAsset.body}`)}
                      className="text-pink-400 hover:text-pink-300 flex items-center gap-1 font-medium"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy Copywriter Snippet'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 font-mono bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                    {generatedAsset.headline} - {generatedAsset.body}
                  </p>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-3">
                <Palette className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm">Configure parameters and hit generate to watch AI synthesize custom ad assets!</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Ready to dispatch to Meta / WhatsApp / Klaviyo</span>
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl transition flex items-center gap-2">
              <Send className="w-4 h-4 text-pink-400" /> 1-Click Launch Campaign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
