-- ============================================
-- ChatCommerce — Demo Seed Data
-- ============================================
-- 
-- HOW TO USE:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire script
-- 3. Click Run
-- ============================================

DO $$
DECLARE
  v_acc UUID;
BEGIN

  SELECT id INTO v_acc FROM auth.users LIMIT 1;

  IF v_acc IS NULL THEN
    RAISE EXCEPTION 'No user found. Please sign up first!';
  END IF;

  -- ACCOUNT
  INSERT INTO accounts (id, email, owner_name, business_name, business_description, industry, country, currency, phone, plan, plan_status, ai_enabled, ai_personality)
  SELECT 
    v_acc, u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', 'Store Owner'),
    COALESCE(u.raw_user_meta_data->>'business_name', 'My Store'),
    'Premium handmade accessories and fashion items. Shipping across Egypt and the Middle East.',
    'Fashion & Accessories', 'Egypt', 'EGP', '+20 101 234 5678',
    'professional', 'trialing', true,
    'Friendly, professional, and helpful. Use emojis sparingly. Respond in the same language the customer uses.'
  FROM auth.users u WHERE u.id = v_acc
  ON CONFLICT (id) DO UPDATE SET
    business_description = EXCLUDED.business_description,
    industry = EXCLUDED.industry, plan = EXCLUDED.plan,
    plan_status = EXCLUDED.plan_status, ai_enabled = EXCLUDED.ai_enabled;

  -- PRODUCTS
  INSERT INTO products (account_id, name, description, price, currency, category, stock, status) VALUES
    (v_acc, 'Black Leather Bag', 'Genuine leather handcrafted bag. Available in black and brown.', 450, 'EGP', 'Bags', 23, 'active'),
    (v_acc, 'Gold Necklace Set', '18K gold plated necklace with matching earrings.', 1200, 'EGP', 'Jewelry', 12, 'active'),
    (v_acc, 'Silk Scarf Collection', 'Premium silk scarves with hand-printed patterns.', 550, 'EGP', 'Accessories', 45, 'active'),
    (v_acc, 'Handmade Earrings', 'Artisan sterling silver earrings with semi-precious stones.', 180, 'EGP', 'Jewelry', 67, 'active'),
    (v_acc, 'Phone Case Premium', 'Shock-resistant premium phone case with custom designs.', 100, 'EGP', 'Electronics', 150, 'active'),
    (v_acc, 'Canvas Tote Bag', 'Eco-friendly canvas tote with leather straps.', 320, 'EGP', 'Bags', 8, 'active'),
    (v_acc, 'Rose Gold Watch', 'Elegant rose gold watch with minimalist dial.', 2500, 'EGP', 'Watches', 5, 'active'),
    (v_acc, 'Summer Dress', 'Floral print cotton dress, perfect for summer.', 650, 'EGP', 'Clothing', 0, 'draft');

  -- CUSTOMERS
  INSERT INTO customers (account_id, name, phone, email, channel, tags, total_orders, total_spent, last_active_at) VALUES
    (v_acc, 'Ahmed Mohamed', '+201012345678', 'ahmed@example.com', 'whatsapp', ARRAY['VIP','Repeat'], 12, 15400, NOW()),
    (v_acc, 'Sarah Ali', '+201098765432', 'sarah@example.com', 'whatsapp', ARRAY['VIP'], 8, 9600, NOW() - interval '10 minutes'),
    (v_acc, 'Omar Hassan', '+201112233445', 'omar@example.com', 'whatsapp', ARRAY['Repeat'], 5, 4200, NOW() - interval '1 hour'),
    (v_acc, 'Nour Ibrahim', '+201223344556', 'nour@example.com', 'instagram', ARRAY['New'], 2, 1300, NOW() - interval '3 hours'),
    (v_acc, 'Khalid Mansour', '+966501234567', 'khalid@example.com', 'whatsapp', ARRAY['International'], 3, 3600, NOW() - interval '5 hours'),
    (v_acc, 'Fatima El-Sayed', '+201334455667', 'fatima@example.com', 'instagram', ARRAY['Repeat'], 6, 5100, NOW() - interval '8 hours');

  -- CONVERSATIONS + MESSAGES

  -- Conv 1: Ahmed
  WITH conv AS (
    INSERT INTO conversations (account_id, customer_id, channel, status, last_message_at, unread_count)
    SELECT v_acc, c.id, 'whatsapp', 'open', NOW(), 2
    FROM customers c WHERE c.name = 'Ahmed Mohamed' AND c.account_id = v_acc
    RETURNING id
  )
  INSERT INTO messages (conversation_id, direction, content, type, is_ai, created_at) VALUES
    ((SELECT id FROM conv), 'incoming', 'Hi! I saw the black leather bag on your Instagram 😍', 'text', false, NOW() - interval '3 minutes'),
    ((SELECT id FROM conv), 'incoming', 'How much is it?', 'text', false, NOW() - interval '2 minutes'),
    ((SELECT id FROM conv), 'outgoing', 'Hi Ahmed! 👋 The Black Leather Bag is 450 EGP. It''s genuine leather, handcrafted, and available in black & brown. Would you like to order one?', 'text', true, NOW() - interval '2 minutes'),
    ((SELECT id FROM conv), 'incoming', 'Wow that was fast! Yes I want the black one', 'text', false, NOW() - interval '1 minute');

  -- Conv 2: Sarah
  WITH conv AS (
    INSERT INTO conversations (account_id, customer_id, channel, status, last_message_at, unread_count)
    SELECT v_acc, c.id, 'whatsapp', 'open', NOW() - interval '10 minutes', 1
    FROM customers c WHERE c.name = 'Sarah Ali' AND c.account_id = v_acc
    RETURNING id
  )
  INSERT INTO messages (conversation_id, direction, content, type, is_ai, created_at) VALUES
    ((SELECT id FROM conv), 'incoming', 'Can I get the gold necklace? Is it real gold?', 'text', false, NOW() - interval '12 minutes'),
    ((SELECT id FROM conv), 'outgoing', 'Hi Sarah! The Gold Necklace Set is 18K gold plated and comes with matching earrings for 1,200 EGP. ✨', 'text', true, NOW() - interval '12 minutes'),
    ((SELECT id FROM conv), 'incoming', 'Beautiful! I''ll take it. Can you send a payment link?', 'text', false, NOW() - interval '10 minutes');

  -- Conv 3: Omar
  WITH conv AS (
    INSERT INTO conversations (account_id, customer_id, channel, status, last_message_at, unread_count)
    SELECT v_acc, c.id, 'whatsapp', 'open', NOW() - interval '1 hour', 1
    FROM customers c WHERE c.name = 'Omar Hassan' AND c.account_id = v_acc
    RETURNING id
  )
  INSERT INTO messages (conversation_id, direction, content, type, is_ai, created_at) VALUES
    ((SELECT id FROM conv), 'incoming', 'My order hasn''t arrived yet. It''s been 5 days 😕', 'text', false, NOW() - interval '1 hour'),
    ((SELECT id FROM conv), 'outgoing', 'Hi Omar, I''m sorry about the delay! Let me check your order. Can you share your order number?', 'text', true, NOW() - interval '59 minutes');

  -- Conv 4: Nour
  WITH conv AS (
    INSERT INTO conversations (account_id, customer_id, channel, status, last_message_at, unread_count)
    SELECT v_acc, c.id, 'instagram', 'open', NOW() - interval '3 hours', 0
    FROM customers c WHERE c.name = 'Nour Ibrahim' AND c.account_id = v_acc
    RETURNING id
  )
  INSERT INTO messages (conversation_id, direction, content, type, is_ai, created_at) VALUES
    ((SELECT id FROM conv), 'incoming', 'Thank you! The scarf is beautiful 💗', 'text', false, NOW() - interval '3 hours'),
    ((SELECT id FROM conv), 'outgoing', 'Thank you so much Nour! We''re so happy you love it! 🥰', 'text', false, NOW() - interval '2 hours');

  -- Conv 5: Khalid
  WITH conv AS (
    INSERT INTO conversations (account_id, customer_id, channel, status, last_message_at, unread_count)
    SELECT v_acc, c.id, 'whatsapp', 'open', NOW() - interval '5 hours', 0
    FROM customers c WHERE c.name = 'Khalid Mansour' AND c.account_id = v_acc
    RETURNING id
  )
  INSERT INTO messages (conversation_id, direction, content, type, is_ai, created_at) VALUES
    ((SELECT id FROM conv), 'incoming', 'Do you ship to Saudi Arabia?', 'text', false, NOW() - interval '5 hours'),
    ((SELECT id FROM conv), 'outgoing', 'Yes! We ship to Saudi Arabia — flat rate 150 EGP, 5-7 business days. 🇸🇦', 'text', true, NOW() - interval '5 hours'),
    ((SELECT id FROM conv), 'incoming', 'Great, I want to order the Rose Gold Watch', 'text', false, NOW() - interval '4 hours'),
    ((SELECT id FROM conv), 'outgoing', 'Excellent choice! 2,500 EGP + 150 EGP shipping. I''ll send a payment link! 💫', 'text', false, NOW() - interval '4 hours');

  -- Conv 6: Fatima
  WITH conv AS (
    INSERT INTO conversations (account_id, customer_id, channel, status, last_message_at, unread_count)
    SELECT v_acc, c.id, 'instagram', 'open', NOW() - interval '8 hours', 0
    FROM customers c WHERE c.name = 'Fatima El-Sayed' AND c.account_id = v_acc
    RETURNING id
  )
  INSERT INTO messages (conversation_id, direction, content, type, is_ai, created_at) VALUES
    ((SELECT id FROM conv), 'incoming', 'Can I return the tote bag? The color is different from the photo', 'text', false, NOW() - interval '8 hours'),
    ((SELECT id FROM conv), 'outgoing', 'Hi Fatima! We offer 14-day returns. Please send photos and your order number. 📦', 'text', true, NOW() - interval '8 hours');

  -- ORDERS
  INSERT INTO orders (account_id, customer_id, order_number, items, subtotal, shipping_cost, total, currency, status, channel, payment_status, created_at) VALUES
    (v_acc, (SELECT id FROM customers WHERE name='Ahmed Mohamed' AND account_id=v_acc),
     'ORD-001042', '[{"name":"Black Leather Bag","qty":1,"price":450},{"name":"Phone Case Premium","qty":2,"price":100}]'::jsonb, 650, 0, 650, 'EGP', 'confirmed', 'whatsapp', 'paid', NOW() - interval '2 hours'),
    (v_acc, (SELECT id FROM customers WHERE name='Sarah Ali' AND account_id=v_acc),
     'ORD-001041', '[{"name":"Gold Necklace Set","qty":1,"price":1200}]'::jsonb, 1200, 0, 1200, 'EGP', 'pending', 'whatsapp', 'unpaid', NOW() - interval '30 minutes'),
    (v_acc, (SELECT id FROM customers WHERE name='Omar Hassan' AND account_id=v_acc),
     'ORD-001038', '[{"name":"Silk Scarf Collection","qty":2,"price":550}]'::jsonb, 1100, 50, 1150, 'EGP', 'shipped', 'whatsapp', 'paid', NOW() - interval '3 days'),
    (v_acc, (SELECT id FROM customers WHERE name='Nour Ibrahim' AND account_id=v_acc),
     'ORD-001035', '[{"name":"Silk Scarf Collection","qty":1,"price":550}]'::jsonb, 550, 0, 550, 'EGP', 'delivered', 'instagram', 'paid', NOW() - interval '5 days'),
    (v_acc, (SELECT id FROM customers WHERE name='Khalid Mansour' AND account_id=v_acc),
     'ORD-001043', '[{"name":"Rose Gold Watch","qty":1,"price":2500}]'::jsonb, 2500, 150, 2650, 'EGP', 'confirmed', 'whatsapp', 'paid', NOW() - interval '4 hours'),
    (v_acc, (SELECT id FROM customers WHERE name='Fatima El-Sayed' AND account_id=v_acc),
     'ORD-001030', '[{"name":"Canvas Tote Bag","qty":1,"price":320}]'::jsonb, 320, 0, 320, 'EGP', 'cancelled', 'instagram', 'refunded', NOW() - interval '10 days');

  -- CAMPAIGNS
  INSERT INTO campaigns (account_id, name, message_template, audience_filter, status, sent_count, delivered_count, read_count, replied_count, created_at) VALUES
    (v_acc, 'Ramadan Sale 🌙', 'Hi {name}! 🌙 Our Ramadan sale is LIVE — up to 40% off!', '{"tags":["all"]}'::jsonb, 'active', 1240, 1198, 987, 234, NOW() - interval '9 days'),
    (v_acc, 'Spring Collection 🌸', 'Hey {name}! 🌸 Our new Spring Collection just dropped!', '{"tags":["VIP"]}'::jsonb, 'completed', 856, 830, 654, 189, NOW() - interval '14 days'),
    (v_acc, 'Eid Offers 🎉', 'Happy Eid {name}! 🎉 25% off everything. Code: EID25', '{"tags":["all"]}'::jsonb, 'draft', 0, 0, 0, 0, NOW());

  RAISE NOTICE 'Demo data seeded successfully for account %', v_acc;
END $$;
