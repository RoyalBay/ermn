const { createClient } = require('@supabase/supabase-js');
const sb = createClient("https://glxkfdltajezuvptippt.supabase.co", "sb_publishable_TcAcjr-U6SKDZf4gfNq9zg_CM3zXq1B");
async function test() {
  const { count, error } = await sb.from('ermnium_transactions').select('*', { count: 'exact', head: true });
  console.log('Count:', count);
  console.log('Error:', error);
}
test();
