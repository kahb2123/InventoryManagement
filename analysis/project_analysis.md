# Project Analysis - BuildStock Ethiopia

## Overview
BuildStock Ethiopia is a bilingual (English/Amharic) multi-tenant inventory, sales and finance platform for construction-material businesses. Built with Express + MongoDB (Mongoose) backend and React 18 + Vite + Tailwind frontend.

## Architecture
- **Backend**: Node.js/Express, Mongoose ODM, JWT auth, role-based access control (RBAC), tenant scoping, audit trail
- **Frontend**: React 18 + Vite, react-router-dom, recharts, i18next-style custom i18n (EN/????)
- **Database**: MongoDB with multi-tenancy via tenantId
- **Deployment**: API on Render, client on Vercel

## Current Multi-Tenancy Model
- Each Tenant has: name, subdomain, plan (starter/growth/enterprise), status (active/suspended/trialing/cancelled), business details, settings
- Users belong to a tenant (tenantId), scoped via tenantScope middleware/utils
- Tenant context set from authenticated user's tenantId
- All models use tenantScope for automatic scoping on writes; reads require explicit tenant filtering
- First user signup via /auth/setup creates a tenant and makes them owner

## Current User Roles (Tenant-Level)
Roles defined in User model: owner, admin, manager, sales_clerk, storekeeper, accountant
Permissions defined in config/permissions.js with role-based access

## Key Finding - Gap
Currently no **platform-level/super-admin** functionality. All admins (owner/admin roles) are scoped to their tenant. There's no way for a platform operator to:
1. Manage multiple customers/tenants from a central admin panel
2. Onboard new customers and provision access for the first time
3. Monitor/suspend tenants across the platform
4. Create tenant admins/owners without going through the self-setup flow

The request is asking for: "admin conteraol page for the different customer that can provide acces to the given company for the first time"

## Suggested Solution
Need to add platform-level administration:
1. **Platform Admin Model/Role** - Global super-admin not tied to a specific tenant, or a separate PlatformUser model
2. **Platform API routes** - CRUD operations for tenants, user provisioning, tenant activation/suspension
3. **Platform Admin UI** - Separate admin portal/dashboard to manage all customers/tenants
4. **Onboarding flow** - Create tenant + provision owner/admin account for first-time access

Options:
- Add isPlatformAdmin flag to User model (global admin, bypass tenant scoping)
- Or create separate PlatformAdmin model with different auth
- Or use a special role/system user

Also need to modify tenantScope to skip scoping for platform admins.

## Implementation Plan for Platform Admin Control Panel

### 1. Backend Changes

#### A. Extend User Model
Add platform admin capability:
`js
// Add to User model
isPlatformAdmin: { type: Boolean, default: false, index: true },
// Platform admins may not need tenantId or can have null
tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true, required: function() { return !this.isPlatformAdmin; } }
`

#### B. Modify Auth Middleware
Skip tenant context setting for platform admins, or handle differently.
`js
// In authenticate middleware
req.user = user;
req.userId = user._id;
req.userRole = user.role;
if (user.isPlatformAdmin) {
  req.isPlatformAdmin = true;
  // Don't set tenant context or set to null
} else {
  req.tenantId = user.tenantId;
  setTenantContext(user.tenantId);
}
`

#### C. Modify Tenant Scoping
Skip scoping for platform admins:
`js
// In tenantScope utility, check if platform admin
// Need to pass context or check from request
`

#### D. Add Platform Admin Routes
Create server/src/routes/platform.routes.js with:
- GET /api/platform/tenants - List all tenants with stats
- POST /api/platform/tenants - Create tenant + provision owner
- GET /api/platform/tenants/:id - Get tenant details
- PATCH /api/platform/tenants/:id - Update tenant (status, plan, etc.)
- POST /api/platform/tenants/:id/impersonate - Generate token to access tenant as owner (optional)
- DELETE /api/platform/tenants/:id - Suspend/delete tenant
- GET /api/platform/stats - Platform-wide statistics

#### E. Add Platform Middleware
`js
// middleware/platform.js
export function requirePlatformAdmin(req, res, next) {
  if (!req.user?.isPlatformAdmin) {
    throw ApiError.forbidden('Platform admin access required', 'PLATFORM_ADMIN_REQUIRED');
  }
  next();
}
`

### 2. Frontend Changes

#### A. Add Platform Admin Routes/Pages
- Create client/src/pages/platform/ directory
- PlatformDashboard.jsx - Overview of all tenants, stats
- TenantsList.jsx - List/manage all customers/tenants
- TenantCreate.jsx - Onboard new customer (create tenant + owner)
- TenantDetails.jsx - View/edit tenant, manage users, settings

#### B. Add Platform Context/Auth
- Extend AuthContext to handle platform admin sessions
- Different navigation/layout for platform admin vs tenant users

#### C. Update App Routing
Add routes like /platform/* for platform admins

#### D. Update Navigation
Show platform admin menu when isPlatformAdmin is true

### 3. Database Changes
- Add isPlatformAdmin to users collection
- Ensure tenantId can be null for platform admins (or make it not required)
- Add indexes

### 4. Security Considerations
- Platform admin routes must be strictly protected
- Separate auth flow or same JWT with flag
- Audit all platform admin actions
- Rate limiting on platform endpoints

## Quick Start Implementation
1. Create platform admin user via seed/script first
2. Login as platform admin to access control panel
3. Use panel to create tenants and provision first-time access for customers
