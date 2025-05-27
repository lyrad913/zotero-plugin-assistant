import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { getEmbeddingInstance } from "./embeddings";
import { VectorStore } from "@langchain/core/vectorstores";

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
  // TODO: cache할 수 있음????
  try {
    const embeddings = await getEmbeddingInstance();
    const vectorStore = new FaissStore(embeddings, {});
    const allSplits = await split(pdfPath);
    await vectorStore.addDocuments(allSplits);
    return vectorStore;
  } catch (error) {
    ztoolkit.log(error);
  }
}
