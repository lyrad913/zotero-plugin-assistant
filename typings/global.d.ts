declare const _globalThis: {
  [key: string]: any;
  Zotero: _ZoteroTypes.Zotero;
  ztoolkit: ZToolkit;
  addon: typeof addon;
};

declare type ZToolkit = ReturnType<
  typeof import("../src/utils/ztoolkit").createZToolkit
>;

declare const ztoolkit: ZToolkit;

declare const rootURI: string;

declare const addon: import("../src/addon").default;

declare const __env__: "production" | "development";

declare module 'pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js';
declare module "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
declare module "pdfjs-dist/legacy/build/pdf.min.mjs";
declare module "pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js";
declare module "pdf-parse/lib/pdf.js/v2.0.550/build/pdf.worker.js";
declare module "pdfjs-dist/build/pdf.min.mjs";
declare module "pdfjs-dist/legacy/build/pdf.mjs";
