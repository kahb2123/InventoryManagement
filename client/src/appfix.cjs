const fs = require('fs');
const p = 'C:/Users/KASSAHUN.ASSABE/buildstock-ethiopia/client/src/App.jsx';
let c = fs.readFileSync(p, 'utf8');
const g = unction GuardedPlatform({ children }) {\n  const { user, loading } = useAuth();\n  const { t } = useI18n();\n  if (loading) return <LoadingBlock className=\"min-h-screen bg-canvas\" />;\n  if (!user?.isPlatformAdmin) {\n    return (\n      <div className=\"card p-8 text-center\">\n        <h2 className=\"text-base font-semibold text-ink\">{t('common.noPermission')}</h2>\n        <p className=\"text-sm text-ink-muted mt-1\">{t('common.featureUnavailable')}</p>\n      </div>\n    );\n  }\n  return <AppShell>{children}</AppShell>;\n}\n\n;
c = g + c;
const imp = import PlatformDashboard from './pages/platform/PlatformDashboard.jsx';\nimport TenantsList from './pages/platform/TenantsList.jsx';\nimport TenantCreate from './pages/platform/TenantCreate.jsx';\nimport TenantDetails from './pages/platform/TenantDetails.jsx';\n\n;
c = c.replace(\"import Audit from './pages/Audit.jsx';\n\", \"import Audit from './pages/Audit.jsx';\n\n\" + imp);
const r = \n      <Route path="/platform" element={<GuardedPlatform><PlatformDashboard /></GuardedPlatform>} />\n      <Route path="/platform/tenants" element={<GuardedPlatform><TenantsList /></GuardedPlatform>} />\n      <Route path="/platform/tenants/new" element={<GuardedPlatform><TenantCreate /></GuardedPlatform>} />\n      <Route path="/platform/tenants/:id" element={<GuardedPlatform><TenantDetails /></GuardedPlatform>} />\n;
c = c.replace('      <Route path=\"*\" element={<Navigate to=\"/\" replace />} />', r + '      <Route path=\"*\" element={<Navigate to=\"/\" replace />} />');
fs.writeFileSync(p, c);
console.log(c.includes('GuardedPlatform'));