const fs = require('fs');
const p = 'C:/Users/KASSAHUN.ASSABE/buildstock-ethiopia/client/src/App.jsx';
let c = fs.readFileSync(p, 'utf8');
const g = unction GuardedPlatform({ children }) {\n  const { user, loading } = useAuth();\n  const { t } = useI18n();\n  if (loading) return <LoadingBlock className=\"min-h-screen bg-canvas\" />;\n  if (!user?.isPlatformAdmin) {\n    return (\n      <div className=\"card p-8 text-center\">\n        <h2 className=\"text-base font-semibold text-ink\">{t('common.noPermission')}</h2>\n        <p className=\"text-sm text-ink-muted mt-1\">{t('common.featureUnavailable')}</p>\n      </div>\n    );\n  }\n  return <AppShell>{children}</AppShell>;\n}\n\n;
c = g + c;
fs.writeFileSync(p, c);
console.log(c.indexOf('GuardedPlatform'));