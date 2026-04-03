import { GoogleGenerativeAI } from "@google/generative-ai";

type StudyContent = {
  summary: string;
  bulletPoints: string[];
  keyConcepts: string[];
};

export type SummaryMode = "normal" | "points" | "exam" | "detailed" | "smart";

type Flashcard = {
  front: string;
  back: string;
};

type GeneratedFlashcard = {
  question: string;
  answer: string;
};

type PreviousPaperAnalysis = {
  important_topics: { name: string; frequency: number; importance: "High" | "Medium" | "Low" }[];
  recurring_concepts: string[];
  predicted_questions: {
    short: string[];
    long: string[];
    conceptual: string[];
  };
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

const cleanText = (text: string): string => {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
};

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

const getSummaryPrompt = (text: string, mode: SummaryMode): string => {
  switch (mode) {
    case "points":
      return `Summarize the following into clear bullet points and respond with valid JSON only.

Return this exact shape:
{
  "summary": "string",
  "bulletPoints": ["string"],
  "keyConcepts": ["string"]
}

Text:
${text}`;
    case "exam":
      return `Convert the following content into exam-ready notes with important points and definitions, and respond with valid JSON only.

Return this exact shape:
{
  "summary": "string",
  "bulletPoints": ["string"],
  "keyConcepts": ["string"]
}

Text:
${text}`;
    case "detailed":
      return `Explain the following content in a detailed and easy-to-understand way, and respond with valid JSON only.

Return this exact shape:
{
  "summary": "string",
  "bulletPoints": ["string"],
  "keyConcepts": ["string"]
}

Text:
${text}`;
    default:
      return `Provide a clear and concise summary of the following and respond with valid JSON only.

Return this exact shape:
{
  "summary": "string",
  "bulletPoints": ["string"],
  "keyConcepts": ["string"]
}

Text:
${text}`;
  }
};

export const generateStudyContent = async (
  text: string,
  mode: SummaryMode = "normal",
): Promise<StudyContent> => {
  try {
    return await generateJson<StudyContent>(getSummaryPrompt(text, mode));
  } catch (error) {
    console.error("Gemini Summarizer Error:", error);
    throw error;
  }
};

export const generateFlashcards = async (text: string): Promise<Flashcard[]> => {
  try {
    const input = cleanText(text).slice(0, 5000);

    if (!input) {
      throw new Error("Unable to extract meaningful content");
    }

    const concepts = await generateJson<string[]>(`
From the following study material, extract the most important concepts, definitions, and key topics.

Rules:
- Ignore metadata, formatting, and noise
- Focus only on meaningful academic content
- Return a list of key points

Return JSON:
[
  "concept 1",
  "concept 2",
  "concept 3"
]

Study material:
${input}
`);

    if (!Array.isArray(concepts)) {
      throw new Error("Gemini concept extraction response was not an array.");
    }

    const filteredConcepts = concepts.filter(
      (concept): concept is string => typeof concept === "string" && concept.trim().length > 0,
    );

    if (filteredConcepts.length === 0) {
      throw new Error("Unable to extract meaningful content");
    }

    const flashcards = await generateJson<GeneratedFlashcard[]>(`
Generate exam-style flashcards from these concepts.

Rules:
- Questions must be clear and meaningful
- Focus on definitions and explanations
- Avoid trivial or irrelevant questions

Return JSON:
[
  { "question": "...", "answer": "..." }
]

Concepts:
${filteredConcepts.map((concept, index) => `${index + 1}. ${concept}`).join("\n")}
`);

    if (!Array.isArray(flashcards)) {
      throw new Error("Gemini flashcard response was not an array.");
    }

    return flashcards
      .filter(
        (card): card is GeneratedFlashcard =>
          typeof card?.question === "string" && card.question.trim().length > 0 &&
          typeof card?.answer === "string" && card.answer.trim().length > 0,
      )
      .map((card) => ({
        front: card.question.trim(),
        back: card.answer.trim(),
      }));
  } catch (error) {
    console.error("Gemini Flashcard Error:", error);
    throw error;
  }
};

export const analyzePreviousPaper = async (
  text: string,
  pyqs = "",
): Promise<PreviousPaperAnalysis> => {
  try {
    const content = text.slice(0, 4000);
    const pyqContent = pyqs ? pyqs.slice(0, 1000) : "";

    return await generateJson<PreviousPaperAnalysis>(`
You are an expert AI system that analyzes multiple previous year question papers and predicts future exam questions.

You will be given combined text from multiple exam papers.

Your tasks:

1. Identify important topics:
- Extract key topics from all questions
- Group similar questions under one topic

2. Detect recurring questions:
- Find questions or concepts repeated across papers
- Highlight them as HIGH importance

3. Analyze patterns:
- Identify common question types:
  (e.g., explain, define, compare, applications)

4. Predict exam questions:
- Generate:
  • 5 short answer questions
  • 3 long answer questions
  • 2 conceptual questions
- Questions must be realistic and exam-oriented

5. STRICT OUTPUT FORMAT (JSON ONLY):

{
  "important_topics": [
    { "name": "Decision Trees", "frequency": 3, "importance": "High" }
  ],
  "recurring_concepts": [
    "Decision Trees are repeatedly asked in multiple years"
  ],
  "predicted_questions": {
    "short": [
      "Define Decision Tree"
    ],
    "long": [
      "Explain Decision Tree algorithm with example"
    ],
    "conceptual": [
      "Compare Decision Trees with other classification models"
    ]
  }
}

Important:
- Do NOT add extra text
- Do NOT explain anything
- Only return valid JSON

Study Material:
${content}

Previous Year Questions:
${pyqContent}
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
