import { GoogleGenAI, Type } from "@google/genai";
import { SmartTaskResponse } from "../types";

const apiKey = process.env.API_KEY;

const TASK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "The main task action" },
    time: { type: Type.STRING, description: "Time of the task formatted strictly as 'HH:MM AM/PM' (e.g. 10:00 AM)" },
    location: { type: Type.STRING, description: "Location if specified" },
    tag: { type: Type.STRING, description: "A single word category tag" },
    priority: { type: Type.STRING, enum: ["normal", "high"], description: "Priority level" }
  },
  required: ["title"]
};

export const parseTaskWithGemini = async (text: string): Promise<SmartTaskResponse | null> => {
  if (!apiKey) {
    console.warn("Gemini API key not found. Smart features disabled.");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `System Context: Current time is ${currentTime}.
      
      Instructions:
      1. Parse the task description into a structured JSON object.
      2. If relative time is mentioned (e.g., "in 10 minutes", "later tonight"), calculate the absolute time based on the Current Time provided above.
      3. Format 'time' strictly as 'HH:MM AM/PM' (e.g. '02:30 PM').
      4. If urgent/important, set priority to 'high'.
      5. Infer a short category tag.
      
      Task description: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: TASK_SCHEMA
      }
    });

    if (response.text) {
        return JSON.parse(response.text) as SmartTaskResponse;
    }
    return null;

  } catch (error) {
    console.error("Error parsing task with Gemini:", error);
    return null;
  }
};

export const parseVoiceTaskWithGemini = async (audioBase64: string, mimeType: string): Promise<SmartTaskResponse | null> => {
  if (!apiKey) {
    console.warn("Gemini API key not found. Smart features disabled.");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64
            }
          },
          {
            text: `Context: Current time is ${currentTime}. Listen to this audio. Extract task details. If relative time is used (e.g. 'in 20 mins'), calculate absolute time 'HH:MM AM/PM'. Return JSON.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: TASK_SCHEMA
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as SmartTaskResponse;
    }
    return null;

  } catch (error) {
    console.error("Error parsing voice task with Gemini:", error);
    return null;
  }
};

export const editImageWithGemini = async (base64Image: string, mimeType: string, prompt: string): Promise<string | null> => {
  if (!apiKey) {
    console.warn("Gemini API key not found. Smart features disabled.");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return part.inlineData.data;
            }
        }
    }
    return null;
  } catch (error) {
    console.error("Error editing image with Gemini:", error);
    return null;
  }
};