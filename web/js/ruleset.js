import { hashValue } from "./canonical.js";

export class IllegalAction extends Error {}

export const rulesetHash = (rules) =>
  hashValue({ id: rules.id, version: rules.version, spec: rules.spec() });
