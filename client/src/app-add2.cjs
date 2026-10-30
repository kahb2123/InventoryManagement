const fs = require('fs');
const p = 'C:/Users/KASSAHUN.ASSABE/buildstock-ethiopia/client/src/App.jsx';
let c = fs.readFileSync(p, 'utf8');
if (c.indexOf('function GuardedPlatform') === -1) {
  const g = \nfunction GuardedPlatform({ children }) {\n  const { user, loading } = useAuth();\n  const { t } = useI18n();\n  if (loading) return <LoadingBlock className=\"min-h-screen bg-canvas\" />;\n  if (!user?.isPlatformAdmin) {\n    return (\n      <div className=\"card p-8 text-center\">\n        <h2 className=\"text-base font-semibold text-ink\">{t('common.noPermission')}</h2>\n        <p className=\"text-sm text-ink-muted mt-1\">{t('common.featureUnavailable')}</p>\n      </div>\n    );\n  }\n  return <AppShell>{children}</AppShell>;\n}\n;
  c = c.replace(unction Guarded({ permission, children }) {\n  const { hasPermission } = useAuth();\n  const { t } = useI18n();\n  if (permission && !hasPermission(permission)) {\n    return (\n      <div className=\"card p-8 text-center\">\n        <h2 className=\"text-base font-semibold text-ink\">{t('common.noPermission')}</h2>\n        <p className=\"text-sm text-ink-muted mt-1\">{t('common.featureUnavailable')}</p>\n      </div>\n    );\n  }\n  return children;\n}\n, unction Guarded({ permission, children }) {\n  const { hasPermission } = useAuth();\n  const { t } = useI18n();\n  if (permission && !hasPermission(permission)) {\n    return (\n      <div className=\"card p-8 text-center\">\n        <h2 className=\"text-base font-semibold text-ink\">{t('common.noPermission')}</h2>\n        <p className=\"text-sm text-ink-muted mt-1\">{t('common.featureUnavailable')}</p>\n      </div>\n    );\n  }\n  return children;\n}\n + g);
  fs.writeFileSync(p, c);
  console.log(c.indexOf('function GuardedPlatform'));
} else {
  console.log(c.indexOf('function GuardedPlatform'));
}