import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // Los tests de `e2e/` corren con Playwright (`npm run e2e`), no con vitest: si se mezclan, vitest
    // intenta cargar `@playwright/test` como si fuera una suite y falla todo.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "e2e/**"],
  },
});
