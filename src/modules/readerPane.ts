import { config } from "../../package.json";
import { getLocaleID, getString } from "../utils/locale";
import { getPref } from "../utils/prefs";
import {
  // getResponseByGraph,
  getResponse
} from "./components/rag";
import { addMessage } from "./components/ChatMessage"; // ChatMessage.ts 파일에서 addMessage 함수 가져오기
// import { getResponse } from "./components/llm";
// import { AsyncGeneratorWithSetup } from "@langchain/core/utils/stream";

const chatSystemPrompt = "You're an Helpful Assistant";

export function registerAssistantPaneSection() {
  Zotero.ItemPaneManager.registerSection({
    paneID: "chat-with-pdf-tabpanel",
    pluginID: config.addonID,
    header: {
      l10nID: getLocaleID("item-section-chatwithpdf-head-text"),
      icon: `chrome://${addon.data.config.addonRef}/content/icons/chat16.png`,
    },
    sidenav: {
      l10nID: getLocaleID("item-section-chatwithpdf-sidenav-tooltip"),
      icon: `chrome://${addon.data.config.addonRef}/content/icons/chat16.png`,
    },
    bodyXHTML: `
         <div id="chat-with-paper-container" style="display: flex; flex-direction: column; overflow: hidden; height: 100%; width: 100%">
             <div id="chat-messages" style="flex-grow: 1; overflow-y: auto; margin-bottom: 10px; display: flex; flex-direction: column;"> </div>
             <div style="background-color: #f0f0f0; border-radius: 8px; padding: 5px; flex-shrink: 0;"> <html:textarea id="chat-input" placeholder="Ask a question about the Paper!"
                     style="width: 100%; min-height: 20px; max-height: 150px; padding: 6px; border: 1px solid #ccc; border-radius: 8px; font-family: inherit; font-size: 14px; resize: none; overflow-y: auto; box-sizing: border-box; scrollbar-width: none; -ms-overflow-style: none;"/>
             </div>
         </div>
         `,
    onItemChange: ({ item, setEnabled, tabType }) => {
      // tabType이 'reader'일 경우에만 섹션을 활성화합니다.
      const shouldBeEnabled = tabType === "reader";
      setEnabled(shouldBeEnabled); //
      return true; // 변경 사항을 적용하려면 true를 반환해야 합니다.
    },
    onRender: async ({ body, item }) => {
      let pdfURI = "";
      let threadID = "";
      ztoolkit.log(`[readerPane.ts: onRender] item id : ${item.id}`);
      if (!item.isAttachment()) {
        const attachments = item.getAttachments();
        for (const attachmentID of attachments) {
          const attachment = Zotero.Items.get(attachmentID);
          if (
            attachment.attachmentContentType === "application/pdf" ||
            attachment.attachmentContentType === ""
          ) {
            try {
              const pdfPath = await attachment.getFilePathAsync();
              ztoolkit.log(`File Path : ${pdfPath}`);
              pdfURI = Zotero.File.pathToFileURI(pdfPath);
              threadID = `${item.id}.${attachmentID}`;
              ztoolkit.log(`[readerPane.ts: onRender] attachment id : ${attachmentID}`);
              ztoolkit.log(`[readerPane.ts: onRender] threadID : ${threadID}`);
              break;
            } catch (error) {
              ztoolkit.log(error);
            }
          }
        }
      }

      const chatContainer = body.querySelector(
        "#chat-with-paper-container",
      ) as HTMLElement;
      const chatMessages = body.querySelector("#chat-messages") as HTMLElement;
      const input = body.querySelector("#chat-input") as HTMLTextAreaElement;
      const doc = body.ownerDocument; // Reader Pane의 document 객체 가져오기

      if (chatContainer && chatMessages && input && doc) {
        // doc null 체크 추가
        const adjustContainerHeight = () => {
          const windowHeight = window.outerHeight;
          chatContainer.style.height = `${windowHeight - 130}px`;
          adjustMessagesHeight();
        };

        const adjustMessagesHeight = () => {
          const containerHeight = chatContainer.clientHeight;
          const inputHeight = input.offsetHeight;
          chatMessages.style.height = `${containerHeight - inputHeight - 10}px`;
          adjustMessagesHeight();
        };

        const adjustInputHeight = () => {
          input.style.height = "10px";
          input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
          input.scrollTop = 0;
        };

        input.addEventListener("input", () => {
          adjustInputHeight();
          input.setSelectionRange(input.value.length, input.value.length);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        });

        input.addEventListener("keypress", async (e) => {
          // 이벤트 리스너 함수 시작
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const question = input.value.trim();
            if (question) {
              ztoolkit.log("Question:", question);
              addMessage(doc, chatMessages, question, "user"); // doc 인자 전달
              input.value = "";
              adjustInputHeight();

              input.disabled = true;

              addMessage(doc, chatMessages, "Thinking...", "ai"); // doc 인자 전달
              const thinkingMessage =
                chatMessages.lastElementChild as HTMLElement;
              thinkingMessage.scrollTop = thinkingMessage.scrollHeight;

              try {
                // const response = await getResponse(chatSystemPrompt, question);
                const response = await getResponse(pdfURI, question, threadID);

                if (thinkingMessage && chatMessages.contains(thinkingMessage)) {
                  // Remove the thinking message
                  chatMessages.removeChild(thinkingMessage);
                  // Add the response message with the same style as addMessage
                  addMessage(doc, chatMessages, response, "ai");
                } else {
                  addMessage(doc, chatMessages, response, "ai"); // doc 인자 전달
                }
              } catch (error) {
                ztoolkit.log("Error getting Response:", error);
                if (thinkingMessage && chatMessages.contains(thinkingMessage)) {
                  // Remove the thinking message
                  chatMessages.removeChild(thinkingMessage);
                  // Add the response message with the same style as addMessage
                  addMessage(
                    doc,
                    chatMessages,
                    "Sorry, I couldn't get a response. Please try again.",
                    "ai",
                  );
                } else {
                  addMessage(
                    doc,
                    chatMessages,
                    "Sorry, I couldn't get a response. Please try again.",
                    "ai",
                  ); // doc 인자 전달
                }
              } finally {
                input.disabled = false;
                input.focus();
              }
            }
          }
        }); // 이벤트 리스너 함수 끝

        // Initial height adjustments
        adjustInputHeight();

        // Clean up function
        return () => {
          // Cleanup if necessary
        };
      }
    },
  });
}
