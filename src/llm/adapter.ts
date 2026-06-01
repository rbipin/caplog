export interface LLMAdapter {
  complete(system: string, user: string): Promise<string>;
}
