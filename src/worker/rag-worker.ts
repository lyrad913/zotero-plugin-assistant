// import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import * as pdfjsLib from 'resource://zotero/reader/pdf/build/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'resource://zotero/reader/pdf/build/pdf.worker.mjs';
export { pdfjsLib };

console.log('[rag-worker.ts] 워커 스크립트 파일 로드됨.'); // 워커 파일 자체가 로드되는지 확인

self.onmessage = async(event) => {
  try {
    console.log(`[rag-worker.ts] 메세지 수신`)
    console.log(event.data);
    const pdfBlob = event.data.pdfBlob; // 메인 스레드에서 받은 pdf blob

    console.log(`[rag-worker.ts] Docs`);
    const docs = await load(pdfBlob);
    console.log(docs);
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const allSplits = await textSplitter.splitDocuments(docs);

    console.log(`[rag-worker.ts] All Spilts`);
    console.log(allSplits);

    self.postMessage({ type: "SUCCESS", allSplits: allSplits })
  } catch(error){
    self.postMessage({type: "SHIT", error:error});
  }
}

/**
 * Loads the contents of the PDF as documents.
 * @returns An array of Documents representing the retrieved data.
 */
async function load(blob:Blob, splitPages:boolean = true, parsedItemSeparator: string = ""): Promise<Document[]> {
  const parsedPdf = await pdfjsLib.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const meta = await parsedPdf.getMetadata().catch(() => null);

  const documents: Document[] = [];

  for (let i = 1; i <= parsedPdf.numPages; i += 1) {
    const page = await parsedPdf.getPage(i);
    const content = await page.getTextContent();

    if (content.items.length === 0) {
      continue;
    }

    // Eliminate excessive newlines
    // Source: https://github.com/albertcui/pdf-parse/blob/7086fc1cc9058545cdf41dd0646d6ae5832c7107/lib/pdf-parse.js#L16
    let lastY;
    const textItems = [];
    for (const item of content.items) {
      if ("str" in item) {
        if (lastY === item.transform[5] || !lastY) {
          textItems.push(item.str);
        } else {
          textItems.push(`\n${item.str}`);
        }
        // eslint-disable-next-line prefer-destructuring
        lastY = item.transform[5];
      }
    }
    const text = textItems.join(parsedItemSeparator);

    documents.push(
      new Document({
        pageContent: text,
        metadata: {
          pdf: {
            version: pdfjsLib.version,
            info: meta?.info,
            metadata: meta?.metadata,
            totalPages: parsedPdf.numPages,
          },
          loc: {
            pageNumber: i,
          },
        },
      })
    );
  }

  if (splitPages) {
    return documents;
  }

  if (documents.length === 0) {
    return [];
  }

  return [
    new Document({
      pageContent: documents.map((doc) => doc.pageContent).join("\n\n"),
      metadata: {
        pdf: {
          version:pdfjsLib.version,
          info: meta?.info,
          metadata: meta?.metadata,
          totalPages: parsedPdf.numPages,
        },
      },
    }),
  ];
}
