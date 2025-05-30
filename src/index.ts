// Solving an Error "ReadableStream is not defined."
import "web-streams-polyfill/polyfill";
_globalThis.ReadableStream = ReadableStream;

import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { config } from "../package.json";

const basicTool = new BasicTool();

// @ts-ignore - Plugin instance is not typed
if (!basicTool.getGlobal("Zotero")[config.addonInstance]) {
  _globalThis.addon = new Addon();
  defineGlobal("ztoolkit", () => {
    return _globalThis.addon.data.ztoolkit;
  });
  // @ts-ignore - Plugin instance is not typed
  Zotero[config.addonInstance] = addon;
}

function defineGlobal(name: Parameters<BasicTool["getGlobal"]>[0]): void;
function defineGlobal(name: string, getter: () => any): void;
function defineGlobal(name: string, getter?: () => any) {
  Object.defineProperty(_globalThis, name, {
    get() {
      return getter ? getter() : basicTool.getGlobal(name);
    },
  });
}

// Solving Dependecy of Langchain.js
_globalThis.Headers = ztoolkit.getGlobal("Headers");
_globalThis.Request = ztoolkit.getGlobal("Request");
_globalThis.Response = ztoolkit.getGlobal("Response");
_globalThis.AbortSignal = ztoolkit.getGlobal("AbortSignal");
_globalThis.AbortController = ztoolkit.getGlobal("AbortController");
