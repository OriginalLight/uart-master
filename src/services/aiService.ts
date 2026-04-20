import axios from 'axios';
import { GoogleGenAI } from "@google/genai";

export type AIProvider = 'gemini' | 'openai' | 'minimax' | 'glm' | 'custom';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-3-flash-preview',
  openai: 'gpt-4o',
  minimax: 'abab6.5s-chat',
  glm: 'glm-4',
  custom: ''
};

const DEFAULT_URLS: Record<AIProvider, string> = {
  gemini: '',
  openai: 'https://api.openai.com/v1',
  minimax: 'https://api.minimax.chat/v1',
  glm: 'https://open.bigmodel.cn/api/paas/v4',
  custom: ''
};

async function callOpenAICompatible(config: AIConfig, prompt: string, logs: string, isJson = false) {
  const url = `${config.baseUrl || DEFAULT_URLS[config.provider]}/chat/completions`;
  const model = config.model || DEFAULT_MODELS[config.provider];
  
  const response = await axios.post(url, {
    model,
    messages: [
      { role: 'user', content: `${prompt}\n\nLogs/Context:\n${logs}${isJson ? '\n\nReturn ONLY a JSON array.' : ''}` }
    ],
    response_format: isJson ? { type: "json_object" } : undefined
  }, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data.choices[0].message.content;
}

export async function analyzeSerialLogs(logs: string, prompt: string, config: AIConfig) {
  if (!config.apiKey) return "API Key not configured.";
  
  try {
    if (config.provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      const response = await ai.models.generateContent({
        model: config.model || DEFAULT_MODELS.gemini,
        contents: `${prompt}\n\nLogs:\n${logs}\n\nFormat your response in Markdown.`,
      });
      return response.text;
    }

    return await callOpenAICompatible(config, prompt, logs);
  } catch (error) {
    console.error("AI analysis error:", error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function suggestCommands(context: string, prompt: string, config: AIConfig) {
  if (!config.apiKey) return [];
  
  try {
    if (config.provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      const response = await ai.models.generateContent({
        model: config.model || DEFAULT_MODELS.gemini,
        contents: `${prompt}\n\nContext:\n${context}`,
        config: {
          responseMimeType: "application/json",
        }
      });
      return JSON.parse(response.text || "[]") as string[];
    }

    const content = await callOpenAICompatible(config, prompt, context, true);
    const parsed = JSON.parse(content);
    // Handle different JSON structures (some models return { suggestions: [...] })
    if (Array.isArray(parsed)) return parsed;
    if (parsed.suggestions && Array.isArray(parsed.suggestions)) return parsed.suggestions;
    if (parsed.commands && Array.isArray(parsed.commands)) return parsed.commands;
    return [];
  } catch (error) {
    console.error("AI suggestion error:", error);
    return [];
  }
}
