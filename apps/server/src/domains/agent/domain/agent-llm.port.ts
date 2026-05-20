import type { Observable } from "rxjs";
import type { AgentSSEEvent, LLMMessage } from "./agent.types";

/**
 * LLM 백엔드 추상화 Port.
 * "메시지를 넣으면 AgentSSEEvent 스트림이 나온다."
 */
export abstract class AgentLLMPort {
  abstract chat(params: {
    systemPrompt: string;
    messages: ReadonlyArray<LLMMessage>;
    context: { sessionKey: string };
  }): Observable<AgentSSEEvent>;
}
