const express = require('express');
const router = express.Router();
const axios = require('axios')
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: `${h.content}, render out the output in markdown` }]
      }))
    });

    const result = await chat.sendMessage(message);
    res.json({ reply: result.response.text() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get response from Gemini.' });
  }
});

function parseAIResponse(aiResponse) {
  try {
    // Remove triple backticks and any leading "json" identifier
    const clean = aiResponse
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // Parse to JSON
    const parsed = JSON.parse(clean);

      // Optional: Validate structure
      if (
          typeof parsed.score === 'number' &&
          Array.isArray(parsed.project_strengths) &&
          Array.isArray(parsed.project_weakness) &&
          Array.isArray(parsed.alignment) &&
          Array.isArray(parsed.aoi) &&
          Array.isArray(parsed.final_assessment)
      ) {
          return parsed;
      } else {
          throw new Error('JSON does not have the expected structure');
      }
  } catch (err) {
      console.error('Failed to parse AI response:', err.message);
      return {
          error: 'Invalid AI response format',
          raw: aiResponse
      };
  }
}

router.post('/deepseek', async (req, res) => {
  const { topic, instructions } = req.body;

  if (!topic || !instructions) {
    return res.status(400).json({ error: 'Missing required fields: topic or instructions' });
  }

  try {
    // Updated system prompt: force examples inside code blocks
    const systemPrompt = `
You are an expert programming instructor writing markdown content for a programming topic.
Use the instructions below to generate the content.

Feel free to add anything you feel might be helpful and necessary and make sure you give many examples.

make it very elaborate and lengthy so you can cover necessary areas and display it in ways that it'll be easy to copy to a markdown editor with your examples given in fenced code blocks with respect to the programing language in question with reference to the instruction

Instructions:
${instructions}
    `.trim();

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'deepseek/deepseek-r1-0528:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate content for topic: "${topic}"` }
        ],
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const markdown = response.data.choices?.[0]?.message?.content?.trim();

    res.json({ markdown });
  } catch (error) {
    console.error('AI generation error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate topic content' });
  }
});
module.exports = router;

