try {
    console.log('Attempting to require src/supabase/index.js...');
    const supabase = require('./src/supabase');
    console.log('Success! Supabase module loaded.');
    console.log('Members module present:', !!supabase.members);
} catch (e) {
    console.error('FATAL: Failed to load Supabase module.');
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
}
