import express from 'express';
import { chromium } from 'playwright';
import { exec } from 'child_process';
import fs from 'fs';

const app = express();
app.use(express.json());

app.post('/capture', async (req, res) => {
  const { question, viewport, run_date } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Missing question' });
  }

  const width = viewport?.width || 430;
  const height = viewport?.height || 932;

  const tmpDir = '/tmp';
  const finalVideo = `${tmpDir}/geneye-${run_date}.mp4`;

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: {
      dir: tmpDir,
      size: { width, height }
    }
  });

  const page = await context.newPage();

  try {
    await page.goto('https://geneye.ai', { waitUntil: 'networkidle' });

    // Adjust selector later if needed
    await page.fill('textarea', question);
    await page.keyboard.press('Enter');

    // Record ~9 seconds
    await page.waitForTimeout(9000);

    await context.close();
    await browser.close();

    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.webm'));
    const recorded = `${tmpDir}/${files[0]}`;

    await new Promise((resolve, reject) => {
      exec(
        `ffmpeg -y -i ${recorded} -movflags faststart -pix_fmt yuv420p ${finalVideo}`,
        err => (err ? reject(err) : resolve())
      );
    });

    const title = 'Same question. Different AI answers.';
    const caption = `We asked GenEye:\n"${question}"\n\nWhich answer do you agree with? 👀`;

    res.json({
      success: true,
      video: finalVideo,
      title,
      caption
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log('GenEye video worker running on port 3000');
});
