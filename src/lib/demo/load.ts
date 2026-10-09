/**
 * The only place that dynamically imports the demo backend. The inline env check lets the bundler drop the import (and
 * therefore the whole `src/lib/demo` chunk) from builds where NEXT_PUBLIC_DEMO_MODE is not "true".
 */
export function loadDemo(): Promise<typeof import("./index")> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return Promise.reject(new Error("Demo mode is not enabled"));
  return import("./index");
}
