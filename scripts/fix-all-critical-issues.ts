#!/usr/bin/env tsx
/**
 * Comprehensive fix for all critical syntax issues
 */

import { readFileSync, writeFileSync } from 'fs';

const criticalFixes = [
  // Fix use-auth.tsx syntax errors
  {
    file: 'client/src/hooks/use-auth.tsx',
    fixes: [
      {
        search: /      } catch \(error\) {\s*\n\s*throw error;\s*\n\s*}/g,
        replace: '      } catch (error) {\n        throw error;\n      }'
      },
      {
        search: /          \.\.\.userData,\s*\n\s*password: '\*\*\*\*\*\*',\s*\n\s*passwordConfirm: '\*\*\*\*\*\*'\s*\n\s*\}\);/g,
        replace: '          // Registration data validation'
      },
      {
        search: /        if \(userData\.password !== userData\.passwordConfirm\) {\s*\n\s*throw new Error\('Passwords do not match'\);/g,
        replace: '        if (userData.password !== userData.passwordConfirm) {\n          throw new Error(\'Passwords do not match\');'
      },
      {
        search: /        const res = await apiRequest\("POST", "\/api\/auth\/register", userData\);\s*\n\s*\/\/ Handle non-2xx responses/g,
        replace: '        const res = await apiRequest("POST", "/api/auth/register", userData);\n        \n        // Handle non-2xx responses'
      },
      {
        search: /            errorText = errorData\.message \|\| JSON\.stringify\(errorData\);\s*\n\s*} catch {/g,
        replace: '            errorText = errorData.message || JSON.stringify(errorData);\n          } catch {'
      },
      {
        search: /            errorText = await res\.text\(\)\.catch\(\(\) => 'Unknown error'\);\s*\n\s*}/g,
        replace: '            errorText = await res.text().catch(() => \'Unknown error\');\n          }'
      },
      {
        search: /        if \(!userResponse \|\| !userResponse\.id\) {\s*\n\s*throw new Error\('Invalid user data received from server'\);/g,
        replace: '        if (!userResponse || !userResponse.id) {\n          throw new Error(\'Invalid user data received from server\');'
      },
      {
        search: /    onSuccess: async \(user: User\) => {\s*\n\s*\/\/ Immediately update the local query cache/g,
        replace: '    onSuccess: async (user: User) => {\n      // Immediately update the local query cache'
      },
      {
        search: /  \/\/ Check for session on page load\s*\n\s*useEffect\(\(\) => {\s*\n\s*refreshAuth\(\);/g,
        replace: '  // Check for session on page load\n  useEffect(() => {\n    refreshAuth();'
      }
    ]
  },
  
  // Fix Calendar.tsx
  {
    file: 'client/src/pages/Calendar.tsx',
    fixes: [
      {
        search: /    isAuthenticated: !!currentUser,\s*\n\s*username: currentUser\?\.username \|\| ''/g,
        replace: '    isAuthenticated: !!currentUser,\n    username: currentUser?.username || \'\''
      }
    ]
  }
];

function applyCriticalFixes() {
  let totalFixed = 0;
  
  for (const fileConfig of criticalFixes) {
    try {
      const content = readFileSync(fileConfig.file, 'utf8');
      let updatedContent = content;
      let fileFixed = 0;
      
      for (const fix of fileConfig.fixes) {
        const beforeLength = updatedContent.length;
        updatedContent = updatedContent.replace(fix.search, fix.replace);
        if (updatedContent.length !== beforeLength) {
          fileFixed++;
          totalFixed++;
        }
      }
      
      if (fileFixed > 0) {
        writeFileSync(fileConfig.file, updatedContent, 'utf8');
        console.log(`✅ Applied ${fileFixed} fixes to ${fileConfig.file}`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not fix ${fileConfig.file}: ${error}`);
    }
  }
  
  console.log(`\n🔧 Total fixes applied: ${totalFixed}`);
}

applyCriticalFixes();