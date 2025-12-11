module.exports = {
  // TypeScript files (exclude prisma/seed.ts and scripts/preflight)
  "*.{ts,tsx}": [
    (filenames) => {
      // Exclude prisma/seed.ts and scripts/preflight from ESLint
      const filtered = filenames.filter(
        (f) =>
          !f.includes("prisma/seed.ts") && !f.includes("scripts/preflight"),
      );
      if (filtered.length === 0)
        return 'echo "Skipping ESLint for excluded files"';
      return `eslint --fix ${filtered.join(" ")}`;
    },
    "prettier --write",
  ],
  // JavaScript files (exclude scripts/preflight and config files from ESLint)
  "*.{js,jsx}": [
    (filenames) => {
      // Exclude scripts/preflight, config files, and .eslintrc.js
      const filtered = filenames.filter(
        (f) =>
          !f.includes("scripts/preflight") &&
          !f.includes(".eslintrc.js") &&
          !f.includes(".lintstagedrc.js") &&
          !f.includes("jest.config.js"),
      );
      if (filtered.length === 0)
        return 'echo "Skipping ESLint for excluded files"';
      return `eslint --fix ${filtered.join(" ")}`;
    },
    "prettier --write",
  ],
  // JSON, Markdown, and other files
  "*.{json,md,yml,yaml}": ["prettier --write"],
  // Prisma schema - use prisma format instead of prettier
  "prisma/**/*.prisma": ["prisma format"],
};
