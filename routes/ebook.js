const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.get('/topics', async (req, res) => {
    const prompt = `Generate a random list of 10 interesting study topics for a student. Just return the topics as a JSON array like ["Topic1", "Topic2", ...]`;

  try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const result = await model.generateContent(prompt);
      const textResponse = result.response.text();

      // Extract JSON block
      const jsonMatch = textResponse.match(/```(?:json)?([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1] : textResponse;

      const recommendations = JSON.parse(jsonString.trim());

      res.json({ cards: recommendations });
  } catch (error) {
      console.error('Gemini API error:', error);
      res.status(500).json({ error: 'Failed to generate Topics' });
  }
});


router.post('/recommendations', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required as a string' });
  }

  try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const fullPrompt = `
      Based on the topic: "${prompt}", make 10 random ebook materials recommendation.
      For each recommendation, include:
      1. title
      2. short description (max 2 sentences)
      3. a Google search link to help the user find and download the ebook.

      Format the response in valid JSON like:
      [
        {
          "title": "Example Title",
          "description": "Example description",
          "link": "https://www.google.com/search?q=Download+Example+Title+ebook"
        }
      ],
    `;

      const result = await model.generateContent(fullPrompt);
      const textResponse = result.response.text();

      // Extract JSON block
      const jsonMatch = textResponse.match(/```(?:json)?([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1] : textResponse;

      const recommendations = JSON.parse(jsonString.trim());

      res.json({ cards: recommendations });
  } catch (error) {
      console.error('Gemini API error:', error);
      res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

module.exports = router;
