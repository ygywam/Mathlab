function processMathImage(base64Data, mimeType, userApiKey, userSheetId) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userApiKey}`;
  const promptText = `너는 친절한 수학선생님이야. 학생이 올린 수학 문제 사진을 보고 다음 규칙에 따라 해설해 줘.
  1. 첫 번째 카드: 인사말과 함께 "먼저 문제를 파악해보자"라고 한 뒤, 사진 속 문제의 텍스트를 그대로 전사(OCR)해 줘. (0단계는 없음)
  2. 다음 단계에 따라 문제를 해설해 줘:
     - 1단계: 구하는 것 확인 (문제에서 물어보는 것을 파악하고, 주어진 조건 관찰 및 풀이 전략의 큰 그림 그리기)
     - 2단계: 조건 쪼개기 (조건들을 구체적으로 어떻게 사용할지 설명하며 실질적인 문제풀이 수행)
     - 3단계: 연결 전략 (쪼개놓은 전략을 효과적인 순서로 연결하여 문제풀이 흐름 완성)
     - 4단계: 피드백 (구한 답이 확실한 정답인지 검토하고 확인)
  3. [카드뉴스용 분할] 이 풀이는 세로형 카드뉴스로 만들어져. 수식이나 내용이 많아 세로로 너무 길어질 것 같으면, 하나의 단계를 '3단계-1', '3단계-2' 이런 식으로 적당히 끊어서 다음 카드로 분할 설명해 줘. 단, 다음 카드에 겨우 한 줄만 들어갈 것 같으면 분할하지 말고 유동적으로 한 카드에 넉넉히 담아도 돼.
  4. [수식 엄수 - 매우 중요] 모든 수학 수식과 기호(단일 알파벳, 숫자, 등식 포함)는 예외 없이 반드시 인라인은 $...$, 디스플레이는 $$...$$ 으로 감싸야 해. 기호 없이 S_5 = ... 처럼 덩그러니 쓰면 화면에서 깨지니 절대 주의해! 유니코드 특수기호 대신 표준 LaTeX 명령어(\\neq, \\geq 등)만 사용해.
  5. [금지어] '---', '###', '***' 같은 마크다운 구분선 절대 금지. 오직 텍스트와 수식만 작성해.
  6. 단락을 명확히 구분하기 위해 줄바꿈(엔터)을 충분히 활용해 줘.`;

  const payload = { "contents": [{ "parts": [ {"text": promptText}, { "inline_data": { "mime_type": mimeType, "data": base64Data } } ] }] };
  const options = { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    if(json.error) return { success: false, error: json.error.message };
    const answerText = json.candidates[0].content.parts[0].text;
    try {
      const sheet = SpreadsheetApp.openById(userSheetId).getActiveSheet();
      sheet.appendRow([new Date(), "AI 질문 분석", answerText]);
    } catch(e) { console.error("구글 시트 기록 실패:", e); }
    return { success: true, answer: answerText };
  } catch (e) { return { success: false, error: e.toString() }; }
}

function getAiHistory(userSheetId) {
  try {
    const sheet = SpreadsheetApp.openById(userSheetId).getActiveSheet();
    const data = sheet.getDataRange().getValues();
    let history = [];
    for (let i = data.length - 1; i >= 0 && history.length < 20; i--) {
      // 🌟 수정됨: 일반 첫 해설과 추가 질문 해설을 모두 불러옵니다.
      if (data[i][1] === "AI 질문 분석" || data[i][1] === "AI 추가 질문") { 
        let dateVal = data[i][0];
        let dateStr = (dateVal instanceof Date) ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm") : String(dateVal);
        // 🌟 프론트엔드에서 뱃지를 달기 위해 type 속성을 추가로 넘겨줍니다.
        history.push({ date: dateStr, text: data[i][2], type: data[i][1] });
      }
    }
    return { success: true, data: history };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function processFollowupQuestion(previousAnswer, followupQuery, userApiKey, userSheetId) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userApiKey}`;
  const promptText = `너는 친절한 수학선생님이야. 
  학생이 이전 문제 풀이 해설을 보고 이해가 안 되거나 궁금한 점이 있어서 추가 질문을 했어.
  제공된 이전 해설 내용과 학생의 추가 질문을 바탕으로 의문증을 완벽하게 해결해 줘.
  [이전 해설 내용]\n${previousAnswer}\n\n[학생의 추가 질문]\n${followupQuery}
  카드뉴스 생성 규칙은 이전과 동일하게 엄격히 준수해 줘:
  1. 답변은 세로형 카드뉴스로 제작되므로, 한 카드에 글자가 넘쳐 잘리지 않게 단락 단위로 쪼개어 설명해 줘. (필요시 '1단계-1', '1단계-2' 처럼 번호 부여)
  2. [수식 엄수] 모든 수학 수식과 기호는 예외 없이 반드시 인라인은 $...$, 디스플레이는 $$...$$ 으로 감싸야 해.
  3. [금지어] '---', '###', '***' 같은 마크다운 구분선 절대 금지.
  4. 단락을 명확히 구분하기 위해 줄바꿈(엔터)을 충분히 활용해 줘.`;

  const payload = { "contents": [{ "parts": [{ "text": promptText }] }] };
  const options = { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    if(json.error) return { success: false, error: json.error.message };
    const answerText = json.candidates[0].content.parts[0].text;
    try {
      const sheet = SpreadsheetApp.openById(userSheetId).getActiveSheet();
      sheet.appendRow([new Date(), "AI 추가 질문", "🎯 질문:\n" + followupQuery + "\n\n💡 답변:\n" + answerText]);
    } catch(e) {}
    return { success: true, answer: answerText };
  } catch (e) { return { success: false, error: e.toString() }; }
}