import { getModelInstance } from "./llm";
import { getEmbeddingInstance } from "./embeddings";
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  StateGraph,
  START,
  END,
  MemorySaver,
  messagesStateReducer,
  Annotation,
} from "@langchain/langgraph/web";
import { v4 as uuidv4 } from "uuid";
import { Document } from "@langchain/core/documents";

function formatDocs(docs, joinSeparator = "\n") {
  return docs
    .map((doc) => {
      const pageContent = doc.pageContent || "";

      // pageContent = pageContent.replace(/\n+/g, " ").trim();

      const source = doc.metadata?.source || "unknown_source";

      let pageNumber = 1; // 기본 페이지 번호
      if (doc.metadata && typeof doc.metadata.page !== "undefined") {
        const parsedPage = parseInt(doc.metadata.page, 10);
        if (!isNaN(parsedPage)) {
          pageNumber = parsedPage + 1;
        }
      }

      return `<document><content>${pageContent}</content><source>${source}</source><page>${pageNumber}</page></document>`;
    })
    .join(joinSeparator);
}

async function split(pdfURI: string) {
  const res = await fetch(pdfURI);
  const pdfBlob = await res.blob();

  return new Promise((resolve, reject) => {
    const load_worker = new ChromeWorker(
      `chrome://${addon.data.config.addonRef}/content/scripts/rag-worker.js`,
      { type: 'module' }
    );
    ztoolkit.log("[rag.ts] 워커에게 메세지 전송");
    load_worker.postMessage({ pdfBlob: pdfBlob });

    load_worker.onmessage = function (event) {
      ztoolkit.log("[rag.ts] 워커로부터 메세지 수신");
      // 워커가 보낸 메시지에 type 필드가 있는지 먼저 확인
      const messageData = event.data;
      ztoolkit.log("[rag.ts] Worker로부터 메시지 수신:", messageData);
      if (messageData && typeof messageData.type === 'string') {
        const { type, allSplits, error } = messageData;

        if (type === "SUCCESS" && allSplits) {
          // @ts-ignore xxx
          ztoolkit.log(`[rag.ts] Worker로부터 'allSplits' 수신: ${allSplits.length}개 분할`);
          resolve(allSplits as Document[]);
          load_worker.terminate(); // 성공 시 워커 종료
        } else if (type === "SHIT") { // 워커에서 정의한 오류 타입
          // @ts-ignore xxx
          ztoolkit.error("[rag.ts] Worker로부터 오류 수신 ('SHIT'):", error);
          const errorMessage = error?.message || (typeof error === 'string' ? error : "Worker에서 알 수 없는 오류 발생");
          reject(new Error(errorMessage));
          load_worker.terminate(); // 오류 시 워커 종료
        } else {
          // @ts-ignore xxx
          // type 필드는 있지만 "SUCCESS"나 "SHIT"가 아닌 경우 (예상치 못한 상황)
          ztoolkit.warn("[rag.ts] Worker로부터 알 수 없는 유형의 메시지 수신:", messageData);
          // 이 경우, 바로 reject하지 않고 다른 메시지를 기다릴 수도 있지만,
          // 현재 워커 로직상으로는 SUCCESS 또는 SHIT만 보내므로 오류로 간주할 수 있습니다.
          // reject(new Error("Worker로부터 알 수 없는 유형의 메시지 수신"));
          // load_worker.terminate();
        }
      } else {
        // type 필드가 없는 메시지 일단 무시하고 다음 메시지를 기다립니다.
        // @ts-ignore xxx
        ztoolkit.log("[rag.ts] Worker로부터 'type' 필드가 없는 메시지 수신 (무시):", messageData);
      }
    };
  });
}

// langgraph의 MemorySaver를 대체할 간단한 인-메모리 대화 기록 저장소
const chatHistories: Record<string, BaseMessage[]> = {};

export async function getResponse(
  pdfURI: string,
  question: string,
  threadID: string
): Promise<string> {
  const llm = await getModelInstance();
  const embeddings = await getEmbeddingInstance();
  const allSplits = await split(pdfURI);
  const vectorStore = new MemoryVectorStore(embeddings, {});
  await vectorStore.addDocuments(allSplits);
  const retriever = vectorStore.asRetriever({ k: 5 });

  // 1. 대화 기록을 고려하여 질문을 재구성하는 체인 생성
  const contextualizeQSystemPrompt =
    "Given a chat history and the latest user question " +
    "which might reference context in the chat history, " +
    "formulate a standalone question which can be understood " +
    "without the chat history. Do NOT answer the question, " +
    "just reformulate it if needed and otherwise return it as is.";
  const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
    ["system", contextualizeQSystemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);
  const historyAwareRetriever = await createHistoryAwareRetriever({
    llm,
    retriever,
    rephrasePrompt: contextualizeQPrompt,
  });

  // 2. 검색된 문서를 바탕으로 답변을 생성하는 체인 생성
  const systemPrompt =  `You are a highly skilled AI assistant specializing in analyzing provided documents to answer user questions. Your primary goal is to provide accurate and concise answers based **exclusively** on the given context.

 Follow these instructions carefully:
 1.  **Analyze and Synthesize:** Read the user's question and the retrieved context below. Generate an answer using **only** the information from the context. Do not use any external or prior knowledge.
 2.  **Language Match:** The answer **MUST** be in the same language as the user's question. (e.g., a Korean question requires a Korean answer).
 3.  **Preserve Terminology:** Do **NOT** translate technical terms, proper nouns, model names, or acronyms. Keep them in their original form.
 4.  **Conciseness:** Keep your answer to a maximum of 3-4 sentences, unless the user requests more detail. Be direct and to the point.
 5.  **Fallback:** If the answer cannot be found in the context, you must clearly state that you do not know or that the information is not available in the provided document.

 Context:
 {context}`;
  const qaPrompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);
  const questionAnswerChain = await createStuffDocumentsChain({
    llm,
    prompt: qaPrompt,
  });

  // 3. 위 두 체인을 결합하여 최종 RAG 체인 생성
  const ragChain = await createRetrievalChain({
    retriever: historyAwareRetriever,
    combineDocsChain: questionAnswerChain,
  });

  // 4. 저장소에서 현재 대화의 기록을 가져와 체인 실행
  const chatHistory = chatHistories[threadID] || [];

  const response = await ragChain.invoke({
    chat_history: chatHistory,
    input: question,
  });

  ztoolkit.log(response);

  // 5. 새로운 질문과 답변을 대화 기록에 추가하여 업데이트
  chatHistories[threadID] = chatHistory.concat([
    new HumanMessage(question),
    new AIMessage(response.answer),
  ]);

  return response.answer;
}


// export async function getResponseByGraph(
//   pdfURI: string,
//   question: string,
//   threadID: string,
// ): Promise<string> {
//   const llm = await getModelInstance();

//   const embeddings = await getEmbeddingInstance();

//   const allSplits = await split(pdfURI);
//   const vectorStore = new MemoryVectorStore(embeddings, {});
//   await vectorStore.addDocuments(allSplits);

//   const retriever = vectorStore.asRetriever({
//     k: 10,
//   });

//   const contextualizeQSystemPrompt =
//     "Given a chat history and the latest user question " +
//     "which might reference context in the chat history, " +
//     "formulate a standalone question which can be understood " +
//     "without the chat history. Do NOT answer the question, " +
//     "just reformulate it if needed and otherwise return it as is.";

//   const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
//     ["system", contextualizeQSystemPrompt],
//     new MessagesPlaceholder("chat_history"),
//     ["human", "{input}"],
//   ]);

//   const historyAwareRetriever = await createHistoryAwareRetriever({
//     llm: llm,
//     retriever: retriever,
//     rephrasePrompt: contextualizeQPrompt,
//   });

//   const systemPrompt =
//     "You are an assistant for question-answering tasks. " +
//     "Use the following pieces of retrieved context to answer " +
//     "the question. If you don't know the answer, say that you " +
//     "don't know. Use three sentences maximum and keep the " +
//     "answer concise." +
//     "\n\n" +
//     "{context}";

//   const qaPrompt = ChatPromptTemplate.fromMessages([
//     ["system", systemPrompt],
//     new MessagesPlaceholder("chat_history"),
//     ["human", "{input}"],
//   ]);

//   const questionAnswerChain = qaPrompt.pipe(llm);

//   // Define the State interface
//   const GraphAnnotation = Annotation.Root({
//     input: Annotation<string>(),
//     chat_history: Annotation<BaseMessage[]>({
//       reducer: messagesStateReducer,
//       default: () => [],
//     }),
//     context: Annotation<string>(),
//     answer: Annotation<string>(),
//   });

//   async function retrieveDocument(state: typeof GraphAnnotation.State) {
//     const latestQuestion = state.input;
//     const chatHistory = state.chat_history;
//     ztoolkit.log(`[rag.ts:retrieveDocument] \nlatestQuestion : ${latestQuestion}, \nchatHistory:${chatHistory}`)

//     // const retrievedDocs = await historyAwareRetriever.invoke({
//     //   input: latestQuestion,
//     //   chat_history: chatHistory,
//     // });
//     const retrievedDocs = await retriever.invoke(latestQuestion);
//     ztoolkit.log(`[rag.ts:retrieveDocument]: ${retrievedDocs}`);

//     const formattedDocs = await formatDocs(retrievedDocs);
//     ztoolkit.log(`[rag.ts:retrieveDocument]: ${formattedDocs}`);

//     return { context: formattedDocs };
//   }

//   async function callModel(state: typeof GraphAnnotation.State) {
//     const latestQuestion = state.input;
//     const context = state.context;
//     const chatHistory = state.chat_history;
//     ztoolkit.log(`[rag.ts:callModel] \nlatestQuestion : ${latestQuestion}, \ncontext: ${context}\nchatHistory:${chatHistory}`)


//     const response = await questionAnswerChain.invoke({
//       chat_history: chatHistory,
//       input: latestQuestion,
//       context: context,
//     });
//     const responseContent = response.content.toString();
//     ztoolkit.log(`[rag.ts:callModel]`);
//     ztoolkit.log(responseContent)

//     return {
//       answer: responseContent,
//       chat_history: [
//         new HumanMessage(latestQuestion),
//         new AIMessage(responseContent),
//       ],
//     };
//   }

//   // Create the workflow
//   const graph = new StateGraph(GraphAnnotation)
//     .addNode("model", callModel)
//     .addNode("retrieve_and_format", retrieveDocument)
//     .addEdge(START, "retrieve_and_format")
//     .addEdge("retrieve_and_format", "model")
//     .addEdge("model", END);


//   // Compile the graph with a checkpointer object
//   const memory = new MemorySaver();
//   const app = graph.compile({ checkpointer: memory });

//   const config = { configurable: { thread_id: threadID } };

//   const response = await app.invoke({ input: question }, { ...config });

//   return response.answer;
// }
