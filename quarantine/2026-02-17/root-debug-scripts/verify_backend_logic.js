require('dotenv').config({ path: 'src/.env' });
const { getProjectMembers } = require('./src/supabase/members');

async function test() {
    console.log('Testing getProjectMembers for CGI_Link...');
    const projectId = '0c82618c-7e1a-4e41-87cf-22643e148715';

    try {
        const result = await getProjectMembers(projectId);
        if (result.success) {
            console.log(`Success! Found ${result.members.length} members.`);
            result.members.forEach(m => {
                console.log(`- ${m.display_name} (${m.user_role}) [${m.is_contact_only ? 'Contact' : 'User'}]`);
            });
        } else {
            console.error('Error:', result.error);
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

test();
