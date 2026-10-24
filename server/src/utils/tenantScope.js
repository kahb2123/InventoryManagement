/**
 * Tenant scoping context for Mongoose queries.
 *
 * The auth middleware sets the current tenant ID on each request. Models
 * that use `tenantScope` will automatically inject `tenantId` into new
 * documents on save/insertMany, and scope update/delete filters by tenantId.
 * Read queries (find, findOne, countDocuments) must add `tenantId` to their
 * filter explicitly in route handlers.
 */
let currentTenantId = null;

export function setTenantContext(tenantId) {
  currentTenantId = tenantId;
}

export function getTenantContext() {
  return currentTenantId;
}

export function clearTenantContext() {
  currentTenantId = null;
}

/**
 * Returns a $match stage that scopes an aggregation pipeline to the given tenant.
 * Prepend this to any aggregate pipeline: Model.aggregate([tenantMatch(tenantId), ...existingStages]).
 */
export function tenantMatch(tenantId) {
  return { $match: { tenantId } };
}

/**
 * Attach automatic tenant scoping to a Mongoose schema.
 * Write/update hooks only; reads are scoped explicitly in routes.
 */
export function tenantScope(schema) {
  // --- Write scoping: inject tenantId into newly created documents ---------
  // Async pre('save') runs after validation; tenantId is NOT required in schemas
  // so validation passes, then the hook injects tenantId before persisting.
  schema.pre('save', async function () {
    if (!this || !currentTenantId) return;
    if (this.isNew && this.tenantId === undefined) {
      this.tenantId = currentTenantId;
    }
  });

  schema.pre('insertMany', async function () {
    if (!this || !currentTenantId) return;
    const docs = this.getOptions?.()?.docs || [];
    for (const doc of docs) {
      if (doc && doc.tenantId === undefined) {
        doc.tenantId = currentTenantId;
      }
    }
  });

  // --- Write scoping: tenantId in filter, blocked from update body ---------
  const WRITE_OPS = ['updateOne', 'updateMany', 'replaceOne', 'findOneAndUpdate'];
  for (const op of WRITE_OPS) {
    schema.pre(op, async function () {
      if (!this || !currentTenantId) return;
      const query = this.getQuery();
      if (query.tenantId === undefined) {
        query.tenantId = currentTenantId;
      }
      const update = this.getUpdate();
      if (update && update.$set && update.$set.tenantId !== undefined) {
        delete update.$set.tenantId;
      }
    });
  }
}

export default { setTenantContext, getTenantContext, clearTenantContext, tenantScope, tenantMatch };
