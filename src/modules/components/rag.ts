import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { getModelInstance } from "./embeddings";
import { VectorStore } from "@langchain/core/vectorstores";

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
  const embeddings = await getModelInstance();

  try {
    const vectorStore = new FaissStore(embeddings, {});
    const allSplits = await split(pdfPath);
    await vectorStore.addDocuments(allSplits);
    return vectorStore;
  } catch {}
}
