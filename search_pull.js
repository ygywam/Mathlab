const fs = require('fs');
const dir = fs.readdirSync('C:/Users/ygywa/Downloads/0701/temp_pull');
let found = false;
dir.forEach(file => {
  if (file.endsWith('.html') || file.endsWith('.js')) {
    const content = fs.readFileSync('C:/Users/ygywa/Downloads/0701/temp_pull/' + file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((l, i) => {
      if (l.match(/\btext\b/) && !l.includes('text-align') && !l.includes('text-shadow') && !l.includes('text-decoration') && !l.includes('text-transform') && !l.includes('type=\"text\"') && !l.includes('\"text\"')) {
        console.log(file, 'Line', i+1, ':', l.trim().substring(0, 150));
        found = true;
      }
    });
  }
});
if (!found) console.log('No unexpected text found in remote server files!');
