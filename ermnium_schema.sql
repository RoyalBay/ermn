-- ============================================================
-- ERMNIUM SCHEMA — Virtual Currency for ermn (POINTS EDITION)
-- ============================================================

-- DROP OLD TABLES TO ENSURE FRESH SCHEMA (CAUTION: CLEARS EXISTING DATA)
DROP TABLE IF EXISTS ermnium_inventory;
DROP TABLE IF EXISTS ermnium_transactions;
DROP TABLE IF EXISTS ermnium_shop;
DROP TABLE IF EXISTS ermnium_wallets;
DROP TABLE IF EXISTS ermnium_config;

-- 1. Global config (single row)
CREATE TABLE IF NOT EXISTS ermnium_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  price_points numeric NOT NULL DEFAULT 1.0, -- Default: 1 ERN = 1 Point
  price_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_supply numeric NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Seed the initial config row
INSERT INTO ermnium_config (id, price_points, price_history, total_supply)
VALUES (1, 1.0, '[]'::jsonb, 0)
ON CONFLICT (id) DO NOTHING;

-- 2. Per-user wallets
CREATE TABLE IF NOT EXISTS ermnium_wallets (
  username text PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0, -- Ermnium Balance
  points_balance numeric NOT NULL DEFAULT 0, -- Points Balance (The Base Currency)
  total_bought numeric NOT NULL DEFAULT 0,
  total_sold numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. Transaction history
CREATE TABLE IF NOT EXISTS ermnium_transactions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  username text NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('buy', 'sell', 'purchase', 'signup_bonus')),
  amount numeric NOT NULL, -- ERN amount
  price_points numeric, -- Price in points
  total_points numeric, -- Total points traded
  item_name text,
  created_at timestamptz DEFAULT now()
);

-- 4. Shop items
CREATE TABLE IF NOT EXISTS ermnium_shop (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('background', 'shell')),
  css_value text NOT NULL,
  preview_css text NOT NULL,
  price_ern numeric NOT NULL,
  description text DEFAULT ''
);

-- 5. User inventory
CREATE TABLE IF NOT EXISTS ermnium_inventory (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  username text NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  item_id bigint NOT NULL REFERENCES ermnium_shop(id) ON DELETE CASCADE,
  purchased_at timestamptz DEFAULT now(),
  UNIQUE(username, item_id)
);

-- ============================================================
-- SEED SHOP ITEMS
-- ============================================================
INSERT INTO ermnium_shop (name, type, css_value, preview_css, price_ern, description) VALUES
  ('Galaxy', 'background', 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', 50, 'A deep cosmic purple-blue nebula gradient'),
  ('Sunset', 'background', 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)', 'linear-gradient(135deg, #f12711, #f5af19)', 30, 'Warm orange and pink sunset vibes'),
  ('Ocean', 'background', 'linear-gradient(135deg, #0F2027 0%, #203A43 50%, #2C5364 100%)', 'linear-gradient(135deg, #0F2027, #203A43, #2C5364)', 30, 'Deep blue ocean depth gradient'),
  ('Ember', 'background', 'linear-gradient(135deg, #CB356B 0%, #BD3F32 100%)', 'linear-gradient(135deg, #CB356B, #BD3F32)', 40, 'Dark red and orange fire gradient'),
  ('Gold Shell', 'shell', '3px solid #FFD700; box-shadow: 0 0 12px rgba(255,215,0,0.5)', 'linear-gradient(135deg, #FFD700, #FFA500)', 75, 'A prestigious golden border with warm glow'),
  ('Diamond Shell', 'shell', '3px solid #00FFFF; box-shadow: 0 0 15px rgba(0,255,255,0.4)', 'linear-gradient(135deg, #00FFFF, #E0E0E0, #00FFFF)', 100, 'Cyan and white shimmer diamond border'),
  ('Neon Shell', 'shell', '3px solid #39FF14; box-shadow: 0 0 14px rgba(57,255,20,0.5)', 'linear-gradient(135deg, #39FF14, #00FF41)', 60, 'Electric green neon glow effect'),
  ('Rainbow Shell', 'shell', '3px solid transparent; background-clip: padding-box; box-shadow: 0 0 10px rgba(255,0,0,0.3), 0 0 10px rgba(0,255,0,0.3), 0 0 10px rgba(0,0,255,0.3)', 'linear-gradient(135deg, #ff0000, #ff7700, #ffff00, #00ff00, #0000ff, #8b00ff)', 150, 'Animated rainbow border effect')
ON CONFLICT DO NOTHING;

-- ============================================================
-- RPC: TRADE ERMNIUM (atomic buy/sell with price fluctuation)
-- ============================================================
CREATE OR REPLACE FUNCTION public.ermnium_trade(
  trade_type text,
  trade_amount numeric
)
RETURNS jsonb AS $$
DECLARE
  current_price numeric;
  trade_total numeric;
  user_balance_ern numeric;
  user_balance_points numeric;
  user_name text;
  new_price numeric;
  price_change numeric;
  history jsonb;
BEGIN
  -- Get current user
  SELECT username INTO user_name FROM public.users WHERE id = auth.uid();
  IF user_name IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate
  IF trade_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF trade_type NOT IN ('buy', 'sell') THEN
    RAISE EXCEPTION 'Invalid trade type';
  END IF;

  -- Lock and get current price
  SELECT price_points, price_history INTO current_price, history
  FROM ermnium_config WHERE id = 1 FOR UPDATE;

  trade_total := trade_amount * current_price;

  -- Ensure wallet exists
  INSERT INTO ermnium_wallets (username, balance, points_balance)
  VALUES (user_name, 0, 0)
  ON CONFLICT (username) DO NOTHING;

  -- Get user balances
  SELECT balance, points_balance INTO user_balance_ern, user_balance_points 
  FROM ermnium_wallets WHERE username = user_name;

  IF trade_type = 'buy' THEN
    IF user_balance_points < trade_total THEN
      RAISE EXCEPTION 'Insufficient Points. Need %, have %', trade_total, user_balance_points;
    END IF;

    -- Update wallet
    UPDATE ermnium_wallets SET
      balance = balance + trade_amount,
      points_balance = points_balance - trade_total,
      total_bought = total_bought + trade_amount
    WHERE username = user_name;

    -- Price goes up on buy (demand pressure)
    price_change := (trade_amount * 0.001) + (random() * 0.005 - 0.0025);
    new_price := GREATEST(0.01, current_price + price_change);

    -- Update global config
    UPDATE ermnium_config SET
      price_points = ROUND(new_price, 4),
      total_supply = total_supply + trade_amount,
      price_history = (
        CASE
          WHEN jsonb_array_length(history) >= 1000
          THEN (history - 0) || jsonb_build_array(jsonb_build_object('t', extract(epoch from now())::bigint, 'p', ROUND(new_price, 4)))
          ELSE history || jsonb_build_array(jsonb_build_object('t', extract(epoch from now())::bigint, 'p', ROUND(new_price, 4)))
        END
      ),
      updated_at = now()
    WHERE id = 1;

  ELSIF trade_type = 'sell' THEN
    IF user_balance_ern < trade_amount THEN
      RAISE EXCEPTION 'Insufficient ERN balance. You have % ERN', user_balance_ern;
    END IF;

    -- Update wallet
    UPDATE ermnium_wallets SET
      balance = balance - trade_amount,
      points_balance = points_balance + trade_total,
      total_sold = total_sold + trade_amount
    WHERE username = user_name;

    -- Price goes down on sell (supply pressure)
    price_change := (trade_amount * 0.001) + (random() * 0.005 - 0.0025);
    new_price := GREATEST(0.01, current_price - price_change);

    -- Update global config
    UPDATE ermnium_config SET
      price_points = ROUND(new_price, 4),
      total_supply = GREATEST(0, total_supply - trade_amount),
      price_history = (
        CASE
          WHEN jsonb_array_length(history) >= 1000
          THEN (history - 0) || jsonb_build_array(jsonb_build_object('t', extract(epoch from now())::bigint, 'p', ROUND(new_price, 4)))
          ELSE history || jsonb_build_array(jsonb_build_object('t', extract(epoch from now())::bigint, 'p', ROUND(new_price, 4)))
        END
      ),
      updated_at = now()
    WHERE id = 1;
  END IF;

  -- Log transaction
  INSERT INTO ermnium_transactions (username, type, amount, price_points, total_points)
  VALUES (user_name, trade_type, trade_amount, current_price, trade_total);

  -- Return updated state
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', (SELECT balance FROM ermnium_wallets WHERE username = user_name),
    'new_points', (SELECT points_balance FROM ermnium_wallets WHERE username = user_name),
    'new_price', new_price,
    'trade_total_points', trade_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: PURCHASE SHOP ITEM (using ERN)
-- ============================================================
CREATE OR REPLACE FUNCTION public.ermnium_purchase_item(target_item_id bigint)
RETURNS jsonb AS $$
DECLARE
  user_name text;
  user_balance numeric;
  item_price numeric;
  item_name_val text;
BEGIN
  SELECT username INTO user_name FROM public.users WHERE id = auth.uid();
  IF user_name IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Check if already owned
  IF EXISTS (SELECT 1 FROM ermnium_inventory WHERE username = user_name AND item_id = target_item_id) THEN
    RAISE EXCEPTION 'You already own this item';
  END IF;

  -- Get item price
  SELECT price_ern, name INTO item_price, item_name_val FROM ermnium_shop WHERE id = target_item_id;
  IF item_price IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;

  -- Ensure wallet exists
  INSERT INTO ermnium_wallets (username, balance, points_balance) VALUES (user_name, 0, 0) ON CONFLICT (username) DO NOTHING;

  -- Check balance
  SELECT balance INTO user_balance FROM ermnium_wallets WHERE username = user_name;
  IF user_balance < item_price THEN
    RAISE EXCEPTION 'Insufficient ERN. Need % ERN, have % ERN', item_price, user_balance;
  END IF;

  -- Deduct balance
  UPDATE ermnium_wallets SET balance = balance - item_price WHERE username = user_name;

  -- Add to inventory
  INSERT INTO ermnium_inventory (username, item_id) VALUES (user_name, target_item_id);

  -- Log transaction
  INSERT INTO ermnium_transactions (username, type, amount, item_name)
  VALUES (user_name, 'purchase', item_price, item_name_val);

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', (SELECT balance FROM ermnium_wallets WHERE username = user_name),
    'item_name', item_name_val
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: CLAIM SIGNUP BONUS (10 Points)
-- ============================================================
CREATE OR REPLACE FUNCTION public.ermnium_claim_bonus()
RETURNS jsonb AS $$
DECLARE
  user_name text;
BEGIN
  SELECT username INTO user_name FROM public.users WHERE id = auth.uid();
  IF user_name IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Check if wallet already exists
  IF EXISTS (SELECT 1 FROM ermnium_wallets WHERE username = user_name) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Bonus already claimed');
  END IF;

  -- Create wallet with 10 Points
  INSERT INTO ermnium_wallets (username, balance, points_balance) VALUES (user_name, 0, 10);

  -- Log it
  INSERT INTO ermnium_transactions (username, type, amount)
  VALUES (user_name, 'signup_bonus', 10);

  RETURN jsonb_build_object('success', true, 'points', 10);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
