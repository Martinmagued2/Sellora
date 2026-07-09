// Empty PostCSS config for this worktree. Prevents Vite/vitest from
// searching up the directory tree and loading the parent project's
// postcss.config.mjs (which references @tailwindcss/postcss, a plugin
// that isn't installed here). Unit tests don't process CSS, so an
// empty plugin list is sufficient.
const config = {
  plugins: [],
};

export default config;
