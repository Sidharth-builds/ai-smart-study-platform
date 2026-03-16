import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

const parseAIResponse = (text: string | undefined) => {
  if (!text) return null;
  try {
    // Remove markdown code blocks if present
    const cleanText = text.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse AI response:", e);
    return null;
  }
};

export const generateStudyContent = async (text: string): Promise<{ summary: string; bulletPoints: string[]; keyConcepts: string[] }> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following study material and provide:
      1. A concise summary.
      2. A list of key bullet points.
      3. A list of core key concepts.
      
      Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            bulletPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyConcepts: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["summary", "bulletPoints", "keyConcepts"]
        }
      }
    });
    
    return parseAIResponse(response.text) || { summary: "", bulletPoints: [], keyConcepts: [] };
  } catch (error) {
    console.error("Gemini Summarizer Error:", error);
    throw error;
  }
};

export const generateFlashcards = async (text: string): Promise<{ front: string; back: string }[]> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate 5-10 effective study flashcards from the following text. Each flashcard should have a 'front' (question/term) and a 'back' (answer/definition).
      
      Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              front: { type: Type.STRING },
              back: { type: Type.STRING }
            },
            required: ["front", "back"]
          }
        }
      }
    });
    
    return parseAIResponse(response.text) || [];
  } catch (error) {
    console.error("Gemini Flashcard Error:", error);
    throw error;
  }
};

export const analyzePreviousPaper = async (text: string): Promise<{ questions: string[]; topics: { name: string; frequency: string }[]; insights: string }> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this previous year exam paper. 
      1. Extract the main questions.
      2. Categorize them by topic and estimate their frequency/importance.
      3. Provide overall insights on the paper's difficulty and focus areas.
      
      Paper Content: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: { type: Type.ARRAY, items: { type: Type.STRING } },
            topics: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  frequency: { type: Type.STRING }
                },
                required: ["name", "frequency"]
              } 
            },
            insights: { type: Type.STRING }
          },
          required: ["questions", "topics", "insights"]
        }
      }
    });
    
    return parseAIResponse(response.text) || { questions: [], topics: [], insights: "" };
  } catch (error) {
    console.error("Gemini Paper Analysis Error:", error);
    throw error;
  }
};

export const summarizeYouTubeVideo = async (videoUrl: string): Promise<{ summary: string; keyPoints: string[]; timestamps: { time: string; topic: string }[]; examTopics: string[] }> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the educational content from this YouTube video: ${videoUrl}. 
      Provide:
      1. A high-level summary.
      2. Key learning points.
      3. Estimated timestamps for major sections.
      4. Specific topics that are highly relevant for exams.`,
      config: {
        tools: [{ urlContext: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            timestamps: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  topic: { type: Type.STRING }
                },
                required: ["time", "topic"]
              } 
            },
            examTopics: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["summary", "keyPoints", "timestamps", "examTopics"]
        }
      }
    });
    
    return parseAIResponse(response.text) || { summary: "", keyPoints: [], timestamps: [], examTopics: [] };
  } catch (error) {
    console.error("Gemini YouTube Error:", error);
    throw error;
  }
};

export const predictExamQuestions = async (subject: string, topics: any[]): Promise<{ questions: { text: string; probability: number; reason: string }[] }> => {
  try {
    const ai = getAI();
    const topicsList = topics.map(t => `${t.name} (Importance Score: ${t.score})`).join(', ');
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `As an expert examiner for the subject "${subject}", analyze these prioritized topics: ${topicsList}. 
      Predict the most likely exam questions. For each question, provide a probability of appearance (0-100) and a brief reasoning based on the topic's importance.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  probability: { type: Type.NUMBER },
                  reason: { type: Type.STRING }
                },
                required: ["text", "probability", "reason"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });
    
    return parseAIResponse(response.text) || { questions: [] };
  } catch (error) {
    console.error("Gemini Prediction Error:", error);
    throw error;
  }
};
