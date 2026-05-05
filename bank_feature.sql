-- 1. ADD COLUMNS TO WALLETS
ALTER TABLE public.ermnium_wallets ADD COLUMN IF NOT EXISTS bank_balance numeric NOT NULL DEFAULT 0;
ALTER TABLE public.ermnium_wallets ADD COLUMN IF NOT EXISTS bank_pin text DEFAULT NULL;

-- 2. CREATE BANK HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.bank_history (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  username text NOT NULL REFERENCES public.users(username) ON DELETE CASCADE,
  type text NOT NULL, -- 'deposit', 'withdraw'
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. BANK TRANSACTION FUNCTION
CREATE OR REPLACE FUNCTION public.ermn_bank_transaction(
  p_username text,
  p_amount numeric,
  p_type text,
  p_pin text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_wallet_bal numeric;
  v_bank_bal numeric;
  v_stored_pin text;
BEGIN
  -- Security check: only the user or admin can transact
  IF (SELECT username FROM public.users WHERE id = auth.uid()) != p_username AND NOT (SELECT is_admin FROM public.users WHERE id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- PIN check if PIN is set
  SELECT bank_pin INTO v_stored_pin FROM public.ermnium_wallets WHERE username = p_username;
  IF v_stored_pin IS NOT NULL AND (p_pin IS NULL OR p_pin != v_stored_pin) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid or missing PIN');
  END IF;

  SELECT balance, bank_balance INTO v_wallet_bal, v_bank_bal 
  FROM public.ermnium_wallets WHERE username = p_username FOR UPDATE;

  IF p_type = 'deposit' THEN
    IF v_wallet_bal < p_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Insufficient liquid cash');
    END IF;
    UPDATE public.ermnium_wallets SET balance = balance - p_amount, bank_balance = bank_balance + p_amount WHERE username = p_username;
  ELSIF p_type = 'withdraw' THEN
    IF v_bank_bal < p_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Insufficient vault savings');
    END IF;
    UPDATE public.ermnium_wallets SET balance = balance + p_amount, bank_balance = bank_balance - p_amount WHERE username = p_username;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Invalid transaction type');
  END IF;

  INSERT INTO public.bank_history (username, type, amount) VALUES (p_username, p_type, p_amount);
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. PIN MANAGEMENT FUNCTION
CREATE OR REPLACE FUNCTION public.ermn_set_bank_pin(p_pin text)
RETURNS void AS $$
BEGIN
  UPDATE public.ermnium_wallets 
  SET bank_pin = NULLIF(p_pin, '') 
  WHERE username = (SELECT username FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLS
ALTER TABLE public.bank_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own bank history" ON public.bank_history;
CREATE POLICY "Users can view own bank history" ON public.bank_history 
  FOR SELECT USING (username = (SELECT username FROM public.users WHERE id = auth.uid()));
