import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export async function getResponse(question: string): Promise<string> {
  const model = new ChatOpenAI({
    configuration: {
      apiKey: "lm-studio",
      baseURL: "http://127.0.0.1:1234/v1/",
      fetch: ztoolkit.getGlobal('fetch'),
    },
    model: "qwen2.5-7b-instruct-1m",
    streaming: false,
  });
  ztoolkit.log(`[llm.ts] Attempting to invoke model. Question: "${question}"`);

  const messages = [
    new SystemMessage("You are a helpful assistant."),
    new HumanMessage(question),
  ];

  try {
    const response = await model.invoke(messages);
    ztoolkit.log(`[llm.ts] Raw response object: ${JSON.stringify(response)}`);
    // console.log(`[llm.ts] Raw response object: ${JSON.stringify(response, null, 2)}`);

    if (response && response.content) {
      ztoolkit.log(`[llm.ts] Response content: ${response.content.toString()}`);
      return response.content.toString();
    } else {
      ztoolkit.log(
        `[llm.ts] Error: Response content is missing or invalid. Response: ${JSON.stringify(response)}`,
      );
      // console.error(`[llm.ts] Error: Response content is missing or invalid. Response: ${JSON.stringify(response)}`);
      return "Error: Response content missing from LLM.";
    }
  } catch (error) {
    ztoolkit.log(`[llm.ts] Error during model.invoke. Type: ${typeof error}`);
    // console.error(`[llm.ts] Error during model.invoke. Type: ${typeof error}`);

    if (error === undefined) {
      ztoolkit.log(
        "[llm.ts] The caught error is literally 'undefined'. This is highly unusual.",
      );
      // console.error("[llm.ts] The caught error is literally 'undefined'. This is highly unusual.");
    } else if (error instanceof Error) {
      ztoolkit.log(
        `[llm.ts] Error message: ${error.message}. Stack: ${error.stack}`,
      );
      // console.error(`[llm.ts] Error message: ${error.message}. Stack: ${error.stack}`);
    } else {
      ztoolkit.log(
        `[llm.ts] Caught non-Error object: ${JSON.stringify(error)}`,
      );
      // console.error(`[llm.ts] Caught non-Error object: ${JSON.stringify(error)}`);
    }
    // 에러를 다시 throw하여 hooks.ts에서 잡도록 하거나, 여기서 기본 에러 메시지를 반환할 수 있습니다.
    // throw error; // 이렇게 하면 hooks.ts의 catch에서 잡힙니다.
    return `Error: LLM invocation failed in llm.ts. Details: ${JSON.stringify(error)}`;
  }
}
