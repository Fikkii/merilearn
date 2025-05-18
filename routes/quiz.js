const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai')

const client = new GoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

// Helper: parse Gemini JSON safely from the response text
function parseJSONFromText(text) {
  const jsonStart = text.indexOf('[');
  const jsonEnd = text.lastIndexOf(']');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('Could not find JSON array in response');
  }

  let jsonString = text.substring(jsonStart, jsonEnd + 1);

  // Fix trailing commas and smart quotes if any
  jsonString = jsonString.replace(/,\s*]/g, ']');
  jsonString = jsonString.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  return JSON.parse(jsonString);
}

// POST /api/quiz/generate - Generate 20 quiz questions from prompt
router.post('/quiz/generate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({ error: 'Prompt is required and must be a non-empty string' });
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages: [
        {
          author: 'user',
          content: `Generate exactly 20 multiple choice quiz questions about: "${prompt.trim()}".
Output ONLY a JSON array of objects with these keys:
- question (string)
- options (array of 4 strings labeled A-D)
- correctIndex (integer 0-3).

Do NOT include any explanation or extra text.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const text = response.choices[0].message.content.trim();
    const questions = parseJSONFromText(text);

    return res.json({ questions });
  } catch (error) {
    console.error('Error generating quiz:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// POST /api/quiz/evaluate - Evaluate user's answers and return performance
// Expected body: { questions: [...], answers: [...] }
// questions = array of { question, options, correctIndex }
// answers = array of user selected indices (0-3)
router.post('/quiz/evaluate', (req, res) => {
  const { questions, answers } = req.body;

  if (
    !Array.isArray(questions) ||
    !Array.isArray(answers) ||
    questions.length !== answers.length
  ) {
    return res.status(400).json({ error: 'Questions and answers arrays must be present and of equal length.' });
  }

  let correctCount = 0;

  questions.forEach((q, i) => {
    if (q.correctIndex === answers[i]) {
      correctCount++;
    }
  });

  const scorePercent = ((correctCount / questions.length) * 100).toFixed(2);

  return res.json({
    totalQuestions: questions.length,
    correctAnswers: correctCount,
    scorePercent,
    passed: scorePercent >= 70, // example pass threshold
  });
});

module.exports = router;

