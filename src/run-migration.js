const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('Adding requester_role columns...');
  
  // Run ALTER TABLE statements
  const { error: error1 } = await supabase.rpc('exec_sql', {
    sql_query: 'ALTER TABLE knowledge_questions ADD COLUMN IF NOT EXISTS requester_role TEXT'
  });
  
  if (error1) {
    console.log('Error 1 (may be expected if column exists):', error1.message);
  }
  
  const { error: error2 } = await supabase.rpc('exec_sql', {
    sql_query: 'ALTER TABLE knowledge_questions ADD COLUMN IF NOT EXISTS requester_role_prompt TEXT'
  });
  
  if (error2) {
    console.log('Error 2 (may be expected if column exists):', error2.message);
  }
  
  // Test if columns exist by querying
  const { data, error: testError } = await supabase
    .from('knowledge_questions')
    .select('id, requester_role, requester_role_prompt')
    .limit(1);
  
  if (testError) {
    console.log('Columns may not exist yet:', testError.message);
    console.log('Please run migration 036 manually in Supabase dashboard');
  } else {
    console.log('Columns exist! Sample:', data);
  }
}

runMigration().catch(console.error);
