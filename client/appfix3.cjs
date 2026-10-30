const fs = require('fs');
const p = 'C:/Users/KASSAHUN.ASSABE/buildstock-ethiopia/client/src/App.jsx';
let c = fs.readFileSync(p, 'utf8');
if (c.indexOf('GuardedPlatform') === -1) {
  c = unction GuardedPlatform({ children }) {\n  const { user } = useAuth();\n  if (!user?.isPlatformAdmin) return null;\n  return <AppShell>{children}</AppShell>;\n}\n\n + c;
}
if (c.indexOf('PlatformDashboard') === -1) {
  c = c.replace(import Audit from './pages/Audit.jsx';\n, import Audit from './pages/Audit.jsx';\n\nimport PlatformDashboard from './pages/platform/PlatformDashboard.jsx';\nimport TenantsList from './pages/platform/TenantsList.jsx';\nimport TenantCreate from './pages/platform/TenantCreate.jsx';\nimport TenantDetails from './pages/platform/TenantDetails.jsx';\n\n);
}
if (c.indexOf('/platform') === -1) {
  c = c.replace(      <Route path="*" element={<Navigate to="/" replace />} />, \n      <Route path="/platform" element={<GuardedPlatform><PlatformDashboard /></GuardedPlatform>} />\n      <Route path="/platform/tenants" element={<GuardedPlatform><TenantsList /></GuardedPlatform>} />\n      <Route path="/platform/tenants/new" element={<GuardedPlatform><TenantCreate /></GuardedPlatform>} />\n      <Route path="/platform/tenants/:id" element={<GuardedPlatform><TenantDetails /></GuardedPlatform>} />\n      <Route path="*" element={<Navigate to="/" replace />} />);
}
fs.writeFileSync(p, c);