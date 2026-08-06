import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { prompt, storeId } = await req.json();

    // Mock intelligent dynamic response with visual bundle & comparison
    const query = (prompt || '').toLowerCase();

    let responseType = 'recommendation';
    let replyText = "Based on your request, I've curated a personalized bundle that saves you 15% today!";
    
    const bundleItems = [
      { id: '1', title: 'Sellora Premium Silk Shirt', price: '$89.00', image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=500&auto=format&fit=crop&q=60' },
      { id: '2', title: 'Italian Leather Loafers', price: '$149.00', image: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=500&auto=format&fit=crop&q=60' },
      { id: '3', title: 'Minimalist Gold Watch', price: '$120.00', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60' }
    ];

    let comparison = null;

    if (query.includes('compare') || query.includes('versus') || query.includes('vs')) {
      responseType = 'comparison';
      replyText = "Here is a direct side-by-side comparison of your shortlisted items:";
      comparison = {
        itemA: { name: 'Sellora Silk Shirt', price: '$89', rating: '4.9 ★', material: '100% Mulberry Silk', fit: 'Tailored' },
        itemB: { name: 'Cotton Oxford Shirt', price: '$49', rating: '4.5 ★', material: 'Organic Cotton', fit: 'Regular' }
      };
    }

    return NextResponse.json({
      success: true,
      replyText,
      responseType,
      bundleItems,
      comparison,
      discountBadge: 'BUNDLE15 (-15%)',
      totalPrice: '$304.30'
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
