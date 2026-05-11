const { createClient } = require('@supabase/supabase-js');
const sb = createClient("https://glxkfdltajezuvptippt.supabase.co", "sb_publishable_TcAcjr-U6SKDZf4gfNq9zg_CM3zXq1B");
async function test() {
  const { data, error } = await sb.auth.signUp({
    email: 'testuser' + Date.now() + '@ermn.social',
    password: 'password123',
    options: {
      data: { username: 'testuser' + Date.now() }
    }
  });
  console.log('Error:', error?.message);
  // console.log('Data:', data);
}
test();
