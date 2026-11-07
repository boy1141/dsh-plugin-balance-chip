/**
 * Host half of the balance chip.
 *
 * The chip itself is a browser plugin: `dsh-client-modules` reads this package's
 * `dsh.client` manifest and serves `lib/client.js` under `/plugins`. This Host row
 * only has to exist so the Loader has one enabled entry to compose the bundle
 * from, so it deliberately mounts no service, route, or configuration.
 */

/** Stable plugin name used by the Loader entry. */
export const name = 'dsh-plugin-balance-chip'

/** Mount nothing; the browser half owns all behaviour. */
export function apply() {}
