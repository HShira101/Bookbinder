const results = [];

export const test = (name, fn) => results.push([name, fn]);

export const equal = (actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

export const truthy = (value, message) => {
  if (!value) throw new Error(message);
};

export async function runAll() {
  const out = [];
  for (const [name, fn] of results) {
    try {
      await fn();
      out.push({ name, ok: true });
    } catch (error) {
      out.push({ name, ok: false, message: error.message });
    }
  }
  return out;
}
