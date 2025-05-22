import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getPref } from "../../utils/prefs";
import { config } from "../../../package.json";

let model: BaseChatModel | null = null;
let _currentApiKey: string | null = null;
let _currentBaseURL: string | null = null;
let _currentModelName: string | null = null;
let _currentModelTemperature: number | null = null;

/**
 * 현재 LLM 인스턴스를 리셋합니다.
 * 관련 환경설정이 변경되었을 때 이 함수를 호출해야 합니다.
 */
export function resetLLMInstance(): void {
  ztoolkit.log(
    "[llm.ts] 환경설정 변경 또는 명시적 호출로 인해 LLM 인스턴스를 리셋합니다.",
  );
  model = null;
  _currentApiKey = null;
  _currentBaseURL = null;
  _currentModelName = null;
  _currentModelTemperature = null;
}

async function getModelInstance(): Promise<BaseChatModel> { // 반환 타입을 Promise<ChatOpenAI>로 변경
  const apiKey = getPref("llmApiKey");
  const baseURL = getPref("llmBaseUrl");
  const modelName = getPref("llmModelName");
  const prefTemperature = getPref("llmTemperature"); // getPref는 string | number | boolean 등을 반환할 수 있음

  // temperature 값 처리: number 타입이어야 함
  let temperature: number | undefined;
  if (typeof prefTemperature === 'number') {
    temperature = prefTemperature;
  } else if (typeof prefTemperature === 'string') {
    const parsedTemp = parseFloat(prefTemperature);
    if (!isNaN(parsedTemp)) {
      temperature = parsedTemp;
    }
  }
  // temperature가 유효한 숫자가 아니면 undefined로 남음

  // 설정이 변경되었거나 인스턴스가 없다면 새로 생성
  if (
    !model ||
    _currentApiKey !== apiKey ||
    _currentBaseURL !== baseURL ||
    _currentModelName !== modelName ||
    _currentModelTemperature !== temperature // temperature 비교 추가
  ) {
    ztoolkit.log(
      "[llm.ts] LLM 인스턴스가 없거나 설정이 변경되어 초기화를 시도합니다.",
    );

    if (!apiKey || !baseURL || !modelName || typeof temperature === 'undefined') {
      const missingSettings = [
        !apiKey ? "API Key" : null,
        !baseURL ? "Base URL" : null,
        !modelName ? "Model Name" : null,
        typeof temperature === 'undefined' ? "Temperature (must be a valid number)" : null,
      ]
        .filter(Boolean)
        .join(", ");
      const errorMessage = `[llm.ts] LLM 설정이 완전하지 않습니다. 누락된 항목: ${missingSettings}. 모델을 초기화할 수 없습니다.`;
      ztoolkit.log(errorMessage);
      // null을 반환하는 대신 에러를 발생시킵니다.
      throw new Error(errorMessage);
    }

    ztoolkit.log("[llm.ts] 현재 설정으로 새 LLM 인스턴스를 초기화합니다.");
    try {
      model = new ChatOpenAI({
        configuration: {
          apiKey: apiKey,
          baseURL: baseURL,
          fetch: ztoolkit.getGlobal("fetch"), //
        },
        temperature: temperature, // number 타입의 temperature 사용
        model: modelName,
      });
      // 현재 인스턴스에 사용된 설정을 저장
      _currentApiKey = apiKey;
      _currentBaseURL = baseURL;
      _currentModelName = modelName;
      _currentModelTemperature = temperature; // 저장 시점은 성공 후
      ztoolkit.log(
        `[llm.ts] LLM 인스턴스가 성공적으로 생성되었습니다. 모델: ${modelName}, Base URL: ${baseURL}, Temperature: ${temperature}`,
      );
    } catch (error) {
      const errorMessage = `[llm.ts] LLM 인스턴스 생성 중 오류 발생: ${error instanceof Error ? error.message : JSON.stringify(error)}`;
      ztoolkit.log(errorMessage);
      model = null; // 실패 시 인스턴스 null 처리
      // null을 반환하는 대신 에러를 발생시킵니다.
      throw new Error(errorMessage);
    }
  } else {
    ztoolkit.log("[llm.ts] 기존 LLM 인스턴스를 사용합니다.");
  }

  // 이 지점에 도달했다면 model은 null이 아니어야 합니다.
  if (!model) {
    // 이 경우는 로직상 발생하면 안 되는 상황입니다 (예: 설정 누락으로 throw 했어야 함).
    const criticalError =
      "[llm.ts] LLM 인스턴스가 초기화되지 않았습니다. 로직 오류이거나 예기치 않은 경로입니다.";
    ztoolkit.log(criticalError);
    throw new Error(criticalError);
  }

  return model;
}

export async function getResponse(
  system_prompt: string,
  question: string,
): Promise<string> {
  const model = await getModelInstance();

  if (!model) {
    const errorMessage =
      "LLM이 설정되지 않았거나 초기화에 실패했습니다. 환경설정을 확인하고 올바른지 확인해주세요.";
    ztoolkit.log(`[llm.ts] ${errorMessage}`);
    return `Error: ${errorMessage}`;
  }

  const messages = [
    new SystemMessage(system_prompt),
    new HumanMessage(question),
  ];

  try {
    const response = await model.invoke(messages);
    if (response && response.content) {
      ztoolkit.log(`[llm.ts] Response content: ${response.content.toString()}`);
      return response.content.toString();
    } else {
      ztoolkit.log(
        `[llm.ts] Error: Response content is missing or invalid. Response: ${JSON.stringify(response)}`,
      );
      return "Error: Response content missing from LLM.";
    }
  } catch (error) {
    ztoolkit.log(`[llm.ts] Error during model.invoke. Type: ${typeof error}`);

    if (error === undefined) {
      ztoolkit.log(
        "[llm.ts] The caught error is literally 'undefined'. This is highly unusual.",
      );
    } else if (error instanceof Error) {
      ztoolkit.log(
        `[llm.ts] Error message: ${error.message}. Stack: ${error.stack}`,
      );
    } else {
      ztoolkit.log(
        `[llm.ts] Caught non-Error object: ${JSON.stringify(error)}`,
      );
    }
    return `Error: LLM invocation failed in llm.ts. Details: ${JSON.stringify(error)}`;
  }
}
