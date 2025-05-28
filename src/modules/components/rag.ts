import { getModelInstance } from "./llm";
import { getEmbeddingInstance } from "./embeddings";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
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
} from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";

const llm = await getModelInstance();

const embeddings = await getEmbeddingInstance();

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

async function split(pdfPath: string) {
  const loader = new PDFLoader(pdfPath);

  const docs = await loader.load();

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const allSplits = await textSplitter.splitDocuments(docs);

  return allSplits;
}

async function embedAndStore(pdfPath: string) {
  try {
    const vectorStore = new FaissStore(embeddings, {});
    const allSplits = await split(pdfPath);
    await vectorStore.addDocuments(allSplits);
    return vectorStore;
  } catch (error) {
    console.log(error);
  }
}

const vectorStore = await embedAndStore("./1706.03762v7.pdf");
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

import { isAIMessageChunk } from "@langchain/core/messages";

const stream = await app.stream(
  { input: "Explain Attention Mechanism" },
  { streamMode: "messages", ...config },
);

for await (const [message, _metadata] of stream) {
  if (isAIMessageChunk(message)) {
    console.log(`${message.getType()} MESSAGE CONTENT: ${message.content}`);
  }
}

const stream2 = await app.stream(
  { input: "Explain Transformer Model" },
  { streamMode: "messages", ...config },
);

for await (const [message, _metadata] of stream2) {
  if (isAIMessageChunk(message)) {
    console.log(`${message.getType()} MESSAGE CONTENT: ${message.content}`);
  }
}
