import axios from 'axios';

export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

async function callOpenAICompatible(config: AIConfig, prompt: string, logs: string, isJson = false) {
  let baseUrl = config.baseUrl;
  if (!baseUrl) throw new Error('API Base URL is required');
  
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  const url = baseUrl.includes('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
  const model = config.model;
  
  if (!model) {
    throw new Error('Model name is required');
  }

  const response = await axios.post(url, {
    model,
    messages: [
      { role: 'system', content: 'You are an embedded systems expert. Keep your analysis concise, strictly under 150-200 words.' },
      { role: 'user', content: `${prompt}\n\nLogs/Context:\n${logs}${isJson ? '\n\nReturn ONLY a JSON array of strings.' : ''}` }
    ],
    response_format: isJson ? { type: "json_object" } : undefined
  }, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000 
  });

  if (!response.data || !response.data.choices || !response.data.choices[0]) {
    throw new Error(response.data?.error?.message || 'Invalid API response format');
  }

  return response.data.choices[0].message.content;
}

export async function analyzeSerialLogs(logs: string, prompt: string, config: AIConfig) {
  if (!config.apiKey || !config.baseUrl || !config.model) return "AI Configuration incomplete. Please check settings.";
  
  try {
    return await callOpenAICompatible(config, prompt, logs);
  } catch (error) {
    console.error("AI analysis error:", error);
    throw error;
  }
}

export async function suggestCommands(context: string, prompt: string, config: AIConfig) {
  if (!config.apiKey || !config.baseUrl || !config.model) return [];
  
  try {
    const content = await callOpenAICompatible(config, prompt, context, true);
    let cleanContent = content.trim();
    
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```(?:json)?\n?|```$/g, '').trim();
    }
    
    const parsed = JSON.parse(cleanContent);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.suggestions && Array.isArray(parsed.suggestions)) return parsed.suggestions;
    if (parsed.commands && Array.isArray(parsed.commands)) return parsed.commands;
    return [];
  } catch (error) {
    console.error("AI suggestion error:", error);
    return [];
  }
}
