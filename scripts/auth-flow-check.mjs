import { readFileSync } from 'node:fs'

const client = readFileSync('src/supabaseClient.ts', 'utf8')
const auth = readFileSync('src/Auth.tsx', 'utf8')

const checks = [
  [client.includes("flowType: 'pkce'"), 'Supabase auth must use PKCE'],
  [client.includes('detectSessionInUrl: false'), 'Callback exchange must not race automatic URL detection'],
  [auth.includes("params.get('code')"), 'Callback must read the authorization code parameter'],
  [
    auth.includes('exchangeCodeForSession(code)'),
    'Callback must exchange only the authorization code, not the complete URL',
  ],
  [auth.includes('exchangeStarted.current'), 'Callback exchange must be guarded against duplicate effects'],
]

const failed = checks.filter(([passed]) => !passed)
if (failed.length) {
  for (const [, message] of failed) console.error(`Auth flow check failed: ${message}`)
  process.exit(1)
}

console.log('Authentication PKCE callback checks passed')
