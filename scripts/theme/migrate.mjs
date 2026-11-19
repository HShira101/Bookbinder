export function migrate(data, start, { formats, steps, validate }) {
  let version = start;
  for (let guard = 0; guard <= formats.length * formats.length; guard++) {
    const check = validate(data, version);
    if (check.ok) {
      if (version === formats.at(-1)) return { ok: true, data, version };
      const next = formats[formats.indexOf(version) + 1];
      try {
        data = steps[next](structuredClone(data));
      } catch (error) {
        return { ok: false, step: next, issue: { path: "", message: error.message } };
      }
      version = next;
      continue;
    }
    const later = formats.slice(formats.indexOf(version) + 1).find(format => validate(data, format).ok);
    if (!later) return { ok: false, step: version, issue: check.issue };
    version = later;
  }
  return { ok: false, step: version, issue: { path: "", message: "migration did not converge" } };
}
