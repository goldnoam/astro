
import { GoogleGenAI, Type } from "@google/genai";
import { GalaxyInfo } from '../types';

const getApiKey = () => {
  const key = process.env.API_KEY;
  if (!key) {
    // In a real app, you'd want to handle this more gracefully.
    // For this environment, we assume it's always available.
    throw new Error("API_KEY environment variable not set");
  }
  return key;
};

export const generateGalaxyInfo = async (): Promise<GalaxyInfo> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Generate a cool, sci-fi name for a distant galaxy and a one-sentence fictional, awe-inspiring description for it. The name should be unique and sound epic.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "The unique and epic name of the galaxy.",
            },
            description: {
              type: Type.STRING,
              description: "A one-sentence, awe-inspiring fictional description of the galaxy.",
            },
          },
          required: ["name", "description"],
        },
      },
    });

    const jsonText = response.text.trim();
    const parsed = JSON.parse(jsonText);
    
    if (parsed.name && parsed.description) {
        return parsed as GalaxyInfo;
    } else {
        throw new Error("Invalid response structure from Gemini API");
    }

  } catch (error) {
    console.error("Error generating galaxy info:", error);
    // Return a fallback galaxy info on error
    return {
      name: "Andromeda Anomaly",
      description: "A familiar galaxy, twisted by an unknown cosmic event."
    };
  }
};
