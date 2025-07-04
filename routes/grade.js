require('dotenv').config();
const express = require('express');
const router = express.Router()
const pool = require('../db')
const axios = require('axios')
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

async function readGoogleDriveFileText(driveUrl) {
  try {
    // Extract file ID from the shareable link
    const fileIdMatch = driveUrl.match(/[-\w]{25,}/);
    if (!fileIdMatch) throw new Error("Invalid Google Drive link");

    const fileId = fileIdMatch[0];

    // Construct the download URL
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error("Failed to fetch file");

    const text = await response.text();
    return text;

  } catch (error) {
    console.error("Error reading Google Drive file:", error);
    return null;
  }
}

router.post('/gemini', async (req, res) => {
  const { projectId, file_link, file_type } = req.body;

  if (!projectId || !file_link || !file_type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Read student code from Google Drive link
    const studentCode = await readGoogleDriveFileText(file_link);

    // Fetch project rubric and instructions
    const [projects] = await pool.execute(`
      SELECT p.id, p.title, p.instructions, p.rubric
      FROM projects p WHERE p.id = ?
    `, [projectId]);

    const project = projects[0];

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Combine system and user prompt into a single text prompt for Gemini
    const gradingPrompt = `
You are an expert programming instructor grading a student project.
Use the rubric and instructions below to assess the student's submission.

You must return a strict JSON response containing ONLY these fields:
{
  "score": percentage,
  "project_strengths": JSON array,
  "project_weakness": JSON array,
  "alignment": JSON array,
  "aoi": JSON array,
  "final_assessment": JSON array
}

⚠️ Do NOT add anything else. Strictly return this JSON.

Instructions:
${project.instructions}

Rubric:
${project.rubric}

Student's Submission:
\`\`\`${file_type}
${studentCode}
\`\`\`
`;

    // Create Gemini model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Send prompt as a single content block
    const result = await model.generateContent(gradingPrompt);

    const rawMessage = result.response.text();

    // Parse AI response to JSON
    const feedback = parseAIResponse(rawMessage);
    const score = feedback.score;

    const grader = 'gemini-2.0-flash';

    // Store evaluation in DB
      await pool.execute(`
  INSERT INTO evaluations (student_id, project_id, file_link, score, feedback, grader)
  VALUES (?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    file_link = VALUES(file_link),
    score = VALUES(score),
    feedback = VALUES(feedback),
    grader = VALUES(grader)
`, [
    req.user.id,
    projectId,
    file_link,
    score,
    JSON.stringify(feedback),
    grader
]);

    res.json(feedback);
  } catch (error) {
    console.error('Grading error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error grading submission' });
  }
});


router.post('/', async (req, res) => {
  const { projectId, file_link, file_type } = req.body;

  if (!projectId || !file_link || !file_type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const studentCode = await readGoogleDriveFileText(file_link);

    const [projects] = await pool.execute(`
      SELECT p.id, p.title, p.instructions, p.rubric
      FROM projects p WHERE p.id = ?
    `, [projectId]);

    const project = projects[0];

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const systemPrompt = `
You are an expert programming instructor grading a student project.
Use the rubric and instructions below to assess the student's submission.

You must return a strict JSON response containing only two fields:
1. "score": percentage
2. "project_strengths": JSON array of the project strenghts
3. "project_weakness": JSON array of weaknesses
3. "alignment": JSON array of what the user did that aligns with the instructions
4. "aoi": JSON array of areas of which the student should improve on
5. "final_assessment": JSON array of the final feedback

Do NOT add anything else. Follow these rules strictly.
REMEMBER DO NOT ADD ANYTHING ELSE. Return just the json

Instructions:
${project.instructions}

Rubric:
${project.rubric}
`;

    const userPrompt = `
Student's Submission:
\`\`\`${file_type}
${studentCode}
\`\`\`
`;

    const grader = 'deepseek/deepseek-r1-0528:free';

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: grader,
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
    const feedback = parseAIResponse(rawMessage);
    const score = feedback.score;

      await pool.execute(`
  INSERT INTO evaluations (student_id, project_id, file_link, score, feedback, grader)
  VALUES (?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    file_link = VALUES(file_link),
    score = VALUES(score),
    feedback = VALUES(feedback),
    grader = VALUES(grader)
`, [
    req.user.id,
    projectId,
    file_link,
    score,
    JSON.stringify(feedback),
    grader
]);

      res.json(feedback);
  } catch (error) {
      console.error('Grading error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Error grading submission' });
  }
});

module.exports = router
