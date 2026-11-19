import { checkStructure, sanitize } from "../schema.mjs";
import * as v010 from "./0.1.0.mjs";

const SCHEMAS = { "0.1.0": v010 };

export const validateStructure = (files, version) => checkStructure(files, SCHEMAS[version].structure);

export function sanitizeFiles(files, version) {
  const warnings = [];
  const clean = Object.fromEntries(Object.entries(SCHEMAS[version].values).map(([file, node]) => [file, sanitize(files[file], node, file, warnings)]));
  return { files: clean, warnings };
}
