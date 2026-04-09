type NextApiRequest = {
  method?: string;
  body?: {
    text?: unknown;
  };
};

type NextApiResponse<T> = {
  status: (code: number) => {
    json: (body: T) => void;
  };
};

type Topic = { name: string; count: number };
type ResponseBody = {
  topics: Topic[];
  predicted_questions: string[];
};

const STOPWORDS = new Set([
  'the', 'and', 'that', 'with', 'from', 'this', 'were', 'have', 'has', 'had', 'for', 'are', 'was', 'but',
  'not', 'you', 'your', 'into', 'than', 'then', 'they', 'their', 'them', 'what', 'when', 'where', 'which',
  'will', 'would', 'could', 'should', 'there', 'here', 'about', 'such', 'these', 'those', 'also', 'its',
  'can', 'may', 'might', 'been', 'being', 'over', 'under', 'between', 'because', 'while', 'through',
  'explain', 'define', 'describe', 'compare', 'contrast', 'question', 'questions',
]);

const toTitleCase = (text: string) =>
  text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));

const extractTopics = (text: string): Topic[] => {
  const cleaned = text.replace(/[^a-zA-Z0-9\s]/g, ' ').toLowerCase();
  const words = cleaned.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, count]) => ({ name: toTitleCase(name), count }));
};

const buildPredictedQuestions = (topics: Topic[]): string[] => {
  const top = topics.slice(0, 6).map((t) => t.name);
  const questions: string[] = [];

  const templates = [
    (t: string) => `Explain ${t} with examples.`,
    (t: string) => `Define ${t} and discuss its applications.`,
    (t: string) => `Describe the key steps or process involved in ${t}.`,
    (t: string) => `What are the advantages and limitations of ${t}?`,
    (t: string) => `Illustrate ${t} with a suitable diagram or workflow.`,
  ];

  for (let i = 0; i < top.length && questions.length < 8; i++) {
    const t = top[i];
    const template = templates[i % templates.length];
    questions.push(template(t));
  }

  if (top.includes('Bfs') && top.includes('Dfs')) {
    questions.push('Compare BFS and DFS with a suitable example.');
  }

  if (questions.length < 5 && top[0]) {
    questions.push(`Write a short note on ${top[0]}.`);
  }

  return questions.slice(0, 10);
};

export default function handler(req: NextApiRequest, res: NextApiResponse<ResponseBody | { error: string }>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  if (!text.trim()) {
    return res.status(400).json({ error: 'Empty input. Paste previous year questions.' });
  }

  try {
    const topics = extractTopics(text);
    const predicted_questions = buildPredictedQuestions(topics);

    return res.status(200).json({ topics, predicted_questions });
  } catch (err) {
    return res.status(500).json({ error: 'Server error while analyzing text.' });
  }
}
