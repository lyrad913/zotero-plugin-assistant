import { getModelInstance } from "./llm";
import { getEmbeddingInstance } from "./embeddings";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
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
import { Embeddings } from "@langchain/core/embeddings";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import { Document } from "@langchain/core/documents";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = `chrome://${addon.data.config.addonRef}/content/js/pdf.worker.js`;

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
  // const pdfjs = await import("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");
  // pdfjs.GlobalWorkerOptions.workerSrc = `${rootURI}/content/scripts/pdf.worker.js`;
  const res = await ztoolkit.getGlobal("fetch")(pdfURI);
  const pdfBlob = await res.blob();

  const loader = new WebPDFLoader(pdfBlob,
    { pdfjs: () => pdfjsLib }
  );

  const docs = await loader.load();

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const allSplits = await textSplitter.splitDocuments(docs);

  return allSplits;
}

async function embedAndStore(pdfPath: string, embeddings: Embeddings) {
  try {
    const vectorStore = new FaissStore(embeddings, {});
    const allSplits = await split(pdfPath);
    await vectorStore.addDocuments(allSplits);
    return vectorStore;
  } catch (error) {
    ztoolkit.log(error);
  }
}

export async function getResponseByGraph(
  question: string,
  pdfPath: string,
): Promise<string> {
  const llm = await getModelInstance();

  const embeddings = await getEmbeddingInstance();

  const vectorStore = await embedAndStore(pdfPath, embeddings);
  const retriever = vectorStore.asRetriever({
    k: 10,
  });

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
    llm: llm,
    retriever: retriever,
    rephrasePrompt: contextualizeQPrompt,
  });

  const systemPrompt =
    "You are an assistant for question-answering tasks. " +
    "Use the following pieces of retrieved context to answer " +
    "the question. If you don't know the answer, say that you " +
    "don't know. Use three sentences maximum and keep the " +
    "answer concise." +
    "\n\n" +
    "{context}";

  const qaPrompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  const questionAnswerChain = qaPrompt.pipe(llm);

  // Define the State interface
  const GraphAnnotation = Annotation.Root({
    input: Annotation<string>(),
    chat_history: Annotation<BaseMessage[]>({
      reducer: messagesStateReducer,
      default: () => [],
    }),
    context: Annotation<string>(),
    answer: Annotation<string>(),
  });

  async function retrieveDocument(state: typeof GraphAnnotation.State) {
    const latestQuestion = state.input;
    const chatHistory = state.chat_history;

    const retrievedDocs = await historyAwareRetriever.invoke({
      input: latestQuestion,
      chat_history: chatHistory,
    });

    const formattedDocs = await formatDocs(retrievedDocs);

    return { context: formattedDocs };
  }

  async function callModel(state: typeof GraphAnnotation.State) {
    const latestQuestion = state.input;
    const context = state.context;
    const chatHistory = state.chat_history;

    const response = await questionAnswerChain.invoke({
      chat_history: chatHistory,
      input: latestQuestion,
      context: context,
    });

    return {
      answer: response.content,
      chat_history: [
        new HumanMessage(latestQuestion),
        new AIMessage(response.content.toString()),
      ],
    };
  }

  // Create the workflow
  const graph = new StateGraph(GraphAnnotation)
    .addNode("model", callModel)
    .addNode("retrieve_and_format", retrieveDocument)
    .addEdge(START, "retrieve_and_format")
    .addEdge("retrieve_and_format", "model")
    .addEdge("model", END);

  // Compile the graph with a checkpointer object
  const memory = new MemorySaver();
  const app = graph.compile({ checkpointer: memory });

  const threadId = uuidv4();
  const config = { configurable: { thread_id: threadId } };

  // import { isAIMessageChunk } from "@langchain/core/messages";

  // const stream = await app.stream(
  //   { input: "Explain Attention Mechanism" },
  //   { streamMode: "messages", ...config },
  // );

  // for await (const [message, _metadata] of stream) {
  //   if (isAIMessageChunk(message)) {
  //     console.log(`${message.getType()} MESSAGE CONTENT: ${message.content}`);
  //   }
  // }

  const response = await app.invoke({ input: question }, { ...config });

  return response.answer.toString();
}



// class WebPDFLoader extends BaseDocumentLoader {
//   protected blob: Blob;

//   protected splitPages = true;

//   // private pdfjs: typeof PDFLoaderImports;
//   private pdfjs: () => Promise<{ getDocument: any; version: string }>;

//   protected parsedItemSeparator: string;

//   // constructor(
//   //   blob: Blob,
//   //   {
//   //     splitPages = true,
//   //     pdfjs = PDFLoaderImports,
//   //     parsedItemSeparator = "",
//   //   } = {}
//   // ) {
//   constructor(
//     blob: Blob,
//     {
//       splitPages = true,
//       pdfjs = PDFLoaderImports,
//       parsedItemSeparator = "",
//     } = {},
//   ) {
//     super();
//     this.blob = blob;
//     this.splitPages = splitPages ?? this.splitPages;
//     this.pdfjs = pdfjs;
//     this.parsedItemSeparator = parsedItemSeparator;
//   }

//   /**
//    * Loads the contents of the PDF as documents.
//    * @returns An array of Documents representing the retrieved data.
//    */
//   async load(): Promise<Document[]> {
//     const { getDocument, version } = await this.pdfjs();
//     const parsedPdf = await getDocument({
//       data: new Uint8Array(await this.blob.arrayBuffer()),
//       useWorkerFetch: false,
//       isEvalSupported: false,
//       useSystemFonts: true,
//     }).promise;
//     const meta = await parsedPdf.getMetadata().catch(() => null);

//     const documents: Document[] = [];

//     for (let i = 1; i <= parsedPdf.numPages; i += 1) {
//       const page = await parsedPdf.getPage(i);
//       const content = await page.getTextContent();

//       if (content.items.length === 0) {
//         continue;
//       }

//       // Eliminate excessive newlines
//       // Source: https://github.com/albertcui/pdf-parse/blob/7086fc1cc9058545cdf41dd0646d6ae5832c7107/lib/pdf-parse.js#L16
//       let lastY;
//       const textItems = [];
//       for (const item of content.items) {
//         if ("str" in item) {
//           if (lastY === item.transform[5] || !lastY) {
//             textItems.push(item.str);
//           } else {
//             textItems.push(`\n${item.str}`);
//           }
//           // eslint-disable-next-line prefer-destructuring
//           lastY = item.transform[5];
//         }
//       }
//       const text = textItems.join(this.parsedItemSeparator);

//       documents.push(
//         new Document({
//           pageContent: text,
//           metadata: {
//             pdf: {
//               version,
//               info: meta?.info,
//               metadata: meta?.metadata,
//               totalPages: parsedPdf.numPages,
//             },
//             loc: {
//               pageNumber: i,
//             },
//           },
//         }),
//       );
//     }

//     if (this.splitPages) {
//       return documents;
//     }

//     if (documents.length === 0) {
//       return [];
//     }

//     return [
//       new Document({
//         pageContent: documents.map((doc) => doc.pageContent).join("\n\n"),
//         metadata: {
//           pdf: {
//             version,
//             info: meta?.info,
//             metadata: meta?.metadata,
//             totalPages: parsedPdf.numPages,
//           },
//         },
//       }),
//     ];

//     return documents;
//   }
// }

// async function PDFLoaderImports() {
//   return {
//     getDocument: getDocument,
//     version: version,
//   };
// }

// async function PDFLoaderImports() {
//   try {
//     const { default: mod } = await import(
//       "pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js"
//     );
//     const { getDocument, version } = mod;
//     return { getDocument, version };
//   } catch (e) {
//     console.error(e);
//     throw new Error(
//       "Failed to load pdf-parse. Please install it with eg. `npm install pdf-parse`."
//     );
//   }
// }
