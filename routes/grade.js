const express = require('express');
const router = express.Router()
const axios = require('axios')

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
          Array.isArray(parsed.AOI) &&
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

router.post('/', async (req, res) => {
    const { instructions, rubric, studentCode } = req.body;

    if (!instructions || !rubric || !studentCode) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const systemPrompt = `
You are an expert programming instructor grading a student project.
Use the rubric and instructions below to assess the student's submission.

You must return a strict JSON response containing only two fields:
1. "score": percentage
2. "project_strengths": JSON array of the project strenghts
3. "project_weakness": JSON array of weaknesses
3. "alignment": JSON array of what the user did that aligns with the instructions
4. "AOI": JSON array of areas of which the student should improve on
5. "final_assessment": JSON array of the final feedback

Do NOT add anything else. Follow these rules strictly.
REMEMBER DO NOT ADD ANYTHING ELSE. Return just the json

Instructions:
${instructions}

Rubric:
${rubric}
`;

    const userPrompt = `
Student's Submission:
\`\`\`javascript
${studentCode}
\`\`\`
`;

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'deepseek/deepseek-r1-0528-qwen3-8b:free', // or another valid model from https://openrouter.ai/models
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
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

        const rawMessage = response.data.choices[0].message.content;

        const airesponse = parseAIResponse(rawMessage)
        res.json(airesponse)
    } catch (error) {
        console.error('OpenRouter API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Error grading submission' });
    }
});

module.exports = router
