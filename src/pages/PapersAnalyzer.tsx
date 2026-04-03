import React, { useState } from "react";
import { History, FileUp, Sparkles, Target, AlertCircle, ChevronRight } from "lucide-react";
import { analyzePreviousPaper } from "../lib/gemini";
import { motion, AnimatePresence } from "motion/react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

interface AnalysisResult {
  important_topics: { name: string; frequency: number; importance: "High" | "Medium" | "Low" }[];
  recurring_concepts: string[];
  predicted_questions: {
    short: string[];
    long: string[];
    conceptual: string[];
  };
}

export default function PapersAnalyzer() {
  const [inputText, setInputText] = useState("");
  const [pyqs, setPyqs] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const extractTextFromPdf = async (file: File): Promise<string> => {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      throw new Error("PDF worker not loaded");
    }

    console.log("[PapersAnalyzer] pdfjs version:", pdfjsLib.version);
    console.log("[PapersAnalyzer] pdfjs worker:", pdfjsLib.GlobalWorkerOptions.workerSrc);
    console.log("[PapersAnalyzer] Reading file:", file.name, file.type, file.size);

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch (err) {
      console.error("[PapersAnalyzer] Failed to read file arrayBuffer:", err);
      throw new Error("Failed to read file");
    }

    const header = new Uint8Array(arrayBuffer, 0, 4);
    const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
    if (!isPdf) {
      throw new Error("Invalid PDF or unsupported format");
    }

    let pdf: any;
    try {
      const uint8Array = new Uint8Array(arrayBuffer.slice(0));
      pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
    } catch (err) {
      console.error("PDFJS ERROR:", err);
      throw new Error("Worker failed");
    }

    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      let page: any;
      try {
        page = await pdf.getPage(i);
      } catch (err) {
        console.error(`[PapersAnalyzer] Failed to load page ${i}:`, err);
        throw new Error("PDF parsing failed");
      }

      let content: any;
      try {
        content = await page.getTextContent();
      } catch (err) {
        console.error(`[PapersAnalyzer] Failed to extract text from page ${i}:`, err);
        throw new Error("PDF text extraction failed");
      }

      const pageText = content.items.map((item: any) => item.str).join(" ");
      text += pageText + "\n";
    }
    return text;
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setStatus("Preparing analysis...");
    setResult(null);

    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    console.log("Gemini API Key:", API_KEY);
    if (!API_KEY) {
      setError("Missing API Key");
      setLoading(false);
      setStatus(null);
      return;
    }

    if (files.length === 0) {
      setError("Please select at least one PDF file.");
      setLoading(false);
      setStatus(null);
      return;
    }

    try {
      let combinedText = "";
      console.log("[PapersAnalyzer] Starting analysis for", files.length, "files");

      for (const file of files) {
        setStatus(`Extracting text from ${file.name}...`);
        console.log("[PapersAnalyzer] Extracting text from file:", file.name);
        const pdfText = await extractTextFromPdf(file);
        combinedText += pdfText + "\n";
      }

      if (inputText.trim()) {
        console.log("[PapersAnalyzer] Appending manual study material");
        combinedText += "\n" + inputText.trim();
      }

      if (pyqs.trim()) {
        console.log("[PapersAnalyzer] Appending PYQs");
        combinedText += "\n" + pyqs.trim();
      }

      if (!combinedText.trim()) {
        throw new Error("No text could be extracted from the PDFs.");
      }

      setStatus("Generating predicted questions...");
      console.log("[PapersAnalyzer] Sending combined text to Gemini (length:", combinedText.length, ")");
      const data = await analyzePreviousPaper(combinedText, pyqs);

      if (
        !data ||
        (
          data.important_topics.length === 0 &&
          data.predicted_questions.short.length === 0 &&
          data.predicted_questions.long.length === 0 &&
          data.predicted_questions.conceptual.length === 0
        )
      ) {
        throw new Error("AI was unable to extract meaningful data from these papers.");
      }

      setResult(data);
      setStatus(null);
    } catch (err: any) {
      console.error("Analysis error:", err);
      const msg = String(err?.message || "");
      if (msg.includes("PDF worker not loaded")) {
        setError("PDF worker not loaded");
      } else if (msg.includes("Failed to read file")) {
        setError("Failed to read file");
      } else if (msg.includes("Invalid PDF")) {
        setError("Invalid PDF or unsupported format");
      } else if (msg.includes("Worker failed")) {
        setError("Worker failed");
      } else if (msg.includes("detached")) {
        setError("Buffer issue");
      } else if (msg.includes("PDF parsing failed")) {
        setError("PDF parsing failed");
      } else if (msg.includes("PDF text extraction failed")) {
        setError("PDF text extraction failed");
      } else if (msg.includes("invalid JSON") || msg.includes("invalid json")) {
        setError("Invalid JSON response");
      } else if (msg.includes("Gemini")) {
        setError("Gemini API error");
      } else {
        setError(msg || "An unexpected error occurred during analysis.");
      }
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Previous Papers Analyzer</h1>
          <p className="text-slate-400">Analyze trends and patterns in past exams using AI.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0d1425] border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FileUp className="w-5 h-5 text-indigo-500" />
              Analyze New Paper
            </h3>

            <div className="space-y-4 mb-4">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste study material or the content of a previous year paper here..."
                className="w-full h-[150px] bg-slate-900 border border-slate-800 rounded-xl p-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
              />

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">
                  Paste Previous Year Questions (optional)
                </label>
                <textarea
                  value={pyqs}
                  onChange={(e) => setPyqs(e.target.value)}
                  placeholder="Paste PYQs here to align predictions with exam trends..."
                  className="w-full h-[120px] bg-slate-900 border border-slate-800 rounded-xl p-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                />
              </div>

              <div className="flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 border-dashed rounded-xl">
                <FileUp className="w-6 h-6 text-slate-500" />
                <div className="flex-1">
                  <p className="text-sm text-slate-400 mb-1">Upload multiple PDF files</p>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => {
                      const selected = Array.from(e.target.files || []);
                      setFiles((prev) => [...prev, ...selected]);
                      setError(null);
                    }}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-600/10 file:text-indigo-400 hover:file:bg-indigo-600/20 cursor-pointer"
                  />
                </div>
                {files.length > 0 && (
                  <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold">
                    {files.length} files selected
                  </div>
                )}
              </div>
            </div>

            {status && (
              <div className="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-3 text-indigo-400 text-sm">
                <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                {status}
              </div>
            )}

            {error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Predicted Questions
                </>
              )}
            </button>
          </div>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#0d1425] border border-slate-800 rounded-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-slate-800">
                  <h3 className="text-lg font-bold text-white">Important Topics</h3>
                </div>
                <div className="p-6 space-y-4">
                  {result.important_topics.map((topic, i) => (
                    <div key={i} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl flex gap-4">
                      <span className="w-6 h-6 bg-indigo-600/20 text-indigo-400 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-slate-200 text-sm font-semibold">{topic.name}</p>
                        <p className="text-slate-400 text-xs">
                          Frequency: {topic.frequency} · Importance: {topic.importance}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-6">
          {result ? (
            <>
              <div className="bg-[#0d1425] border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Recurring Concepts
                </h3>
                <div className="space-y-4">
                  {result.recurring_concepts.length > 0 ? (
                    result.recurring_concepts.map((concept, i) => (
                      <div key={i} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                        <p className="text-slate-300 text-sm leading-relaxed">{concept}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 text-sm">No recurring concepts detected.</p>
                  )}
                </div>
              </div>

              <div className="bg-[#0d1425] border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  Short Answer Questions
                </h3>
                <div className="space-y-4">
                  {result.predicted_questions.short.map((question, i) => (
                    <div key={i} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                      <p className="text-slate-300 text-sm leading-relaxed">{question}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#0d1425] border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-500" />
                  Long Answer Questions
                </h3>
                <div className="space-y-4">
                  {result.predicted_questions.long.map((question, i) => (
                    <div key={i} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                      <p className="text-slate-300 text-sm leading-relaxed">{question}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#0d1425] border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Conceptual Questions
                </h3>
                <div className="space-y-4">
                  {result.predicted_questions.conceptual.map((question, i) => (
                    <div key={i} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                      <p className="text-slate-300 text-sm leading-relaxed">{question}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-[#0d1425] border border-slate-800 p-8 rounded-2xl text-center">
              <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-slate-700" />
              </div>
              <h3 className="text-white font-bold mb-2">No Analysis Yet</h3>
              <p className="text-slate-500 text-sm">
                Upload PDFs and optional PYQs to generate exam-aligned predicted questions.
              </p>
            </div>
          )}

          <div className="bg-[#0d1425] border border-slate-800 p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Analysis Tips
            </h3>
            <ul className="space-y-3">
              {[
                "Upload multiple years of papers for better trend detection",
                "Add previous year questions to improve exam pattern matching",
                "Include marks or difficulty hints when available",
              ].map((tip, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-400">
                  <ChevronRight className="w-4 h-4 text-indigo-500 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
