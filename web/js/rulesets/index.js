// Registry by (id, version) so old runs and links stay verifiable.

import { Sandbox } from "./sandbox.js";

const REGISTRY = new Map([[`${Sandbox.id}@${Sandbox.version}`, Sandbox]]);

/** Rules the site currently serves. */
export const CURRENT = Sandbox;

export function load(id, version, spec) {
  const cls = REGISTRY.get(`${id}@${version}`);
  if (!cls) throw new Error(`unknown ruleset ${id}@${version}`);
  return new cls(spec ?? {});
}
