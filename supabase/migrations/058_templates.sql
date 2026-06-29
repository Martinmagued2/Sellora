-- ============================================================
-- Migration 058: Templates Marketplace (Item #5)
-- Pre-configured store templates that sellers can install to
-- instantly populate their account with products, FAQs, policies,
-- coupons, AI personality and a greeting message.
-- ============================================================

-- ═══ 1. store_templates table ═══
CREATE TABLE IF NOT EXISTS store_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fashion', 'cosmetics', 'electronics', 'restaurant', 'realestate', 'general')),
  description TEXT,
  icon TEXT,                                                  -- emoji or short label
  color TEXT DEFAULT '#6c5ce7',                               -- hex color for the card
  config JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- see seed below for shape
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_templates_active
  ON store_templates(is_active, sort_order);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_store_templates_updated_at ON store_templates;
CREATE TRIGGER update_store_templates_updated_at
  BEFORE UPDATE ON store_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Public read (anyone can browse the marketplace), no writes from anon
ALTER TABLE store_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read store_templates" ON store_templates;
CREATE POLICY "Public can read store_templates"
  ON store_templates FOR SELECT USING (is_active = TRUE);

-- ═══ 2. Install history — tracks which account installed which template ═══
CREATE TABLE IF NOT EXISTS store_template_installs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES store_templates(id) ON DELETE CASCADE,
  installed_products INTEGER DEFAULT 0,
  installed_faqs INTEGER DEFAULT 0,
  installed_policies INTEGER DEFAULT 0,
  installed_coupons INTEGER DEFAULT 0,
  installed_personality BOOLEAN DEFAULT FALSE,
  installed_greeting BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_template_installs_account
  ON store_template_installs(account_id, created_at DESC);

ALTER TABLE store_template_installs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own store_template_installs" ON store_template_installs;
CREATE POLICY "Users can manage own store_template_installs"
  ON store_template_installs FOR ALL
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

-- ═══ 3. Seed the five marketplace templates ═══
-- config shape:
--   {
--     "products":     [{ "name": "...", "description": "...", "price": 100, "currency": "EGP", "category": "...", "stock": 50, "image_urls": [] }],
--     "faqs":         [{ "question": "...", "answer": "...", "category": "General" }],
--     "policies":     [{ "title": "...", "content": "...", "category": "Returns & Refunds" }],
--     "coupons":      [{ "code": "...", "type": "percentage", "value": 10, "min_order_value": 0 }],
--     "ai_personality": { "tone": "...", "system_prompt": "...", "greeting": "..." },
--     "greeting_message": "Hi! Welcome to ..."
--   }

INSERT INTO store_templates (name, category, description, icon, color, sort_order, config) VALUES
(
  'Fashion Store',
  'fashion',
  'Launch a fashion & apparel storefront with starter products, sizing FAQs, and return policies. Perfect for clothing boutiques, streetwear brands, and accessory shops.',
  '👗',
  '#EB459E',
  0,
  '{
    "products": [
      { "name": "Classic Cotton T-Shirt", "description": "Premium 100% cotton tee with a relaxed fit. Pre-shrunk and machine-washable. Available in white, black, navy, and beige.", "price": 250, "currency": "EGP", "category": "Tops", "stock": 100, "image_urls": [] },
      { "name": "Slim-Fit Denim Jeans", "description": "Stretchy, comfortable denim jeans with a modern slim cut. Five-pocket styling in mid-blue wash.", "price": 650, "currency": "EGP", "category": "Bottoms", "stock": 60, "image_urls": [] },
      { "name": "Summer Floral Dress", "description": "Lightweight floral midi dress with adjustable straps. Perfect for warm-weather outings.", "price": 850, "currency": "EGP", "category": "Dresses", "stock": 40, "image_urls": [] }
    ],
    "faqs": [
      { "question": "How do I choose the right size?", "answer": "We offer sizes XS through XXL. Each product page has a detailed size chart with measurements in cm and inches. If you are between sizes, we recommend sizing up for a more comfortable fit. You can also message us with your measurements and we will help you pick the perfect size!", "category": "Sizing" },
      { "question": "What is your return policy?", "answer": "We accept returns within 14 days of delivery for unworn items in their original packaging with tags attached. Refunds are processed to your original payment method within 5-7 business days. Sale items are final sale.", "category": "Returns" },
      { "question": "How long does shipping take?", "answer": "Orders within Egypt are delivered in 2-4 business days via Aramex or Bosta. Cairo and Giza orders may qualify for same-day delivery if placed before 2 PM. International shipping takes 7-14 business days.", "category": "Shipping" }
    ],
    "policies": [
      { "title": "Returns & Exchanges", "content": "Items can be returned or exchanged within 14 days of delivery. Items must be unworn, unwashed, and have all original tags attached. Initiate a return by messaging us with your order number. We will arrange pickup at no cost for orders over 500 EGP.", "category": "Returns & Refunds" },
      { "title": "Shipping & Delivery", "content": "We ship across Egypt with Aramex and Bosta. Standard shipping is 35 EGP and free for orders over 750 EGP. Same-day delivery is available in Cairo and Giza for orders placed before 2 PM (additional 50 EGP fee).", "category": "Shipping & Delivery" },
      { "title": "Payment Options", "content": "We accept Visa, Mastercard, cash on delivery (COD), and InstaPay. COD orders must be confirmed via WhatsApp before dispatch.", "category": "Payment" }
    ],
    "coupons": [
      { "code": "WELCOME10", "type": "percentage", "value": 10, "min_order_value": 0, "max_uses": 100 }
    ],
    "ai_personality": {
      "tone": "friendly, fashion-savvy, helpful",
      "system_prompt": "You are a fashion sales assistant for a clothing boutique. Help customers find the right size, suggest outfit combinations, and answer questions about materials, fit, and care. Be warm and stylish in your tone, and always recommend complete looks when possible.",
      "greeting": "Hi there! 👋 Welcome to our boutique. Looking for something specific today, or would you like me to show you our newest arrivals?"
    },
    "greeting_message": "Hi there! 👋 Welcome to our fashion boutique. Looking for something specific today, or would you like me to show you our newest arrivals? 💃"
  }'::jsonb
),
(
  'Cosmetics Store',
  'cosmetics',
  'Set up a beauty & cosmetics store with skincare and makeup products, ingredient FAQs, and return policies. Great for beauty brands, skincare lines, and makeup artists.',
  '💄',
  '#F8A532',
  1,
  '{
    "products": [
      { "name": "Matte Liquid Lipstick - Ruby Red", "description": "Long-lasting matte liquid lipstick with a comfortable, non-drying formula. Highly pigmented in a classic ruby red shade. Vegan and cruelty-free.", "price": 320, "currency": "EGP", "category": "Makeup", "stock": 80, "image_urls": [] },
      { "name": "Full Coverage Foundation - Medium Beige", "description": "Buildable, full-coverage foundation with SPF 20. Lightweight and sweat-resistant for up to 12 hours. Suitable for normal to combination skin.", "price": 480, "currency": "EGP", "category": "Makeup", "stock": 60, "image_urls": [] },
      { "name": "Hydrating Daily Moisturizer", "description": "Lightweight gel-cream moisturizer with hyaluronic acid and niacinamide. Hydrates for 24 hours without clogging pores. Suitable for all skin types.", "price": 380, "currency": "EGP", "category": "Skincare", "stock": 100, "image_urls": [] }
    ],
    "faqs": [
      { "question": "What ingredients are in your products?", "answer": "Full ingredient lists are on every product page. Our formulas are free from parabens, sulfates, and phthalates. Most products are vegan and cruelty-free — look for the leaping bunny logo. If you have a specific allergy, message us with the allergen and we will recommend safe products.", "category": "Ingredients" },
      { "question": "Which products are right for my skin type?", "answer": "For oily skin, look for our gel-based products and oil-free foundations. For dry skin, choose cream moisturizers and hydrating foundations. For sensitive skin, we recommend fragrance-free options. Send us your skin type and concerns and we will build a personalized routine!", "category": "Skin Types" },
      { "question": "Are your products tested on animals?", "answer": "Never! All our products are cruelty-free and certified by Leaping Bunny. We do not test on animals and we do not sell in markets that require animal testing.", "category": "Ingredients" }
    ],
    "policies": [
      { "title": "Returns & Exchanges", "content": "For hygiene reasons, we cannot accept returns on opened cosmetics. Unopened and sealed products can be returned within 7 days of delivery. If a product arrives damaged, please send a photo within 48 hours and we will replace it free of charge.", "category": "Returns & Refunds" },
      { "title": "Shipping & Delivery", "content": "Orders ship within 1-2 business days. Standard delivery across Egypt takes 2-4 business days. Free shipping on orders over 600 EGP.", "category": "Shipping & Delivery" },
      { "title": "Patch Test Advisory", "content": "We recommend doing a patch test 24 hours before using any new skincare product. Apply a small amount to your inner forearm and wait. Discontinue use if irritation occurs.", "category": "General" }
    ],
    "coupons": [
      { "code": "GLOW15", "type": "percentage", "value": 15, "min_order_value": 500, "max_uses": 50 }
    ],
    "ai_personality": {
      "tone": "knowledgeable, warm, beauty-expert",
      "system_prompt": "You are a beauty advisor for a cosmetics store. Help customers choose products based on their skin type, tone, and concerns. Explain ingredients clearly and recommend routines. Be warm, confident, and inclusive — celebrate all skin types and tones.",
      "greeting": "Hi gorgeous! 💕 Welcome to our beauty corner. What are you looking for today — makeup, skincare, or some self-care inspiration?"
    },
    "greeting_message": "Hi gorgeous! 💕 Welcome to our beauty corner. What are you looking for today — makeup, skincare, or some self-care inspiration?"
  }'::jsonb
),
(
  'Electronics Store',
  'electronics',
  'Open a gadgets & electronics store with phone accessories, warranty info, and compatibility FAQs. Ideal for gadget shops, mobile accessory brands, and tech retailers.',
  '📱',
  '#00D2FF',
  2,
  '{
    "products": [
      { "name": "Premium Phone Case - iPhone 15 Pro", "description": "Shock-absorbing TPU case with raised edges for screen and camera protection. Slim fit, wireless-charging compatible. Available in black, navy, and clear.", "price": 180, "currency": "EGP", "category": "Accessories", "stock": 200, "image_urls": [] },
      { "name": "65W Fast Charger with USB-C Cable", "description": "Gallium nitride (GaN) fast charger with a 1m braided USB-C to USB-C cable. Charges phones, tablets, and laptops. Compatible with Power Delivery 3.0.", "price": 420, "currency": "EGP", "category": "Chargers", "stock": 150, "image_urls": [] },
      { "name": "Wireless Earbuds Pro - Active Noise Cancelling", "description": "True wireless earbuds with active noise cancellation, transparency mode, and 24-hour total battery life (with case). IPX5 water-resistant. Touch controls.", "price": 1250, "currency": "EGP", "category": "Audio", "stock": 70, "image_urls": [] }
    ],
    "faqs": [
      { "question": "What is covered under your warranty?", "answer": "All electronics come with a 12-month manufacturer warranty covering defects in materials and workmanship. The warranty does not cover accidental damage, water damage (unless IPX-rated), or unauthorized modifications. Keep your receipt or order number for warranty claims.", "category": "Warranty" },
      { "question": "Is this product compatible with my device?", "answer": "Compatibility information is listed on every product page under Specifications. If you are unsure, send us your device model (e.g. iPhone 14 Pro, Samsung Galaxy S23, iPad Air 5th gen) and we will confirm before you order. We accept returns within 7 days for compatibility issues.", "category": "Compatibility" },
      { "question": "Do you offer repair services?", "answer": "We do not offer in-house repairs, but we can recommend trusted service partners in Cairo and Alexandria. For warranty claims, message us with your order number and a description of the issue and we will arrange a replacement or refund.", "category": "Warranty" }
    ],
    "policies": [
      { "title": "Warranty Policy", "content": "All electronics are covered by a 12-month manufacturer warranty from the date of purchase. To make a claim, message us with your order number and a description (and photo if applicable) of the defect. We will arrange pickup, repair, or replacement at no cost for valid claims.", "category": "Warranty" },
      { "title": "Returns & Exchanges", "content": "Electronics can be returned within 7 days of delivery if unused and in original packaging with all accessories. Opened software, consumables, and personalized items are non-returnable. Refunds are processed within 7 business days.", "category": "Returns & Refunds" },
      { "title": "Shipping & Delivery", "content": "Orders ship within 1 business day. Standard delivery across Egypt is 2-3 business days. Electronics are shipped with insurance and require a signature on delivery.", "category": "Shipping & Delivery" }
    ],
    "coupons": [
      { "code": "TECH20", "type": "fixed", "value": 100, "min_order_value": 800, "max_uses": 100 }
    ],
    "ai_personality": {
      "tone": "precise, helpful, tech-savvy",
      "system_prompt": "You are a tech support and sales assistant for an electronics store. Help customers pick compatible products, troubleshoot basic issues, and explain specs in plain language. Always confirm device model numbers before recommending accessories. Be precise and honest about limitations.",
      "greeting": "Hi! 👋 Welcome to our tech store. Looking for a specific accessory, or need help finding something compatible with your device?"
    },
    "greeting_message": "Hi! 👋 Welcome to our tech store. Looking for a specific accessory, or need help finding something compatible with your device? ⚡"
  }'::jsonb
),
(
  'Restaurant',
  'restaurant',
  'Launch a restaurant or food-delivery storefront with menu items, delivery hours, and minimum-order policies. Great for restaurants, cloud kitchens, and home-cooks.',
  '🍽️',
  '#3BA55C',
  3,
  '{
    "products": [
      { "name": "Grilled Chicken Combo Meal", "description": "Marinated grilled chicken breast with rice, salad, and garlic sauce. Served with pita bread. Serves 1.", "price": 145, "currency": "EGP", "category": "Mains", "stock": 999, "image_urls": [] },
      { "name": "Margherita Pizza - Medium", "description": "12-inch wood-fired pizza with tomato sauce, fresh mozzarella, basil, and olive oil. Serves 2.", "price": 220, "currency": "EGP", "category": "Pizzas", "stock": 999, "image_urls": [] },
      { "name": "Mixed Grill Platter", "description": "Kofta, shish tawook, and kebab with rice, grilled tomatoes, and tahini. Serves 2-3.", "price": 480, "currency": "EGP", "category": "Platters", "stock": 999, "image_urls": [] }
    ],
    "faqs": [
      { "question": "What are your delivery hours?", "answer": "We deliver daily from 11 AM to 1 AM. Last orders are taken at 12:30 AM. During Ramadan, hours are 6 PM to 3 AM. You can also schedule orders in advance for a specific time.", "category": "Delivery Hours" },
      { "question": "What is the minimum order for delivery?", "answer": "The minimum order for delivery is 100 EGP. Orders below 100 EGP can be picked up from our restaurant. Delivery fees are 25 EGP (free for orders over 350 EGP).", "category": "Minimum Order" },
      { "question": "Do you cater for events?", "answer": "Yes! We cater for events of 10+ guests. Send us the date, headcount, and any menu preferences at least 48 hours in advance. We will send you a custom quote with a 10% event discount.", "category": "Catering" }
    ],
    "policies": [
      { "title": "Delivery & Pickup", "content": "We deliver within a 7 km radius of our location. Standard delivery time is 30-45 minutes. You will receive a WhatsApp notification when the driver is on the way. Pickup orders are ready within 20 minutes.", "category": "Shipping & Delivery" },
      { "title": "Cancellation & Refunds", "content": "Orders can be cancelled for a full refund if cancelled before preparation begins (typically within 5 minutes of ordering). Once preparation starts, cancellations are not possible. If your order arrives incorrect or unsatisfactory, message us within 30 minutes for a replacement or refund.", "category": "Cancellation" },
      { "title": "Food Safety", "content": "All meals are prepared fresh in a licensed kitchen following HACCP food safety standards. Allergen information is available on request — please mention any allergies when placing your order.", "category": "General" }
    ],
    "coupons": [
      { "code": "FEAST50", "type": "fixed", "value": 50, "min_order_value": 300, "max_uses": 200 }
    ],
    "ai_personality": {
      "tone": "warm, appetizing, hospitable",
      "system_prompt": "You are an order-taking assistant for a restaurant. Help customers choose dishes, suggest pairings, confirm delivery address and time, and answer questions about ingredients and allergens. Be warm and appetizing in tone, and always confirm the order total and delivery time before closing.",
      "greeting": "Hello! 😊 Hungry? Our kitchen is open. What would you like to order today?"
    },
    "greeting_message": "Hello! 😊 Hungry? Our kitchen is open. What would you like to order today? Check out our daily specials!"
  }'::jsonb
),
(
  'Real Estate',
  'realestate',
  'Set up a real estate brokerage storefront with pricing FAQs, location info, and payment plans. Ideal for real estate agencies, developers, and property managers.',
  '🏠',
  '#5865F2',
  4,
  '{
    "products": [
      { "name": "3-Bedroom Apartment - New Cairo", "description": "185 sqm apartment in a gated compound with 3 bedrooms, 2.5 bathrooms, maid room, and 2 parking spaces. Sea view, finished to luxury spec.", "price": 8500000, "currency": "EGP", "category": "Apartments", "stock": 1, "image_urls": [] },
      { "name": "Villa with Private Pool - Sheikh Zayed", "description": "400 sqm standalone villa with 5 bedrooms, 4 bathrooms, private garden, and swimming pool. Modern finish in a premium compound.", "price": 22000000, "currency": "EGP", "category": "Villas", "stock": 1, "image_urls": [] },
      { "name": "Office Space - Downtown Cairo", "description": "120 sqm office space on a high floor with city views. Fully finished with HVAC, raised floors, and 4 parking spaces. Suitable for HQ or regional office.", "price": 4500000, "currency": "EGP", "category": "Commercial", "stock": 1, "image_urls": [] }
    ],
    "faqs": [
      { "question": "What are the available payment plans?", "answer": "Most properties offer flexible payment plans over 3-7 years with 10% down payment. Some developers offer 0% interest plans. Cash buyers receive a 5-10% discount. Custom plans can be negotiated for premium units — message us with the property and your budget.", "category": "Payment Plans" },
      { "question": "Which locations do you cover?", "answer": "We have listings in New Cairo, Sheikh Zayed, 6th of October, the North Coast, Ain Sokhna, and Downtown Cairo. We also cover commercial properties in business districts. Tell us your preferred area and budget and we will send you matching listings.", "category": "Locations" },
      { "question": "How is pricing determined?", "answer": "Pricing is set by the developer and based on location, finish level, view, and payment plan. We do not charge buyers any commission on primary market properties. For resale properties, commission is typically 1.5% paid by the seller. We provide full price transparency including all fees.", "category": "Pricing" }
    ],
    "policies": [
      { "title": "Booking & Reservation", "content": "To reserve a property, a refundable reservation fee of 50,000 EGP is required (credited toward the down payment). The reservation holds the unit for 7 days while contracts are prepared. The fee is fully refundable if the buyer chooses not to proceed.", "category": "Payment" },
      { "title": "Payment Plans", "content": "Payment plans range from 3 to 7 years with down payments starting at 10%. Post-dated cheques are required. Some developers offer 0% interest; others charge 5-8% interest on installments. We will provide a full payment schedule before signing.", "category": "Payment" },
      { "title": "Closing & Legal", "content": "We handle all paperwork and coordinate with the developer and your lawyer. Closing typically takes 2-4 weeks. Buyers are responsible for their own legal review. We do not charge buyers commission on primary market properties.", "category": "Terms of Service" }
    ],
    "coupons": [
      { "code": "MOVEIN", "type": "fixed", "value": 25000, "min_order_value": 5000000, "max_uses": 10 }
    ],
    "ai_personality": {
      "tone": "professional, knowledgeable, consultative",
      "system_prompt": "You are a real estate consultant for a brokerage. Help buyers find properties matching their budget, location, and needs. Explain payment plans clearly and never pressure. Always qualify the buyer (budget, timeline, location) before sending listings. Be discreet and professional.",
      "greeting": "Hello! 🏠 Welcome to our real estate desk. Are you looking to buy, rent, or invest? Tell me your preferred location and budget and I will send you matching listings."
    },
    "greeting_message": "Hello! 🏠 Welcome to our real estate desk. Are you looking to buy, rent, or invest? Tell me your preferred location and budget and I will send you matching listings."
  }'::jsonb
)
ON CONFLICT DO NOTHING;
