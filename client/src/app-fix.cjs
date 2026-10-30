const fs = require('fs');
const p = 'C:/Users/KASSAHUN.ASSABE/buildstock-ethiopia/client/src/App.jsx';
let c = fs.readFileSync(p, 'utf8');
if (c.indexOf('PlatformDashboard') === -1) {
  const marker = "import Audit from './pages/Audit.jsx'\n";
  const add = "\nimport PlatformDashboard from './pages/platform/PlatformDashboard.jsx'\nimport TenantsList from './pages/platform/TenantsList.jsx'\nimport TenantCreate from './pages/platform/TenantCreate.jsx'\nimport TenantDetails from './pages/platform/TenantDetails.jsx'\n";
  if (c.indexOf(marker) >= 0) {
    c = c.replace(marker, marker + add);
  } else {
    c = c.replace("import Audit from './pages/Audit.jsx';\n", "import Audit from './pages/Audit.jsx';\n\nimport PlatformDashboard from './pages/platform/PlatformDashboard.jsx';\nimport TenantsList from './pages/platform/TenantsList.jsx';\nimport TenantCreate from './pages/platform/TenantCreate.jsx';\nimport TenantDetails from './pages/platform/TenantDetails.jsx';\n");
  }
}
if (c.indexOf('GuardedPlatform') === -1) {
  const g = "\nfunction GuardedPlatform({ children }) {\n  const { user, loading } = useAuth();\n  const { t } = useI18n();\n  if (loading) return <LoadingBlock className=\"min-h-screen bg-canvas\" />;\n  if (!user?.isPlatformAdmin) {\n    return (\n      <div className=\"card p-8 text-center\">\n        <h2 className=\"text-base font-semibold text-ink\">{t('common.noPermission')}</h2>\n        <p className=\"text-sm text-ink-muted mt-1\">{t('common.featureUnavailable')}</p>\n      </div>\n    );\n  }\n  return <AppShell>{children}</AppShell>;\n}\n";
  const m = c.match(/function Guarded\([^)]+\)\s*\{[\s\S]*?return children;\s*\}\s*\}/);
  if (m) {
    c = c.slice(0, m.index + m[0].length) + g + c.slice(m.index + m[0].length);
  }
}
if (c.indexOf('/platform/tenants') === -1) {
  const r = "\n      <Route path=\"/platform\" element={<GuardedPlatform><PlatformDashboard /></GuardedPlatform>} />\n      <Route path=\"/platform/tenants\" element={<GuardedPlatform><TenantsList /></GuardedPlatform>} />\n      <Route path=\"/platform/tenants/new\" element={<GuardedPlatform><TenantCreate /></GuardedPlatform>} />\n      <Route path=\"/platform/tenants/:id\" element={<GuardedPlatform><TenantDetails /></GuardedPlatform>} />\n";
  c = c.replace("      <Route path=\"*\" element={<Navigate to=\"/\" replace />} />", r + "      <Route path=\"*\" element={<Navigate to=\"/\" replace />} />");
}
fs.writeFileSync(p, c);
console.log(c.indexOf('PlatformDashboard') >= 0 ? 'y' : 'n');