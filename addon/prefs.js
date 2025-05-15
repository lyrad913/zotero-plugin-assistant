/* eslint-disable no-undef */
pref("enableEmbedding", false);
pref("isMultimodal", false);


// LLM 설정 기본값
pref("llmApiKey", ""); // 또는 "N/A" 등
pref("llmBaseUrl", "");
pref("llmModelName", "");
pref("llmTemperature", 0);

// 임베딩 모델 설정 기본값 (LLM과 동일하게 시작하거나, 사용자가 수정하도록 유도)
pref("embeddingApiKey", ""); // 또는 "N/A"
pref("embeddingBaseUrl", ""); // LM Studio의 임베딩 엔드포인트 (LLM과 다를 수 있음)
pref("embeddingModelName", ""); // 예: 'nomic-embed-text-v1.5' 등

// // RAG 설정 기본값
// pref("ragChunkSize", 0);
// pref("ragChunkOverlap", 0);
