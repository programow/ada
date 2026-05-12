/**
 * Contract test that mechanically asserts the Rust `markers.rs` constants
 * and the TS `markers.ts` constants agree.
 *
 * It parses `src-tauri/src/markers.rs` as a text file, regex-extracts every
 * `pub const NAME: &str = "VALUE";` declaration, then asserts:
 *   1. each Rust name has a matching TS export with the same value;
 *   2. each TS export has a matching Rust constant (no orphaned TS keys).
 *
 * Catches: renames on either side, value drift, and missing counterparts.
 * If you rename or add a constant on one side, this test fails until you
 * sync the other — by design.
 *
 * To verify the test itself works, temporarily mutate one Rust value (e.g.
 * change `"mic-denied:"` to `"mic-blocked:"`); the test should fail with a
 * clear message naming the offending constant. Revert after.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import * as markers from './markers';

const rustSourcePath = resolve(__dirname, '../../src-tauri/src/markers.rs');
const rustSource = readFileSync(rustSourcePath, 'utf8');

function extractRustConstants(source: string): Record<string, string> {
    const out: Record<string, string> = {};
    // Matches: pub const NAME: &str = "VALUE";
    // VALUE is any sequence of non-quote chars (the constants here don't
    // need escape support — if that ever changes, widen this regex).
    const re = /pub const (\w+): &str = "([^"]+)";/g;
    for (const m of source.matchAll(re)) {
        const [, name, value] = m;
        if (name && value !== undefined) {
            out[name] = value;
        }
    }
    return out;
}

const rustConsts = extractRustConstants(rustSource);
const tsConsts = markers as unknown as Record<string, string>;

describe('Rust↔TS marker contract', () => {
    test('the Rust source actually contains constants (regex sanity check)', () => {
        // Guard against a future refactor that moves the constants into a
        // different shape and silently makes this test a no-op.
        expect(Object.keys(rustConsts).length).toBeGreaterThan(0);
    });

    test('every Rust marker has a matching TS marker with the same value', () => {
        for (const [name, value] of Object.entries(rustConsts)) {
            expect(tsConsts[name], `TS is missing export \`${name}\``).toBe(value);
        }
    });

    test('every TS marker has a matching Rust constant (no orphans)', () => {
        // Filter to only string exports so non-constant exports (none today,
        // but a future helper would not be a marker) don't trip the check.
        const tsStringNames = Object.entries(tsConsts)
            .filter(([, v]) => typeof v === 'string')
            .map(([k]) => k);
        for (const name of tsStringNames) {
            expect(
                rustConsts[name],
                `Rust is missing const \`${name}\` — either add it to markers.rs or remove from markers.ts`,
            ).toBe(tsConsts[name]);
        }
    });

    test('marker values end with a colon (error prefixes) or use the vox-era:// scheme (events)', () => {
        // The `.includes(MARKER)` calls on the JS side depend on the colon
        // suffix to disambiguate `accessibility-required:` from a hypothetical
        // `accessibility-required-extended` marker. Pin the convention here.
        for (const [name, value] of Object.entries(rustConsts)) {
            if (name.startsWith('ERR_')) {
                expect(value.endsWith(':'), `${name} should end with ':'`).toBe(true);
            } else if (name.startsWith('EVT_')) {
                expect(
                    value.startsWith('vox-era://'),
                    `${name} should use the vox-era:// event scheme`,
                ).toBe(true);
            }
        }
    });
});
