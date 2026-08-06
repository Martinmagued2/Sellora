import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { productName, targetAudience, campaignStyle } = await req.json();

    const name = productName || 'Sellora Premium Product';
    const style = campaignStyle || 'Luxury';
    const audience = targetAudience || 'Fashion Enthusiasts';

    let headline = '';
    let body = '';
    let cta = '';
    let visualTheme = '';

    if (style === 'Luxury') {
      headline = `Elegance Redefined: Experience the Unmatched Polish of ${name}`;
      body = `Crafted for ${audience} who demand perfection. Elevate your everyday style with subtle sophistication and timeless design.`;
      cta = 'Discover Exclusive Collection';
      visualTheme = 'Dark Studio Lighting with Gold Accents';
    } else if (style === 'FOMO / Urgent') {
      headline = `⚡ Almost Sold Out: ${name} is Trending Fast!`;
      body = `Over 4,000 ${audience} already upgraded this week. Don't get left behind—claim your limited tier discount before inventory resets!`;
      cta = 'Claim 20% Off Now';
      visualTheme = 'Vibrant Neon Red & High Voltage Motion Flare';
    } else {
      headline = `Why 10,000+ ${audience} Swear by ${name}`;
      body = `"Hands down the best purchase I've made all year." Verified customer reviews praise the durability, fast delivery, and unmatched quality.`;
      cta = 'Read Verified Reviews';
      visualTheme = 'Clean Minimalist UGC Lifestyle Grid';
    }

    return NextResponse.json({
      success: true,
      asset: {
        productName: name,
        campaignStyle: style,
        headline,
        body,
        cta,
        visualTheme,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
