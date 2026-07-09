/**
 * Sellora 60s Master Ad — Voiceover TTS Generator
 * Output:
 *   /home/z/my-project/download/video-ad/audio/sellora_60s_VO.wav
 *   /home/z/my-project/download/video-ad/audio/sellora_60s_VO.mp3
 *
 * Voice: xiaochen (沉稳专业 - calm/professional) — closest match to Apple/Google VO tone
 * Speed: 0.95 (slightly slower than normal for confident, deliberate Apple/Google pace)
 *
 * VO script (38 words, ~12s of speech across 60s spot):
 *   "Every three seconds. Another question. Another chance to lose a customer.
 *    Meet your AI Copilot. It answers. It learns. It never sleeps.
 *    Faster replies. Happier customers. Calmer days."
 */

const ZAI = require('z-ai-web-dev-sdk').default;
const fs = require('fs');
const path = require('path');

const VO_TEXT = [
  "Every three seconds. Another question. Another chance to lose a customer.",
  "Meet your AI Copilot. It answers. It learns. It never sleeps.",
  "Faster replies. Happier customers. Calmer days.",
].join(' ');

const OUTPUT_DIR = '/home/z/my-project/download/video-ad/audio';

async function generateVO() {
  console.log('🎬 Initializing Z-AI SDK for TTS...');
  const zai = await ZAI.create();

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`📝 VO text (${VO_TEXT.length} chars, ${VO_TEXT.split(/\s+/).length} words):`);
  console.log(`   "${VO_TEXT}"`);
  console.log('');

  // Generate WAV (high quality)
  console.log('🎙️  Generating WAV (voice: xiaochen, speed: 0.95)...');
  const wavResponse = await zai.audio.tts.create({
    input: VO_TEXT,
    voice: 'xiaochen',       // calm/professional — Apple/Google VO style
    speed: 0.95,             // slightly slower = premium, deliberate
    response_format: 'wav',
    stream: false,
  });

  const wavArrayBuffer = await wavResponse.arrayBuffer();
  const wavBuffer = Buffer.from(new Uint8Array(wavArrayBuffer));
  const wavPath = path.join(OUTPUT_DIR, 'sellora_60s_VO.wav');
  fs.writeFileSync(wavPath, wavBuffer);
  console.log(`✅ WAV saved: ${wavPath} (${(wavBuffer.length / 1024).toFixed(1)} KB)`);

  // Also generate per-act VO stems (WAV) for editor flexibility
  console.log('');
  console.log('🎙️  Generating per-act VO stems (for editor flexibility)...');
  const acts = [
    { name: 'act1_chaos',     text: 'Every three seconds. Another question. Another chance to lose a customer.' },
    { name: 'act2_discovery', text: 'Meet your AI Copilot. It answers. It learns. It never sleeps.' },
    { name: 'act3_delight',   text: 'Faster replies. Happier customers. Calmer days.' },
  ];

  for (const act of acts) {
    const r = await zai.audio.tts.create({
      input: act.text,
      voice: 'xiaochen',
      speed: 0.95,
      response_format: 'wav',
      stream: false,
    });
    const ab = await r.arrayBuffer();
    const b = Buffer.from(new Uint8Array(ab));
    const p = path.join(OUTPUT_DIR, `sellora_VO_${act.name}.wav`);
    fs.writeFileSync(p, b);
    console.log(`✅ ${act.name}: ${p} (${(b.length / 1024).toFixed(1)} KB)`);
  }

  console.log('');
  console.log('🎉 All voiceover tracks generated.');
  console.log('   Editor can layer these against music bed and SFX per the script.');
}

generateVO().catch((err) => {
  console.error('❌ TTS generation failed:', err);
  process.exit(1);
});
