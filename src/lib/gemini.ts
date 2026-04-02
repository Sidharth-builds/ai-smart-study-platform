import { GoogleGenerativeAI } from "@google/generative-ai";

type StudyContent = {
  summary: string;
  bulletPoints: string[];
  keyConcepts: string[];
};

type Flashcard = {
  front: string;
  back: string;
};

type PreviousPaperAnalysis = {
  questions: string[];
  topics: { name: string; frequency: string }[];
  insights: string;
};

type YouTubeSummary = {
  summary: string;
  keyPoints: string[];
  timestamps: { time: string; topic: string }[];
  examTopics: string[];
};

type PredictedQuestion = {
  text: string;
  probability: number;
  reason: string;
};

type TopicInput = {
  name: string;
  score: number;
};

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const FALLBACK_MODEL = "gemini-pro-latest";

export const getAI = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing API Key");
  }

  return new GoogleGenerativeAI(apiKey);
};

const cleanJsonText = (text: string) => text.replace(/```json\s*|```/gi, "").trim();

const parseJsonResponse = <T>(text: string): T => {
  const cleanedText = cleanJsonText(text);

  try {
    return JSON.parse(cleanedText) as T;
  } catch (error) {
    console.error("Failed to parse Gemini JSON response:", error, cleanedText);
    throw new Error("Gemini returned an invalid JSON response.");
  }
};

const generateWithModel = async <T>(modelName: string, prompt: string): Promise<T> => {
  try {
    const genAI = getAI();
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    console.log(`Gemini raw response (${modelName}):`, text);

    if (!text) {
      throw new Error(`Gemini returned an empty response for model "${modelName}".`);
    }

    return parseJsonResponse<T>(text);
  } catch (error) {
    console.error(`Gemini API error with model "${modelName}":`, error);
    throw error;
  }
};

const generateJson = async <T>(prompt: string): Promise<T> => {
  try {
    return await generateWithModel<T>(GEMINI_MODEL, prompt);
  } catch (primaryError) {
    console.error(`Primary Gemini model "${GEMINI_MODEL}" failed. Trying fallback "${FALLBACK_MODEL}".`, primaryError);
    try {
      return await generateWithModel<T>(FALLBACK_MODEL, prompt);
    } catch (fallbackError) {
      console.error(`Fallback Gemini model "${FALLBACK_MODEL}" also failed.`, fallbackError);
      throw fallbackError;
    }
  }
};

export const generateStudyContent = async (text: string): Promise<StudyContent> => {
  try {
    return await generateJson<StudyContent>(`
Analyze the following study material and respond with valid JSON only.

Return this exact shape:
{
  "summary": "string",
  "bulletPoints": ["string"],
  "keyConcepts": ["string"]
}

Text:
${text}
`);
  } catch (error) {
    console.error("Gemini Summarizer Error:", error);
    throw error;
  }
};

export const generateFlashcards = async (text: string): Promise<Flashcard[]> => {
  try {
    const flashcards = await generateJson<Flashcard[]>(`
Generate 5 to 10 study flashcards from the text below.
Respond with valid JSON only.
Do not include markdown fences.
Return an array in this exact format:
[
  { "front": "question", "back": "answer" }
]

Text:
${text}
`);

    if (!Array.isArray(flashcards)) {
      throw new Error("Gemini flashcard response was not an array.");
    }

    return flashcards.filter(
      (card): card is Flashcard =>
        typeof card?.front === "string" && typeof card?.back === "string",
    );
  } catch (error) {
    console.error("Gemini Flashcard Error:", error);
    throw error;
  }
};

export const analyzePreviousPaper = async (
  text: string,
): Promise<PreviousPaperAnalysis> => {
  try {
    return await generateJson<PreviousPaperAnalysis>(`
Analyze this previous year exam paper and respond with valid JSON only.

Return this exact shape:
{
  "questions": ["string"],
  "topics": [{ "name": "string", "frequency": "string" }],
  "insights": "string"
}

Paper Content:
${text}
`);
  } catch (error) {
    console.error("Gemini Paper Analysis Error:", error);
    throw error;
  }
};

export const summarizeYouTubeVideo = async (
  videoUrl: string,
): Promise<YouTubeSummary> => {
  try {
    return await generateJson<YouTubeSummary>(`
Analyze the educational YouTube video at this URL and respond with valid JSON only:
${videoUrl}

Return this exact shape:
{
  "summary": "string",
  "keyPoints": ["string"],
  "timestamps": [{ "time": "string", "topic": "string" }],
  "examTopics": ["string"]
}
`);
  } catch (error) {
    console.error("Gemini YouTube Error:", error);
    throw error;
  }
};

export const predictExamQuestions = async (
  subject: string,
  topics: TopicInput[],
): Promise<{ questions: PredictedQuestion[] }> => {
  try {
    const topicsList = topics
      .map((topic) => `${topic.name} (Importance Score: ${topic.score})`)
      .join(", ");

    return await generateJson<{ questions: PredictedQuestion[] }>(`
As an expert examiner for "${subject}", analyze these prioritized topics:
${topicsList}

Respond with valid JSON only in this exact shape:
{
  "questions": [
    { "text": "string", "probability": 0, "reason": "string" }
  ]
}
`);
  } catch (error) {
    console.error("Gemini Prediction Error:", error);
    throw error;
  }
};
