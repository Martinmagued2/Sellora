/**
 * Sellora — 60s Master Video Ad Script (Apple/Google hybrid style)
 * Output: /home/z/my-project/download/video-ad/Sellora_60s_Ad_Script.docx
 *
 * Scene: copywriting (Font Profile B - Visual)
 * No cover, no TOC, single section, line: 400 spacing
 */

const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, BorderStyle,
  Table, TableRow, TableCell, WidthType, ShadingType, Break,
  TabStopType, TabStopPosition,
} = require("docx");
const fs = require("fs");

// ============ Palette (Apple/Google hybrid: clean white + accent pops) ============
const P = {
  primary:   "#1A1A1A", // title
  body:      "#1F1F1F", // body
  secondary: "#666666", // notes/cues
  accent:    "#0A84FF", // Apple-blue + Google-bright accent
  warm:      "#FF6B35", // warm accent for "delight" beats
  calm:      "#34C759", // green for stats
  rule:      "#D4D4D4", // hairline rules
  surface:   "#FAFAFA", // light surface for cue blocks
  black:     "#000000", // for Apple-black act
};
const c = (hex) => hex.replace("#", "");

// ============ Style helpers ============
const FONT = { ascii: "Calibri", eastAsia: "Microsoft YaHei" };

function title(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120, line: 400 },
    children: [new TextRun({ text, bold: true, size: 44, color: c(P.primary), font: FONT })],
  });
}

function subtitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 360, line: 320 },
    children: [new TextRun({ text, italics: true, size: 22, color: c(P.secondary), font: FONT })],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200, line: 400 },
    border: { bottom: { color: c(P.accent), space: 4, style: BorderStyle.SINGLE, size: 12 } },
    children: [new TextRun({ text, bold: true, size: 32, color: c(P.primary), font: FONT })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 140, line: 360 },
    children: [new TextRun({ text, bold: true, size: 26, color: c(P.accent), font: FONT })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 100, line: 340 },
    children: [new TextRun({ text, bold: true, size: 22, color: c(P.primary), font: FONT })],
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 100, after: 100, line: 400 },
    children: [new TextRun({ text, size: 22, color: c(P.body), font: FONT, ...opts })],
  });
}

function cue(label, text, color = P.secondary) {
  // Inline cue line — label in accent, body text in dark grey
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 80, after: 80, line: 360 },
    children: [
      new TextRun({ text: `${label}  `, bold: true, size: 20, color: c(P.accent), font: FONT }),
      new TextRun({ text, size: 20, color: c(color), font: FONT, italics: true }),
    ],
  });
}

function vo(text) {
  // Voiceover line — bold dark text with leading mark
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 120, after: 120, line: 400 },
    indent: { left: 360 },
    border: { left: { color: c(P.accent), space: 8, style: BorderStyle.SINGLE, size: 18 } },
    children: [
      new TextRun({ text: "VO  ", bold: true, size: 20, color: c(P.accent), font: FONT }),
      new TextRun({ text: `"${text}"`, size: 24, color: c(P.primary), font: FONT, italics: true }),
    ],
  });
}

function ost(text) {
  // On-screen text — monospace-ish, centered
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 80, after: 80, line: 360 },
    indent: { left: 360 },
    children: [
      new TextRun({ text: "ON-SCREEN  ", bold: true, size: 20, color: c(P.warm), font: FONT }),
      new TextRun({ text, size: 22, color: c(P.primary), font: FONT, bold: true }),
    ],
  });
}

function blank() {
  return new Paragraph({ spacing: { before: 80, after: 80, line: 200 }, children: [new TextRun({ text: "" })] });
}

function hr() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { color: c(P.rule), space: 1, style: BorderStyle.SINGLE, size: 6 } },
    children: [new TextRun({ text: "" })],
  });
}

// Shot block: number + time + scene description, with structured cues underneath
function shot(num, time, sceneDesc) {
  return [
    new Paragraph({
      spacing: { before: 240, after: 100, line: 360 },
      children: [
        new TextRun({ text: `SHOT ${num}`, bold: true, size: 22, color: c(P.primary), font: FONT }),
        new TextRun({ text: `   ${time}`, size: 20, color: c(P.secondary), font: FONT }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 100, line: 380 },
      indent: { left: 240 },
      children: [new TextRun({ text: sceneDesc, size: 22, color: c(P.body), font: FONT })],
    }),
  ];
}

// ============ Content ============
const children = [];

// ---------------- Title block ----------------
children.push(title("Sellora"));
children.push(subtitle("60-Second Master Ad Spot — Apple/Google Hybrid Style"));
children.push(body("Format: Master 60s cut + 30s YouTube pre-roll + 15s 9:16 Reels/TikTok + 15s 1:1 Feed", { color: P.secondary, size: 20, italics: true }));
children.push(body("Reference language: English  |  Tone: Confident, calm, optimistic  |  Music: Minimal piano + synth pad", { color: P.secondary, size: 20, italics: true }));
children.push(hr());

// ---------------- Creative brief ----------------
children.push(h1("Creative Brief"));
children.push(body("Sellora is the AI Copilot that replies to your customers in seconds, learns your products, and never sleeps. This ad mirrors the structural restraint of an Apple spot — pitch-black openings, sparse voiceover, slow push-ins, hard cuts to logo — fused with the demo-driven humanity of a Google Pixel ad. The viewer sees the problem (support chaos), watches the product work in real time (AI replying), feels the relief (calm rep, happy customer), and ends on a clean brand card."));
children.push(body("Animation language is layered throughout: typewriter text reveals, spring-physics UI slides, count-up stats, 2-frame color flashes between cuts, and a soft bloom on the logo reveal. Sound design carries the spot — notification chimes stack into noise in Act 1, a single soft \"ding\" marks the AI reply in Act 2, and music swells across Act 3 before cutting to dead silence on the logo. Every cue is timed to the frame so an editor can build it shot-for-shot in CapCut, Premiere, or After Effects."));

// Reference notes
children.push(h2("Style references researched"));
children.push(body("• Apple \"Shot on iPhone\" — cinematic close-ups, vertical-friendly framing, sparse VO, premium pacing (Forbes: \"best product demo ad ever\").", { color: P.secondary }));
children.push(body("• Google Pixel \"Javier in Frame\" Super Bowl LVIII — human-centered, demonstrates the AI feature working, accessibility angle, optimistic tone (Adweek, blog.google).", { color: P.secondary }));
children.push(body("• Hybrid rule: Apple's restraint + Google's color pops + demo-driven clarity. No spec dumping, no jargon, no report tone.", { color: P.secondary }));

children.push(hr());

// ---------------- MASTER 60s ----------------
children.push(h1("MASTER CUT — 60 seconds"));
children.push(body("Working title: \"The Quiet Shift\"  |  Aspect ratio: 16:9 master (reframe for cut-downs)  |  Music bed: \"Quiet Shift\" — minimal piano figure in C minor, builds to F major resolution at 0:50", { color: P.secondary, italics: true, size: 20 }));
children.push(blank());

// ACT 1
children.push(h2("ACT 1 — CHAOS  (0:00 – 0:15)"));
children.push(body("Tone: Apple-style dark cinematic. Anxiety. Sound carries the story before picture does."));
children.push(cue("MUSIC", "Single low piano note. Sustained. Cold."));
children.push(cue("SFX", "Notification chimes begin to stack — iMessage-style \"ding\" at 0:02, again at 0:04, then doubling every 2 seconds until 0:12."));

children.push(...shot(1, "0:00 – 0:03", "Pitch-black screen. One notification slides in from top, center frame: \"New message — Sarah\". Hold 1.5s. Second notification slides over it: \"New message — Diego\". Both visible, slightly offset."));
children.push(...shot(2, "0:03 – 0:07", "Slow push-in (3%/sec) on a support rep's face in a dark room, lit only by the cold blue glow of a phone. Eyes tired. Lips slightly parted. No blink. The two notifications from Shot 1 reflect faintly in their pupils."));
children.push(...shot(3, "0:07 – 0:11", "Macro top-down of the phone screen. Chat bubbles stack rapidly. Unread counter ticks: 1 → 4 → 12 → 47 in rhythmic cuts. Each tick = one notification chime. Screen vibrates subtly with each new message."));
children.push(...shot(4, "0:11 – 0:15", "Return to rep's face. They exhale slowly. Eyes close for half a beat. Frame holds on the exhale — the audience feels the weight."));
children.push(vo("Every three seconds. Another question. Another chance to lose a customer."));
children.push(cue("ANIMATION", "Notification slides use spring physics (10% overshoot). Unread counter uses count-up tick — each number snaps in for 2 frames."));
children.push(cue("COLOR", "Pure black background. Phone glow #4A90E2 cold blue. No other color. This is the only act with no warm tones."));

children.push(blank());

// ACT 2
children.push(h2("ACT 2 — DISCOVERY  (0:15 – 0:35)"));
children.push(body("Tone: Google-style bright, optimistic, demo-driven. We watch the product work. Color enters the frame like sunrise."));
children.push(cue("MUSIC", "Piano resolves up a third. A soft synth pad fades in underneath. Warmer."));
children.push(cue("SFX", "Hard cut to silence on Shot 5's first frame — kills the chime noise instantly. Room tone only."));

children.push(...shot(5, "0:15 – 0:18", "Hard cut to bright sunlit cafe. A customer's hands hold a phone. They type: \"Hey, where's my order #4821?\" Letters animate in with a 30ms-per-keystroke typewriter effect. Send button taps."));
children.push(...shot(6, "0:18 – 0:23", "Screen recording POV — the Sellora Copilot panel slides in from the right (spring physics, Material-style). AI typing indicator (three pulsing dots) shows for 0.4s. Then the reply types out: \"Hi! Order #4821 shipped yesterday, arrives Thursday by 6pm. Tracking link below. Anything else? 💙\". Reply animates word-by-word."));
children.push(cue("SFX", "Soft UI \"ding\" on AI reply arrival. Subtle keyboard ticking during the AI's typing indicator."));
children.push(...shot(7, "0:23 – 0:28", "Customer's face. They smile — a real, unforced smile. They tap \"Thanks!\" and a ⭐⭐⭐⭐⭐ rating slides in. Pull back to reveal they're in a cafe, coffee steaming."));
children.push(...shot(8, "0:28 – 0:35", "Pull back further. We're now in the support rep's office — same rep from Act 1, but now in daylight. They're sipping coffee, smiling at their laptop. We see the dashboard over their shoulder: \"Open tickets: 2\" (was 47). A small green checkmark animates next to it."));
children.push(ost("Meet your AI Copilot."));
children.push(vo("Meet your AI Copilot. It answers. It learns. It never sleeps."));
children.push(cue("ANIMATION", "On-screen text reveals one word at a time (250ms/word) with a 12px upward float. CTA hover-state style. Use Inter or SF Pro Display Bold, 64pt, kerning -2%."));
children.push(cue("COLOR", "Color pops enter with Google-palette energy — yellow scarf on a background extra, blue coffee cup, red awning outside the window, green checkmark on dashboard."));

children.push(blank());

// ACT 3
children.push(h2("ACT 3 — DELIGHT  (0:35 – 0:50)"));
children.push(body("Tone: Hybrid. Rhythmic montage, faster cuts, stats animate. Music peaks. This is the \"evidence\" act — proof the delight is real."));
children.push(cue("MUSIC", "Piano figure doubles in tempo. Synth pad swells. Builds to a peak at 0:48, then drops to single notes for the brand card."));

children.push(...shot(9, "0:35 – 0:37", "Quick cut: happy customer in yellow sweater, laughing at phone in cafe. Color pop: yellow."));
children.push(...shot(10, "0:37 – 0:39", "Quick cut: support rep (now relaxed) leaning back, smiling at laptop. Color pop: blue coffee cup."));
children.push(...shot(11, "0:39 – 0:42", "Quick cut: dashboard close-up. Stat animates count-up: 0% → 90% with label \"faster replies\". Color pop: green."));
children.push(...shot(12, "0:42 – 0:44", "Quick cut: customer's thumb types \"thank you so much\". AI typing indicator flashes for 0.2s. Instant reply: \"Anytime. 💙\"."));
children.push(...shot(13, "0:44 – 0:48", "Founder-style portrait. Mid-30s, calm, looking straight into camera. Soft window light behind them. They don't speak — they just look confident. Hold 4 seconds."));
children.push(cue("ANIMATION", "Between each cut, a 2-frame color flash (yellow → blue → green → white) bridges the shots. Stats use 60fps count-up over 1.2s with ease-out cubic."));
children.push(ost("Faster replies."));
children.push(ost("Happier customers."));
children.push(ost("Calmer days."));
children.push(vo("Faster replies. Happier customers. Calmer days."));

children.push(blank());

// ACT 4
children.push(h2("ACT 4 — BRAND  (0:50 – 1:00)"));
children.push(body("Tone: Apple-style minimal. Pure black. One logo. One tagline. One CTA. Dead silence on the cut."));
children.push(cue("MUSIC", "Peak at 0:50, then hard cut to silence on the brand card. Single piano note returns at 0:58, resolves, fades."));

children.push(...shot(14, "0:50 – 0:54", "Hard cut to pure black. Hold 0.5s of dead silence. Then \"Sellora\" fades in center frame over 1.5s — white, custom sans-serif (SF Pro Display or Inter Bold), 72pt, subtle 8px bloom/glow around the letters."));
children.push(...shot(15, "0:54 – 0:58", "Tagline types in below the logo, one character at a time (60ms/char): \"Support that never sleeps.\" Smaller — 32pt, regular weight, slightly muted white (#F5F5F7)."));
children.push(...shot(16, "0:58 – 1:00", "CTA appears bottom-center, smaller still: \"Try free → sellora.com\". Holds 2 seconds. Music's final piano note fades. Hard cut to black. End."));
children.push(cue("ANIMATION", "Logo fade-in: opacity 0 → 100 over 1.5s with 8px bloom that contracts to 0px at the end. Tagline typewriter starts 0.3s after logo completes. CTA fades in 0.5s after tagline completes."));
children.push(cue("COLOR", "Pure black #000000 background. Logo #FFFFFF. Tagline #F5F5F7. CTA #A0A0A0. No accents. This is the Apple moment — restraint."));

children.push(hr());

// ---------------- CUT-DOWNS ----------------
children.push(h1("CUT-DOWNS"));

// 30s YouTube pre-roll
children.push(h2("30s — YouTube Pre-Roll  (16:9)"));
children.push(body("Compressed structure for skippable pre-roll. Hook in first 5 seconds (pre-skip)."));
children.push(cue("ACT 1", "0:00–0:07 — Chaos. Shots 1+3 only. Faster notification stacking. VO: \"Every three seconds. Another chance to lose a customer.\""));
children.push(cue("ACT 2", "0:07–0:20 — Discovery. Shots 5+6+8 compressed. Customer types → AI replies → dashboard shows \"Open tickets: 2\". VO: \"Meet your AI Copilot. It answers. It never sleeps.\""));
children.push(cue("ACT 3", "0:20–0:27 — Delight. Three 2-second cuts: happy customer, count-up \"90% faster\", founder portrait. VO: \"Faster replies. Happier customers.\""));
children.push(cue("ACT 4", "0:27–0:30 — Brand. Logo + tagline + CTA on pure black. Music cuts to silence at 0:27."));
children.push(blank());

// 15s Reels/TikTok 9:16
children.push(h2("15s — Reels / TikTok  (9:16 vertical)"));
children.push(body("Vertical-first, hook in first 1.5 seconds, captions burned in for sound-off viewing. Native feel — no broadcast polish."));
children.push(cue("0:00–0:02 — HOOK", "Split screen: left half chaos (notification stack), right half calm (AI reply). Bold text overlay top-center: \"Stop drowning in support.\" Caption track bottom: same text."));
children.push(cue("0:02–0:09 — DEMO", "Vertical close-up of phone. Customer types \"where's my order?\". AI replies in 0.4s with tracking link. Caption track: \"AI replies in under 1 second.\" Big bold text, TikTok-native style."));
children.push(cue("0:09–0:13 — STATS", "Three stats stack vertically, each animates up in 0.5s: \"90% faster replies\" / \"24/7 always on\" / \"0 missed tickets\". Background: subtle gradient, dark to light."));
children.push(cue("0:13–0:15 — CTA", "White Sellora logo center on black. Below: \"Try free → sellora.com\". Caption: \"Link in bio.\""));
children.push(cue("SOUND", "Designed for sound-off. Burn-in captions on every shot. If sound on: same SFX as master — chimes → ding → silence."));
children.push(cue("ANIMATION", "TikTok-native motion: text bounces in with spring overshoot, stats count up with a slight wobble at the end. Faster than Apple/Google master — ~20% more energy."));
children.push(blank());

// 15s Feed 1:1
children.push(h2("15s — Instagram / Facebook Feed  (1:1 square)"));
children.push(body("Square crop of the 9:16 vertical. Same beats, same captions. Slightly more padding around the phone to use the square space — rep's face visible top-right corner during demo shots."));
children.push(cue("KEY DIFFERENCE", "Top strip of square shows the rep's tired face during chaos beat (top), bottom strip shows customer's happy face during delight beat. Square frame splits naturally into thirds."));
children.push(cue("CAPTIONS", "Same burned-in captions, but centered (TikTok left-aligns, IG center-aligns). Use Inter Bold 48pt, white with 4px black stroke."));

children.push(hr());

// ---------------- PRODUCTION NOTES ----------------
children.push(h1("Production Notes"));

children.push(h2("Music"));
children.push(body("Original score recommended. Reference: Apple's \"Snapshot\" ad music (sparse piano) + Google's \"Javier in Frame\" ad score (warm hopeful pad). Brief a composer with: \"C minor piano figure, 60 BPM, builds to F major at 0:50, hard cut to silence at 0:50, single resolving note at 0:58. Total runtime 60.0s, mastered at -14 LUFS for streaming platforms.\""));
children.push(body("If licensing stock: search Artlist or Musicbed for \"minimal piano cinematic\" + \"hopeful build\". Avoid anything with drums — this spot is percussion-free."));

children.push(h2("Voiceover"));
children.push(body("Single VO talent. Brief: calm, low, confident, mid-30s to mid-40s, slight warmth, no hard sell. Reference voices: Apple's \"The Morning\" iPhone VO, or Google's \"Javier in Frame\" narrator. Record at 48kHz/24-bit, de-essed, light compression. Total VO word count: 38 words — fits comfortably in 12s of speech across the 60s spot."));
children.push(body("VO script (clean): \"Every three seconds. Another question. Another chance to lose a customer. / Meet your AI Copilot. It answers. It learns. It never sleeps. / Faster replies. Happier customers. Calmer days.\""));

children.push(h2("Sound effects"));
children.push(body("• Notification chimes (Act 1): iMessage-style \"ding\", pitch rises by 1 semitone per chime to build tension. Source: freesound.org \"notification_pop\" packs, or design in Logic Pro with sine + 2kHz resonance."));
children.push(body("• UI ding (Act 2, on AI reply): soft bell, ~880Hz, 200ms decay. This is the \"aha\" sound — it should feel like relief, not alert."));
children.push(body("• Keyboard ticking (during AI typing indicator): mechanical keyboard sample, gated to 30ms per tick."));
children.push(body("• Room tone (Act 2 cafe): subtle espresso machine hum, distant murmur, no music. -30dB."));
children.push(body("• Hard cut to silence (Act 4, 0:50): true silence, not room tone. 500ms of nothing before the logo fades in."));

children.push(h2("Animation specifications"));
children.push(body("All animation in After Effects or Rive. Frame rate: 24fps for cinematic feel (NOT 30fps — 24fps reads as \"premium film\", 30fps reads as \"broadcast TV\")."));
children.push(body("• Typewriter text: 30ms per character for typing, 60ms per character for logo tagline (slower = more premium)."));
children.push(body("• Spring physics on UI slides: stiffness 180, damping 22, mass 1.0. Slight 10% overshoot, settle in 350ms."));
children.push(body("• Count-up stats: 1.2s duration, ease-out cubic curve, 60fps interpolation. Add a 2-frame wobble at the end (±2% of final value) for tactile feel."));
children.push(body("• Color flashes between cuts (Act 3): 2-frame solid color fill, 100% opacity. Yellow #FFD60A → Blue #0A84FF → Green #34C759 → White #FFFFFF."));
children.push(body("• Logo bloom (Act 4): 8px Gaussian blur at 0% opacity, contracts to 0px blur at 100% opacity over 1.5s. Use Alpha Matte for clean edge."));

children.push(h2("Color grading"));
children.push(body("• Act 1: Teal-and-orange inverted — cold blue shadows (#1A3A5C), no highlights above 70 IRE. Crushed blacks. Reads as \"midnight, exhausted\"."));
children.push(body("• Act 2: Lift shadows +6 stops. Warm highlights (#FFF4E6). Saturation +15%. Reads as \"morning, optimistic\"."));
children.push(body("• Act 3: Same as Act 2 but push color pops to +25% saturation. Vibrant but not garish."));
children.push(body("• Act 4: Pure black #000000. No grading needed — the grade IS the absence of grade."));

children.push(h2("Aspect ratio delivery"));
children.push(body("Master: 16:9 (3840×2160, 24fps, ProRes 422 HQ). From this master, deliver:"));
children.push(body("• 30s YouTube pre-roll: 16:9 (1920×1080, H.264, 16Mbps)."));
children.push(body("• 15s Reels/TikTok: 9:16 (1080×1920, H.264, 12Mbps). Re-frame — do not letterbox."));
children.push(body("• 15s IG/FB feed: 1:1 (1080×1080, H.264, 10Mbps). Re-frame from 9:16 with top/bottom crop."));
children.push(body("• Captions: burned in for all vertical/square cuts. SRT file delivered separately for 16:9 (platform auto-captions)."));

children.push(h2("Editor handoff"));
children.push(body("Deliver to editor: this script, the 5 hero key-frame images (in /keyframes/ folder), the TTS voiceover scratch track (in /audio/ folder), and the music brief above. Editor should produce a 60s picture lock first, then 30s/15s/15s cut-downs from that lock. Final mix at -14 LUFS integrated, true peak -1dBTP."));

children.push(hr());

// ---------------- DELIVERABLES MAP ----------------
children.push(h1("Deliverables in this bundle"));
children.push(body("• This script (Sellora_60s_Ad_Script.docx)"));
children.push(body("• 5 hero key-frame images — /keyframes/ folder"));
children.push(body("  → kf01_act1_chaos.jpg, kf02_act2_customer.jpg, kf03_act2_ai_reply.jpg, kf04_act3_stats.jpg, kf05_act4_logo.jpg"));
children.push(body("• TTS voiceover scratch track — /audio/ folder"));
children.push(body("  → sellora_60s_VO.wav (38 words, ~12s of speech, 60s total with pauses)"));
children.push(body("  → sellora_60s_VO.mp3 (compressed version for quick preview)"));

// ============ Build document ============
const doc = new Document({
  creator: "Sellora",
  title: "Sellora 60s Master Ad Script",
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 22, color: c(P.body) },
        paragraph: { spacing: { line: 400 } },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1200, right: 1200 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: "Sellora  ·  60s Master Spot  ·  v1.0", size: 16, color: c(P.secondary), font: FONT, italics: true }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Page ", size: 16, color: c(P.secondary), font: FONT }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: c(P.secondary), font: FONT }),
                new TextRun({ text: " / ", size: 16, color: c(P.secondary), font: FONT }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: c(P.secondary), font: FONT }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const outPath = "/home/z/my-project/download/video-ad/Sellora_60s_Ad_Script.docx";
  fs.writeFileSync(outPath, buf);
  console.log(`✅ Script saved: ${outPath}`);
  console.log(`   Size: ${(buf.length / 1024).toFixed(1)} KB`);
});
