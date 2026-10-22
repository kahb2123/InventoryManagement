export const PERMISSIONS = {
  // Dashboard
  'dashboard.view': ['owner', 'manager', 'accountant', 'sales_clerk', 'storekeeper'],
  // Products / catalogue
  'products.view': ['owner', 'manager', 'storekeeper', 'sales_clerk', 'accountant'],
  'products.create': ['owner', 'manager', 'storekeeper'],
  'products.update': ['owner', 'manager', 'storekeeper'],
  'products.delete': ['owner', 'manager'],
  'categories.manage': ['owner', 'manager'],
  'units.manage': ['owner', 'manager'],
  // Stock
  'stock.view': ['owner', 'manager', 'storekeeper', 'sales_clerk', 'accountant'],
  'stock.in': ['owner', 'manager', 'storekeeper'],
  'stock.out': ['owner', 'manager', 'storekeeper'],
  'stock.adjust': ['owner', 'manager'],
  'stock.adjust.approve': ['owner', 'manager'],
  'stock.transfer': ['owner', 'manager', 'storekeeper'],
  'stock.ledger.view': ['owner', 'manager', 'storekeeper', 'accountant'],
  // Sales
  'sales.view': ['owner', 'manager', 'sales_clerk', 'accountant'],
  'sales.create': ['owner', 'manager', 'sales_clerk'],
  'sales.cancel': ['owner', 'manager'],
  'sales.return': ['owner', 'manager', 'sales_clerk'],
  'sales.discount.approve': ['owner', 'manager'],
  // Purchases
  'purchases.view': ['owner', 'manager', 'storekeeper', 'accountant'],
  'purchases.create': ['owner', 'manager', 'storekeeper'],
  'purchases.receive': ['owner', 'manager', 'storekeeper'],
  'purchases.cancel': ['owner', 'manager'],
  // Parties
  'customers.view': ['owner', 'manager', 'sales_clerk', 'accountant'],
  'customers.manage': ['owner', 'manager', 'sales_clerk'],
  'customers.delete': ['owner', 'manager'],
  'suppliers.view': ['owner', 'manager', 'storekeeper', 'accountant'],
  'suppliers.manage': ['owner', 'manager', 'storekeeper'],
  'suppliers.delete': ['owner', 'manager'],
  // Money
  'payments.view': ['owner', 'manager', 'accountant'],
  'payments.create': ['owner', 'manager', 'accountant'],
  'expenses.view': ['owner', 'manager', 'accountant'],
  'expenses.manage': ['owner', 'manager', 'accountant'],
  // Reporting
  'reports.view': ['owner', 'manager', 'accountant', 'storekeeper'],
  'reports.financial': ['owner', 'manager', 'accountant'],
  // Administration
  'settings.view': ['owner', 'manager'],
  'settings.manage': ['owner'],
  'branches.manage': ['owner', 'manager'],
  'users.manage': ['owner'],
  'audit.view': ['owner', 'manager'],
};

export const PERMISSION_LIST = Object.keys(PERMISSIONS);

export function roleHasPermission(role, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

export function permissionsForRole(role) {
  return PERMISSION_LIST.filter((p) => roleHasPermission(role, p));
}

/** Discounts above this percentage require manager/owner approval. */
export const DISCOUNT_APPROVAL_THRESHOLD_PERCENT = Number(process.env.DISCOUNT_APPROVAL_THRESHOLD_PERCENT || 15);

export default PERMISSIONS;
