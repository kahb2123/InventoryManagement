const fs = require('fs');
const p = 'C:/Users/KASSAHUN.ASSABE/buildstock-ethiopia/client/src/components/layout/AppShell.jsx';
let c = fs.readFileSync(p, 'utf8');
if (c.indexOf('Platform Admin') === -1) {
  const ins = \"  const platformAdminItems = user?.isPlatformAdmin ? [\n    { key: 'platform', to: '/platform', icon: ShieldCheck, label: 'Platform Admin' },\n    { key: 'platform-tenants', to: '/platform/tenants', icon: Building2, label: 'Tenants' },\n  ] : [];\n\n\";
  const i = c.indexOf('  const financeItems');
  if (i >= 0) {
    c = c.slice(0, i) + ins + c.slice(i);
  }
}
if (c.indexOf('platformAdminItems.length') === -1) {
  const m = \"          {adminItems.length ? <NavSection label={t('nav.administration')} items={adminItems} onNavigate={onClose} /> : null}\n        </nav>\";
  const r = \"          {platformAdminItems.length ? <NavSection label='Platform' items={platformAdminItems} onNavigate={onClose} /> : null}\n          {adminItems.length ? <NavSection label={t('nav.administration')} items={adminItems} onNavigate={onClose} /> : null}\n        </nav>\";
  if (c.indexOf(m) >= 0) {
    c = c.replace(m, r);
  }
}
fs.writeFileSync(p, c);
console.log(c.indexOf('Platform Admin') >= 0 ? 'y' : 'n');