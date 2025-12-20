const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.status(200).send('GenEye social media worker is alive');
});

app.post('/capture', async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Missing question' });
  }

  return res.json({
    success: true,
    video_url: null,
    title: 'Same question. Different AI answers.',
    caption: `We asked GenEye:\n"${question}"\n\nWhich AI answered best? 👀`
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
