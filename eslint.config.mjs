import { makeConfig } from "@remotion/eslint-config-flat";

export default [
  {
    ignores: ["node_modules/**", "output/**", ".cache/**", "tools/**", "docs/**"],
  },
  // Incluye typescript-eslint + reglas de Remotion (solo en el codigo que corre dentro del bundle).
  ...makeConfig({ remotionDir: "src/{compositions,components}/**" }),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // En tests se manipulan JSON arbitrarios para provocar errores de schema.
    files: ["tests/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
];
