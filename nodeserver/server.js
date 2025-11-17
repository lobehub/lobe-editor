const express = require('express');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.ZENMUX_API_KEY,
  baseURL: 'https://zenmux.ai/api/v1',
});

// Completion endpoint
app.all('/completion', async (req, res) => {
  const { prompt, maxTokens } = req.body || req.query;

  console.info(req.body);

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const response = await openai.chat.completions.create({
      enable_thinking: false,
      messages: [{ content: prompt, role: 'user' }],
      model: 'inclusionai/ling-mini-2.0',
    });

    console.info('OpenAI response:', response);

    res.json(response.choices[0].message);
  } catch (error) {
    console.error('Error with OpenAI API:', error);
    res.status(500).json({ error: 'Failed to generate completion' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Node server is running at http://localhost:${port}`);
});
