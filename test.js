import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";


const model = new ChatOpenAI({ 
    configuration: {
        baseURL: "http://localhost:1234/v1", // LM Studio의 API 엔드포인트
      },
    apiKey: "lm-studio",
    model: "qwen2.5-7b-instruct-1m" ,
});


const messages = [
  new SystemMessage("Translate the following from English into Korean"),
  new HumanMessage("Hello!"),
];

const response = await model.invoke(messages);
console.log(response);