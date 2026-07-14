/**
 * Access hook kept for call-site compatibility.
 * Rate limiting has been removed — always allows when invoked after auth.
 *
 * @param {object} [_opts]
 * @param {string|null} [_opts.bucket] Ignored (legacy).
 */
export async function guardAccess(_context, _opts = {}) {
  return { ok: true };
}
