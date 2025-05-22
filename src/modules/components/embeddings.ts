import { OllamaEmbeddings } from "@langchain/ollama";
import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { getPref } from "../../utils/prefs";
import { config } from "../../../package.json";

let embeddings: Embeddings | null = null;
let _currentApiKey: string | null = null;
let _currentBaseURL: string | null = null;
let _currentModelName: string | null = null;

export function resetEmbeddingInstance(): void {
  ztoolkit.log(
    "[llm.ts] 환경설정 변경 또는 명시적 호출로 인해 LLM 인스턴스를 리셋합니다.",
  );
  embeddings = null;
  _currentApiKey = null;
  _currentBaseURL = null;
  _currentModelName = null;
}

export async function getModelInstance(): Promise<Embeddings | null> {
  if (embeddings) {
    // 이미 인스턴스가 존재하면 반환
    return embeddings;
  }

  ztoolkit.log("[llm.ts] LLM 인스턴스가 null입니다. 초기화를 시도합니다.");
  const apiKey = getPref("embeddingApiKey"); // TODO: 외않대???
  ztoolkit.log(`[llm.ts]: Watch the path ${config.prefsPrefix}`);
  ztoolkit.log(`[llm.ts]: TEST getPref apiKey ${apiKey}`);
  const baseURL = getPref("embeddingBaseUrl");
  const modelName = getPref("embeddingModelName");

  if (!apiKey || !baseURL || !modelName) {
    const missingSettings = [
      !apiKey ? "API Key" : null,
      !baseURL ? "Base URL" : null,
      !modelName ? "Model Name" : null,
    ]
      .filter(Boolean)
      .join(", "); // 누락된 설정 항목들을 나열
    ztoolkit.log(
      `[llm.ts] LLM 설정이 완전하지 않습니다. 누락된 항목: ${missingSettings}. 모델을 초기화할 수 없습니다.`,
    );
    return null;
  }
  ztoolkit.log("[llm.ts] 현재 설정으로 새 LLM 인스턴스를 초기화합니다.");
  try {
    embeddings = new OllamaEmbeddings({
      baseUrl: baseURL,
      model: modelName,
    });
    // 현재 인스턴스에 사용된 설정을 저장
    _currentApiKey = apiKey;
    _currentBaseURL = baseURL;
    _currentModelName = modelName;
    ztoolkit.log(
      `[llm.ts] LLM 인스턴스가 성공적으로 생성되었습니다. 모델: ${modelName}, Base URL: ${baseURL}`,
    );
  } catch (error) {
    ztoolkit.log(
      `[llm.ts] LLM 인스턴스 생성 중 오류 발생: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
    );
    embeddings = null;
    return null;
  }
  return embeddings;
}
