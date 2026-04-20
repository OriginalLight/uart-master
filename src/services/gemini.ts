import { GoogleGenAI } from "@google/genai";

export async function analyzeSerialLogs(logs: string, prompt: string, apiKey: string) {
  if (!apiKey) return "API Key not configured. Please set it in Settings.";
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `${prompt}
      
      Logs:
      ${logs}
      
      Format your response in Markdown.`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return null;
  }
}

export async function suggestCommands(context: string, prompt: string, apiKey: string) {
  if (!apiKey) return [];
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `${prompt}
      
      Context:
      ${context}`,
      config: {
        responseMimeType: "application/json",
      }
    });
    return JSON.parse(response.text || "[]") as string[];
  } catch (error) {
    console.error("Gemini suggestion error:", error);
    return [];
  }
}
