const { createClient } = require('@supabase/supabase-js');
const sb = createClient("https://glxkfdltajezuvptippt.supabase.co", "sb_publishable_TcAcjr-U6SKDZf4gfNq9zg_CM3zXq1B");
async function test() {
  const { data, error } = await sb.from('users').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  }
  console.log('Error:', error);
}
test();
