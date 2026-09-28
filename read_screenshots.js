const Tesseract = require('tesseract.js');

const files = [
  'C:/Users/ygywa/.gemini/antigravity/brain/8aa0a27c-8eb1-40ce-9f00-7615f867dbaf/.user_uploaded/media__1785672871433.png',
  'C:/Users/ygywa/.gemini/antigravity/brain/8aa0a27c-8eb1-40ce-9f00-7615f867dbaf/.user_uploaded/media__1785673740332.png',
  'C:/Users/ygywa/.gemini/antigravity/brain/8aa0a27c-8eb1-40ce-9f00-7615f867dbaf/.user_uploaded/media__1785675239451.png'
];

async function readScreenshots() {
  for (const file of files) {
    console.log('--- Reading', file, '---');
    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng');
      console.log(text);
    } catch (err) {
      console.log('Error reading', file);
    }
  }
}

readScreenshots();
