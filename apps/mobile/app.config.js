/**
 * app.json holds the static config; this only layers on what has to vary by
 * build. GitHub Pages serves the site from /<repo>/, so the bundle needs to
 * know its prefix — but only for that build. Local `expo start --web` and the
 * native builds leave DRAM_WEB_BASE_URL unset and keep serving from the root.
 */
module.exports = ({ config }) => {
  const baseUrl = process.env.DRAM_WEB_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};
