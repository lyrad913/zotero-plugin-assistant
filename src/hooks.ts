import {
  BasicExampleFactory,
  HelperExampleFactory,
  KeyExampleFactory,
  PromptExampleFactory,
  UIExampleFactory,
} from "./modules/examples";
import { getString, initLocale } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";
import { registerAssistantPaneSection } from "./modules/readerPane";

import { getResponse } from "./modules/components/llm";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  BasicExampleFactory.registerPrefs();

  // BasicExampleFactory.registerNotifier();

  // KeyExampleFactory.registerShortcuts();

  // await UIExampleFactory.registerExtraColumn();

  // await UIExampleFactory.registerExtraColumnWithCustomCell();

  // UIExampleFactory.registerItemPaneCustomInfoRow();

  // UIExampleFactory.registerItemPaneSection();

  // UIExampleFactory.registerReaderItemPaneSection();

  registerAssistantPaneSection();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  // addon.data.ztoolkit = createZToolkit();

  // @ts-ignore This is a moz feature
  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  // // TEST: Workspace Post
  // try {
  //   const chatEndpoint = "http://localhost:1234/v1/chat/completions";
  //   const payload = {
  //     model: "qwen2.5-7b-instruct-1m",
  //     messages: [
  //       { role: "user", content: "Direct fetch POST test from Zotero" },
  //     ],
  //     stream: false,
  //   };
  //   ztoolkit.log(`[Hooks.ts] Attempting DIRECT fetch POST to: ${chatEndpoint}`);
  //   const directPostResponse = await fetch(chatEndpoint, {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify(payload),
  //   });

  //   ztoolkit.log(
  //     `[Hooks.ts] DIRECT fetch POST response status: ${directPostResponse.status}`,
  //   );
  //   if (directPostResponse.ok) {
  //     const responseData = await directPostResponse.json(); // ★★★ 여기서 JSON 파싱 시도 ★★★
  //     ztoolkit.log(
  //       `[Hooks.ts] DIRECT fetch POST response data: ${JSON.stringify(responseData)}`,
  //     );
  //     // 성공 로그가 보이면 Zotero 환경 자체는 문제 없음
  //   } else {
  //     const errorText = await directPostResponse.text();
  //     ztoolkit.log(
  //       `[Hooks.ts] DIRECT fetch POST failed. Status: ${directPostResponse.status}, Text: ${errorText}`,
  //     );
  //     // 실패 시 원인 파악 필요
  //   }
  // } catch (fetchError) {
  //   ztoolkit.log(`[Hooks.ts] DIRECT fetch POST Error caught.`);
  //   if (fetchError instanceof Error) {
  //     ztoolkit.log(
  //       `[Hooks.ts] Direct fetch Error message: ${fetchError.message}. Stack: ${fetchError.stack}`,
  //     );
  //   } else {
  //     ztoolkit.log(
  //       `[Hooks.ts] Direct fetch Caught non-Error object or undefined: ${JSON.stringify(fetchError)}`,
  //     );
  //   }
  //   // 실패 시 원인 파악 필요
  // }

  const popupWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: -1,
  })
    .createLine({
      text: getString("startup-begin"),
      type: "default",
      progress: 0,
    })
    .show();

  // await Zotero.Promise.delay(1000);
  // popupWin.changeLine({
  //   progress: 30,
  //   text: `[30%] ${getString("startup-begin")}`,
  // });

  UIExampleFactory.registerStyleSheet(win);

  // UIExampleFactory.registerRightClickMenuItem();

  // UIExampleFactory.registerRightClickMenuPopup(win);

  // UIExampleFactory.registerWindowMenuWithSeparator();

  // PromptExampleFactory.registerNormalCommandExample();

  // PromptExampleFactory.registerAnonymousCommandExample(win);

  // PromptExampleFactory.registerConditionalCommandExample();

  await Zotero.Promise.delay(1000);

  popupWin.changeLine({
    progress: 100,
    text: `[100%] ${getString("startup-finish")}`,
  });
  popupWin.startCloseTimer(5000);

  // addon.hooks.onDialogEvents("dialogExample");
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  // Remove addon object
  addon.data.alive = false;
  // @ts-ignore - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

/**
 * This function is just an example of dispatcher for Notify events.
 * Any operations should be placed in a function to keep this funcion clear.
 */
async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  // You can add your code to the corresponding notify type
  ztoolkit.log("notify", event, type, ids, extraData);
  if (
    event == "select" &&
    type == "tab" &&
    extraData[ids[0]].type == "reader"
  ) {
    BasicExampleFactory.exampleNotifierCallback();
  } else {
    return;
  }
}

/**
 * This function is just an example of dispatcher for Preference UI events.
 * Any operations should be placed in a function to keep this funcion clear.
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

function onShortcuts(type: string) {
  switch (type) {
    case "larger":
      KeyExampleFactory.exampleShortcutLargerCallback();
      break;
    case "smaller":
      KeyExampleFactory.exampleShortcutSmallerCallback();
      break;
    default:
      break;
  }
}

function onDialogEvents(type: string) {
  switch (type) {
    case "dialogExample":
      HelperExampleFactory.dialogExample();
      break;
    case "clipboardExample":
      HelperExampleFactory.clipboardExample();
      break;
    case "filePickerExample":
      HelperExampleFactory.filePickerExample();
      break;
    case "progressWindowExample":
      HelperExampleFactory.progressWindowExample();
      break;
    case "vtableExample":
      HelperExampleFactory.vtableExample();
      break;
    default:
      break;
  }
}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents,
};
