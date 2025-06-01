import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";
import { polyfillNode } from "esbuild-plugin-polyfill-node";

export default defineConfig({
  source: ["src", "addon"],
  dist: ".scaffold/build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  updateURL: `https://github.com/{{owner}}/{{repo}}/releases/download/release/${
    pkg.version.includes("-") ? "update-beta.json" : "update.json"
  }`,
  xpiDownloadLink:
    "https://github.com/{{owner}}/{{repo}}/releases/download/v{{version}}/{{xpiName}}.xpi",

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",

    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
          "console.error": "Zotero.debug",
          "console.log": "Zotero.debug"
        },
        bundle: true,
        plugins: [polyfillNode({
          polyfills:{
            fs: true,
            "fs/promises": true,
            // async_hooks: false,
          }
        })],
        target: "firefox115",
        outfile: `.scaffold/build/addon/content/scripts/${pkg.config.addonRef}.js`,
        // platform: "node"
      },
    ],
  },
  // If you need to see a more detailed log, uncomment the following line:
  logLevel: "TRACE",
});
