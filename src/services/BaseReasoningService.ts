export interface CustomPrompts {
  agent?: string;
  regular?: string;
}

export interface ReasoningConfig {
  maxTokens?: number;
  temperature?: number;
  contextSize?: number;
  customPrompts?: CustomPrompts;
}

export abstract class BaseReasoningService {
  protected isProcessing = false;

  /**
   * Get reasoning prompt
   */
  protected getReasoningPrompt(
    text: string,
    agentName: string | null,
    config: ReasoningConfig = {}
  ): string {
    const DEFAULT_AGENT_PROMPT = `You are {{agentName}}, a helpful AI assistant. Clean up the following dictated text by fixing grammar, punctuation, and formatting. Remove any reference to your name. Output ONLY the cleaned text without explanations or options:\n\n{{text}}`;
    const DEFAULT_REGULAR_PROMPT = `Clean up the following dictated text by fixing grammar, punctuation, and formatting. Output ONLY the cleaned text without any explanations, options, or commentary:\n\n{{text}}`;

    let agentPrompt = DEFAULT_AGENT_PROMPT;
    let regularPrompt = DEFAULT_REGULAR_PROMPT;

    // Priority 1: customPrompts passed explicitly in config (works in main process too)
    if (config.customPrompts) {
      agentPrompt = config.customPrompts.agent || DEFAULT_AGENT_PROMPT;
      regularPrompt = config.customPrompts.regular || DEFAULT_REGULAR_PROMPT;
    } else if (typeof window !== "undefined" && window.localStorage) {
      // Priority 2: localStorage (renderer process only)
      const stored = window.localStorage.getItem("customPrompts");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          agentPrompt = parsed.agent || DEFAULT_AGENT_PROMPT;
          regularPrompt = parsed.regular || DEFAULT_REGULAR_PROMPT;
        } catch (error) {
          console.error("Failed to parse custom prompts:", error);
        }
      }
    }

    // Simple prompt construction
    if (agentName && text.toLowerCase().includes(agentName.toLowerCase())) {
      // Agent-based prompt - replace placeholders
      return agentPrompt.replace(/\{\{agentName\}\}/g, agentName).replace(/\{\{text\}\}/g, text);
    }

    // Regular prompt - replace placeholders
    return regularPrompt.replace(/\{\{text\}\}/g, text);
  }

  /**
   * Calculate optimal max tokens based on input length
   */
  protected calculateMaxTokens(
    textLength: number,
    minTokens = 100,
    maxTokens = 2048,
    multiplier = 2
  ): number {
    return Math.max(minTokens, Math.min(textLength * multiplier, maxTokens));
  }

  /**
   * Check if service is available
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Process text with reasoning
   */
  abstract processText(
    text: string,
    modelId: string,
    agentName?: string | null,
    config?: ReasoningConfig
  ): Promise<string>;
}
