import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req) {
  try {
    const { prompt, storeId } = await req.json();
    const query = (prompt || '').toLowerCase();

    let responseType = 'recommendation';
    let replyText = "Based on your request, I've curated a personalized bundle from your catalog that saves you 15% today!";

    // Query real store products from database
    const supabase = await createClient();
    const { data: dbProducts } = await supabase
      .from('products')
      .select('id, name, price, image_url')
      .limit(3);

    let bundleItems = [];
    if (dbProducts && dbProducts.length > 0) {
      bundleItems = dbProducts.map(p => ({
        id: p.id,
        title: p.name,
        price: `$${p.price || '99.00'}`,
        image: p.image_url || 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=500&auto=format&fit=crop&q=60'
      }));
    } else {
      bundleItems = [
        { id: '1', title: 'Store Item 1', price: '$89.00', image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=500&auto=format&fit=crop&q=60' }
      ];
    }

    let comparison = null;

    if (query.includes('compare') || query.includes('versus') || query.includes('vs')) {
      responseType = 'comparison';
      replyText = "Here is a direct side-by-side comparison of your store items:";
      comparison = {
        itemA: { name: bundleItems[0]?.title || 'Product A', price: bundleItems[0]?.price || '$89', rating: '4.9 ★', material: 'Premium Finish' },
        itemB: { name: bundleItems[1]?.title || 'Product B', price: bundleItems[1]?.price || '$49', rating: '4.5 ★', material: 'Standard Finish' }
      };
    }

    return NextResponse.json({
      success: true,
      replyText,
      responseType,
      bundleItems,
      comparison,
      discountBadge: 'BUNDLE15 (-15%)',
      totalPrice: '$178.00'
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

