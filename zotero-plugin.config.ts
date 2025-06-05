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
          "console.log": "Zotero.debug",

        },
        bundle: true,
        plugins: [polyfillNode({
          polyfills: {
            fs: true,
            "fs/promises": true,
          }
        })],
        target: "firefox115",
        external: ['resource://*', 'chrome://*'],
        outfile: `.scaffold/build/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
      {
        entryPoints: ["src/worker/rag-worker.ts"], // 워커 파일 경로
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        bundle: true,
        target: "firefox115", // 또는 Zotero 호환 버전
        outfile: `.scaffold/build/addon/content/scripts/rag-worker.js`, // 출력 파일 경로
        plugins: [polyfillNode({
          polyfills: {
            fs: true,
            "fs/promises": true,
          }
        })],
        external: ['resource://*', 'chrome://*'],
        format: "esm"
        // 워커는 format: 'esm'이 필요할 수 있습니다. 테스트 필요.
      },
    ],
  },
  // If you need to see a more detailed log, uncomment the following line:
  logLevel: "TRACE",
});
