import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getPref } from "../../utils/prefs";
import { config } from "../../../package.json";

let model: ChatOpenAI | null = null;
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

async function getModelInstance(): Promise<ChatOpenAI | null> {
  if (model) {
    // 이미 인스턴스가 존재하면 반환
    return model;
  }

  ztoolkit.log("[llm.ts] LLM 인스턴스가 null입니다. 초기화를 시도합니다.");
  const apiKey = getPref('llmApiKey'); // TODO: 외않대???
  ztoolkit.log(`[llm.ts]: Watch the path ${config.prefsPrefix}`);
  ztoolkit.log(`[llm.ts]: TEST getPref apiKey ${apiKey}`);
  const baseURL = getPref("llmBaseUrl");
  const modelName = getPref("llmModelName");
  const temperature = getPref("llmTemperature");

  if (!apiKey || !baseURL || !modelName || !temperature) {
    const missingSettings = [
      !apiKey ? "API Key" : null,
      !baseURL ? "Base URL" : null,
      !modelName ? "Model Name" : null,
      !temperature ? "Temperature" : null,
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
    model = new ChatOpenAI({
      configuration: {
        apiKey: apiKey,
        baseURL: baseURL,
        fetch: ztoolkit.getGlobal("fetch"),
      },
      temperature: temperature,
      model: modelName,
    });
    // 현재 인스턴스에 사용된 설정을 저장
    _currentApiKey = apiKey;
    _currentBaseURL = baseURL;
    _currentModelName = modelName;
    _currentModelTemperature = temperature;
    ztoolkit.log(
      `[llm.ts] LLM 인스턴스가 성공적으로 생성되었습니다. 모델: ${modelName}, Base URL: ${baseURL}`,
    );
  } catch (error) {
    ztoolkit.log(
      `[llm.ts] LLM 인스턴스 생성 중 오류 발생: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
    );
    model = null;
    return null;
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
