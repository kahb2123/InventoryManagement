const fs = require('fs');
const p = 'C:/Users/KASSAHUN.ASSABE/buildstock-ethiopia/client/src/App.jsx';
let c = fs.readFileSync(p, 'utf8');
if (c.indexOf('GuardedPlatform') === -1) {
  c = unction GuardedPlatform({ children }) { const { user } = useAuth(); if (!user?.isPlatformAdmin) return null; return <AppShell>{children}</AppShell>; }\n\n + c;
}
if (c.indexOf('PlatformDashboard') === -1) {
  const imp = import PlatformDashboard from './pages/platform/PlatformDashboard.jsx';\nimport TenantsList from './pages/platform/TenantsList.jsx';\nimport TenantCreate from './pages/platform/TenantCreate.jsx';\nimport TenantDetails from './pages/platform/TenantDetails.jsx';\n\n;
  c = c.replace(\"import Audit from './pages/Audit.jsx';\n\", \"import Audit from './pages/Audit.jsx';\n\n\" + imp);
}
if (c.indexOf('/platform') === -1) {
  const r = \n      <Route path=\"/platform\" element={<GuardedPlatform><PlatformDashboard /></GuardedPlatform>} />\n      <Route path=\"/platform/tenants\" element={<GuardedPlatform><TenantsList /></GuardedPlatform>} />\n      <Route path=\"/platform/tenants/new\" element={<GuardedPlatform><TenantCreate /></GuardedPlatform>} />\n      <Route path=\"/platform/tenants/:id\" element={<GuardedPlatform><TenantDetails /></GuardedPlatform>} />\n;
  c = c.replace('      <Route path=\"*\" element={<Navigate to=\"/\" replace />} />', r + '      <Route path=\"*\" element={<Navigate to=\"/\" replace />} />');
}
fs.writeFileSync(p, c);
console.log(c.indexOf('GuardedPlatform'));