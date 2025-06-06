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
    "[embeddings.ts] 환경설정 변경 또는 명시적 호출로 인해 embeddings 인스턴스를 리셋합니다.",
  );
  embeddings = null;
  _currentApiKey = null;
  _currentBaseURL = null;
  _currentModelName = null;
}

export async function getEmbeddingInstance(): Promise<Embeddings> {
  // 반환 타입을 Promise<Embeddings>로 변경
  // 현재 저장된 설정과 Zotero 환경설정 값을 비교하여 변경되었는지 확인
  const baseURL = getPref("embeddingBaseUrl");
  const modelName = getPref("embeddingModelName");

  // 설정이 변경되었거나 인스턴스가 없다면 새로 생성
  if (
    !embeddings ||
    _currentBaseURL !== baseURL ||
    _currentModelName !== modelName
  ) {
    ztoolkit.log(
      "[embeddings.ts] Embeddings 인스턴스가 없거나 설정이 변경되어 초기화를 시도합니다.",
    );

    if (!baseURL || !modelName) {
      const missingSettings = [
        !baseURL ? "Base URL" : null,
        !modelName ? "Model Name" : null,
      ]
        .filter(Boolean)
        .join(", ");
      const errorMessage = `[embeddings.ts] Embeddings 설정이 완전하지 않습니다. 누락된 항목: ${missingSettings}. 모델을 초기화할 수 없습니다.`;
      ztoolkit.log(errorMessage);
      // null을 반환하는 대신 에러를 발생시킵니다.
      throw new Error(errorMessage);
    }

    ztoolkit.log(
      "[embeddings.ts] 현재 설정으로 새 Embeddings 인스턴스를 초기화합니다.",
    );
    try {
      embeddings = new OllamaEmbeddings({
        baseUrl: baseURL,
        model: modelName,
      });
      _currentBaseURL = baseURL;
      _currentModelName = modelName;
      ztoolkit.log(
        `[embeddings.ts] Embeddings 인스턴스가 성공적으로 생성되었습니다. 모델: ${modelName}, Base URL: ${baseURL}`,
      );
    } catch (error) {
      const errorMessage = `[embeddings.ts] Embeddings 인스턴스 생성 중 오류 발생: ${error instanceof Error ? error.message : JSON.stringify(error)}`;
      ztoolkit.log(errorMessage);
      embeddings = null; // 실패 시 인스턴스 null 처리
      // null을 반환하는 대신 에러를 발생시킵니다.
      throw new Error(errorMessage);
    }
  } else {
    ztoolkit.log("[embeddings.ts] 기존 Embeddings 인스턴스를 사용합니다.");
  }

  // 이 지점에 도달했다면 embeddings는 null이 아니어야 합니다.
  // 하지만 TypeScript는 여전히 embeddings가 null일 가능성을 인지할 수 있으므로,
  // ! 연산자(non-null assertion operator)를 사용하거나,
  // 코드 로직상 null이 될 수 없음을 명확히 하기 위해 아래와 같이 방어 코드를 추가할 수 있습니다.
  if (!embeddings) {
    // 이 경우는 로직상 발생하면 안 되는 상황입니다.
    const criticalError =
      "[embeddings.ts] Embeddings 인스턴스가 초기화되지 않았습니다. 로직 오류입니다.";
    ztoolkit.log(criticalError);
    throw new Error(criticalError);
  }

  return embeddings;
}
