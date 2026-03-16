import natural from 'natural';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;

/**
 * Preprocess text: tokenize, lowercase, and stem
 */
export const preprocessText = (text: string): string[] => {
  const tokens = tokenizer.tokenize(text.toLowerCase()) || [];
  // Basic stop words removal
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'from', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once']);
  return tokens.filter(token => !stopWords.has(token) && token.length > 2);
};

/**
 * Extract keywords using TF-IDF
 */
export const extractKeywords = (documents: string[]): string[] => {
  const tfidf = new TfIdf();
  documents.forEach(doc => tfidf.addDocument(doc));
  
  const keywords: Set<string> = new Set();
  documents.forEach((_, i) => {
    tfidf.listTerms(i).slice(0, 5).forEach(item => {
      keywords.add(item.term);
    });
  });
  
  return Array.from(keywords);
};

/**
 * Detect main topic based on keywords (Simple mapping for now)
 */
export const detectTopic = (text: string): string => {
  const lowerText = text.toLowerCase();
  const topicMap: Record<string, string[]> = {
    'Sorting Algorithms': ['sort', 'bubble', 'merge', 'quick', 'heap', 'insertion'],
    'Graph Traversal': ['graph', 'bfs', 'dfs', 'dijkstra', 'shortest path', 'traversal'],
    'Dynamic Programming': ['dynamic', 'memoization', 'knapsack', 'subsequence', 'optimal'],
    'Trees': ['tree', 'binary', 'avl', 'bst', 'node', 'leaf', 'root'],
    'Data Structures': ['stack', 'queue', 'linked list', 'array', 'hash', 'map'],
    'Complexity Analysis': ['big o', 'complexity', 'notation', 'time', 'space', 'efficiency'],
    'Operating Systems': ['process', 'thread', 'memory', 'scheduling', 'deadlock', 'kernel'],
    'Database Systems': ['sql', 'query', 'join', 'normalization', 'transaction', 'index'],
    'Networking': ['tcp', 'ip', 'protocol', 'layer', 'http', 'dns', 'router'],
  };

  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      return topic;
    }
  }

  return 'General Concepts';
};

/**
 * Calculate weighted topic scores
 * score = frequency * year_weight
 */
export const calculateWeightedScores = (papers: any[]) => {
  const currentYear = new Date().getFullYear();
  const topicScores: Record<string, number> = {};
  const topicFrequency: Record<string, number> = {};

  papers.forEach(paper => {
    const yearDiff = currentYear - paper.year;
    let weight = 0.1; // Default low weight for old papers
    
    if (yearDiff === 0) weight = 0.5;
    else if (yearDiff === 1) weight = 0.3;
    else if (yearDiff === 2) weight = 0.2;

    paper.questions.forEach((q: string) => {
      const topic = detectTopic(q);
      topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
      topicScores[topic] = (topicScores[topic] || 0) + (1 * weight);
    });
  });

  return { topicScores, topicFrequency };
};

/**
 * Extract text from PDF buffer
 */
export const extractTextFromPDF = async (buffer: Buffer): Promise<string> => {
  const data = await pdf(buffer);
  return data.text;
};
