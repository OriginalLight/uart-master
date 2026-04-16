import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export const isGeminiConfigured = apiKey.length > 0;

export async function analyzeSerialLogs(logs: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert embedded systems engineer. Analyze the following serial port logs and identify any issues, errors, or patterns. Suggest potential solutions or next steps.
      
      Logs:
      ${logs}
      
      Format your response in Markdown.`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return "Analysis failed. Please check your API key and network connection.";
  }
}

export async function suggestCommands(context: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on the following context of a serial communication session, suggest 3-5 useful commands that the user might want to send next.
      
      Context:
      ${context}
      
      Return only a JSON array of strings, e.g., ["AT+GMR", "help", "status"].`,
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
