// controllers/quizController.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

const gemini = googleGemini({
  version: 'v1',
  auth: process.env.GEMINI_API_KEY,
});

// Generate quiz questions based on prompt
async function generateQuizQuestions(req, res) {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    // Compose prompt for Gemini to generate quiz questions
    const systemPrompt = `
      You are a quiz generator.
      Generate 20 multiple choice quiz questions about: "${prompt}".
      Each question should have 4 options labeled A-D, and the correct answer.
      Return output as JSON array:
      [
        {
          "question": "Question text?",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "answer": "A"
        },
        ...
      ]
    `;

    const response = await gemini.chat.completions.create({
      model: 'gemini-1', // Replace with your Gemini model
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.7,
      maxTokens: 2000,
    });

    const content = response.data.choices[0].message.content;

    // Parse JSON from the AI output safely
    let quizQuestions;
    try {
      quizQuestions = JSON.parse(content);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to parse quiz questions from AI response' });
    }

    res.json({ questions: quizQuestions });
  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({ error: 'Failed to generate quiz questions' });
  }
}

// Evaluate user answers and return performance
export function evaluateQuizPerformance(req, res) {
  const { questions, userAnswers } = req.body;

  if (!Array.isArray(questions) || !Array.isArray(userAnswers)) {
    return res.status(400).json({ error: 'Questions and userAnswers arrays are required' });
  }

  if (questions.length !== userAnswers.length) {
    return res.status(400).json({ error: 'Questions and userAnswers must be of same length' });
  }

  let correctCount = 0;

  questions.forEach((q, idx) => {
    if (q.answer && q.answer.toUpperCase() === userAnswers[idx].toUpperCase()) {
      correctCount++;
    }
  });

  const scorePercent = (correctCount / questions.length) * 100;

  res.json({
    totalQuestions: questions.length,
    correctAnswers: correctCount,
    scorePercent,
    passed: scorePercent >= 60, // pass mark threshold (customize as needed)
  });
}

