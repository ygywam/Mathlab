function doGet(e) {
  // 제어권 및 request 객체를 Router.gs의 renderMathLab으로 온전히 위임합니다.
  return renderMathLab(e);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ==========================================
// 수학 실험실 저장소 통합 패치
// ==========================================
const MATHLAB_DEFAULT_SHEET_ID = '1xvk6IZk2YqwCJ-sHusI-2PpdC8rRK8fIMMqZ3uz-W1Q';
const FEEDBACK_SHEET_NAME = '사용자_피드백';
const LEADERBOARD_SHEET_NAME = '게임_명예의전당';
const LEADERBOARD_HEADERS = [
'등록일시',
'게임명',
'학교급',
'학교명',
'학년/반',
'닉네임',
'점수'
];
// ==========================================
// Spreadsheet ID 정규화
// ==========================================
function normalizeSpreadsheetId_(value) {
  if (value === null || value === undefined) return '';

  const text = String(value).trim();

  if (
    !text ||
    text === 'undefined' ||
    text === 'null' ||
    text === 'default' ||
    text === "''" ||
    text === '""'
  ) {
    return '';
  }

  // 구글 스프레드시트 URL에서 ID 추출
  // 예: https://docs.google.com/spreadsheets/d/스프레드시트ID/edit
  const urlIdPattern = new RegExp('/d/([a-zA-Z0-9_-]{20,})');
  const match = text.match(urlIdPattern);

  if (match && match[1]) {
    return match[1];
  }

  // ID만 들어온 경우
  const idOnlyPattern = new RegExp('^[a-zA-Z0-9_-]{20,}$');

  if (idOnlyPattern.test(text)) {
    return text;
  }

  return '';
}
// ==========================================
// 스프레드시트 선택 함수
// ==========================================
function getDefaultSpreadsheet_() {
const defaultId = normalizeSpreadsheetId_(MATHLAB_DEFAULT_SHEET_ID);
if (!defaultId) {
throw new Error('기본 원본 시트 ID가 Code.gs에 설정되어 있지 않습니다.');
}
return SpreadsheetApp.openById(defaultId);
}
function getTargetSpreadsheet_(sheetId) {
const id = normalizeSpreadsheetId_(sheetId);
if (!id) {
throw new Error('개인 Google Spreadsheet ID가 없습니다. 설정에서 시트 ID를 먼저 저장하세요.');
}
return SpreadsheetApp.openById(id);
}
function getFeedbackSpreadsheet_() {
// 대시보드 게시판은 항상 기본 원본 시트 사용
return getDefaultSpreadsheet_();
}
function getLeaderboardSpreadsheet_(sheetId) {
// 명예의 전당:
// sheetId가 있으면 개인/학급 시트
// sheetId가 없으면 전체 랭킹용 기본 원본 시트
const id = normalizeSpreadsheetId_(sheetId);
if (id) {
return SpreadsheetApp.openById(id);
}
return getDefaultSpreadsheet_();
}
// ==========================================
// 사용자 피드백
// ==========================================
function getFeedbackList(sheetId) {
try {
Logger.log('NEW getFeedbackList 실행됨, sheetId=' + sheetId);
const ss = getFeedbackSpreadsheet_();
Logger.log('feedback spreadsheet=' + ss.getName());
const sheet = ss.getSheetByName(FEEDBACK_SHEET_NAME);
if (!sheet) {
return {
success: true,
data: []
};
}
const data = sheet.getDataRange().getValues();
const list = [];
for (let i = data.length - 1; i >= 1; i--) {
const dateVal = data[i][0];
const dateStr = dateVal instanceof Date
? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
: String(dateVal || '');
list.push({
row: i + 1,
date: dateStr,
text: data[i][1] || '',
reply: data[i][2] || '',
status: data[i][3] || ''
});
}
return {
success: true,
data: list
};
} catch (e) {
return {
success: false,
error: e.toString(),
message: e.message,
data: []
};
}
}
function saveFeedback(sheetId, content) {
try {
const ss = getFeedbackSpreadsheet_();
let sheet = ss.getSheetByName(FEEDBACK_SHEET_NAME);
if (!sheet) {
sheet = ss.insertSheet(FEEDBACK_SHEET_NAME);
sheet.appendRow([
'등록일시',
'건의내용',
'관리자답변',
'상태'
]);
sheet.getRange('A1:D1')
.setFontWeight('bold')
.setBackground('#3498db')
.setFontColor('#ffffff');
sheet.setFrozenRows(1);
}
sheet.appendRow([
new Date(),
content,
'',
'대기중'
]);
return {
success: true
};
} catch (e) {
return {
success: false,
error: e.toString(),
message: e.message
};
}
}
function replyFeedback(sheetId, rowIndex, replyText) {
try {
const ss = getFeedbackSpreadsheet_();
const sheet = ss.getSheetByName(FEEDBACK_SHEET_NAME);
if (!sheet) {
return {
success: false,
error: FEEDBACK_SHEET_NAME + ' 시트를 찾을 수 없습니다.'
};
}
sheet.getRange(Number(rowIndex), 3).setValue(replyText);
sheet.getRange(Number(rowIndex), 4).setValue('해결완료');
return {
success: true
};
} catch (e) {
return {
success: false,
error: e.toString(),
message: e.message
};
}
}
// ==========================================
// 명예의 전당 / 게임 점수
// ==========================================
function getLeaderboardSheet_(sheetId) {
const ss = getLeaderboardSpreadsheet_(sheetId);
let sheet = ss.getSheetByName(LEADERBOARD_SHEET_NAME);
if (!sheet) {
sheet = ss.insertSheet(LEADERBOARD_SHEET_NAME);
}
ensureLeaderboardHeader_(sheet);
return sheet;
}
function ensureLeaderboardHeader_(sheet) {
if (!sheet) return;
const lastRow = sheet.getLastRow();
if (lastRow === 0) {
sheet.getRange(1, 1, 1, LEADERBOARD_HEADERS.length).setValues([LEADERBOARD_HEADERS]);
sheet.setFrozenRows(1);
} else {
const currentHeaders = sheet
.getRange(1, 1, 1, LEADERBOARD_HEADERS.length)
.getDisplayValues()[0];
const isHeaderEmpty = currentHeaders.every(function(value) {
return String(value || '').trim() === '';
});
if (isHeaderEmpty) {
sheet.getRange(1, 1, 1, LEADERBOARD_HEADERS.length).setValues([LEADERBOARD_HEADERS]);
sheet.setFrozenRows(1);
}
}
// B~F열 텍스트 고정:
// 게임명, 학교급, 학교명, 학년/반, 닉네임
// 특히 학년/반 3-2가 날짜로 바뀌는 문제 방지
sheet.getRange(1, 2, sheet.getMaxRows(), 5).setNumberFormat('@');
// G열 점수
sheet.getRange(1, 7, sheet.getMaxRows(), 1).setNumberFormat('0');
}
function normalizeGameName_(name) {
  return String(name || '').replace(new RegExp('\\s+', 'g'), '').trim();
}
function normalizeScore_(score) {
const value = String(score || '').replace(/,/g, '').trim();
const number = Number(value);
if (isNaN(number)) return 0;
return number;
}
function isNumericLike_(value) {
const text = String(value || '').replace(/,/g, '').trim();
if (text === '') return false;
return !isNaN(Number(text));
}
function normalizeLeaderboardRow_(row) {
row = row || [];
// 신버전:
// 등록일시 | 게임명 | 학교급 | 학교명 | 학년/반 | 닉네임 | 점수
if (
row.length >= 7 &&
String(row[5] || '').trim() !== '' &&
String(row[6] || '').trim() !== ''
) {
return {
date: String(row[0] || ''),
gameName: String(row[1] || ''),
schoolLevel: String(row[2] || ''),
schoolName: String(row[3] || ''),
className: String(row[4] || ''),
nickname: String(row[5] || '익명'),
score: normalizeScore_(row[6])
};
}
// 구버전:
// 등록일시 | 게임명 | 닉네임 | 점수
return {
date: String(row[0] || ''),
gameName: String(row[1] || ''),
schoolLevel: '',
schoolName: '',
className: '',
nickname: String(row[2] || '익명'),
score: normalizeScore_(row[3])
};
}
// ==========================================
// 게임 점수 저장
//
// 기본 호출 순서:
// saveGameScore(sheetId, gameName, nickname, score, isDesc, meta)
//
// 단, HTML 쪽에서 실수로
// saveGameScore(sheetId, gameName, score, nickname, isDesc, meta)
// 순서로 호출해도 자동 보정하도록 처리함.
// ==========================================
function saveGameScore(sheetId, gameName, nickname, score, isDesc, meta) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(10000);
// 혹시 HTML 쪽에서 nickname과 score 순서를 반대로 넘긴 경우 보정
if (isNumericLike_(nickname) && !isNumericLike_(score)) {
const temp = nickname;
nickname = score;
score = temp;
}
const sheet = getLeaderboardSheet_(sheetId);
meta = meta || {};
const safeGameName = String(gameName || '').trim();
const safeNickname = String(nickname || '익명').trim() || '익명';
const numericScore = normalizeScore_(score);
const schoolLevel = String(meta.schoolLevel || '').trim();
const schoolName = String(meta.schoolName || '').trim();
const className = String(meta.className || '').trim();
const nextRow = sheet.getLastRow() + 1;
// appendRow 대신 setValues 사용
// 이유: 3-2 같은 학년/반 값이 날짜로 자동 변환되는 문제를 줄이기 위해
sheet.getRange(nextRow, 2, 1, 5).setNumberFormat('@');
sheet.getRange(nextRow, 7, 1, 1).setNumberFormat('0');
sheet.getRange(nextRow, 1, 1, 7).setValues([[
new Date(),
safeGameName,
schoolLevel,
schoolName,
className,
safeNickname,
numericScore
]]);
const leaderboard = getGameLeaderboard(sheetId, safeGameName, isDesc);
const allRows = getAllLeaderboardRows_(sheetId, safeGameName, isDesc);
const rankIndex = allRows.findIndex(function(row) {
return String(row.nickname || '') === safeNickname &&
Number(row.score) === numericScore;
});
return {
success: true,
message: '등록 완료',
rank: rankIndex >= 0 ? rankIndex + 1 : '',
score: numericScore,
data: leaderboard.data || [],
total: leaderboard.total || 0
};
} catch (e) {
return {
success: false,
error: e.toString(),
message: e.message,
data: [],
total: 0
};
} finally {
try {
lock.releaseLock();
} catch (releaseError) {
// lock을 얻지 못한 상태에서 releaseLock이 호출될 수 있으므로 무시
}
}
}
// ==========================================
// 명예의 전당 조회
//
// 중요:
// google.script.run으로 브라우저에 반환할 때
// Date 객체가 섞이면 result가 null로 넘어갈 수 있음.
// 그래서 getValues()가 아니라 getDisplayValues() 사용.
// ==========================================
function getGameLeaderboard(sheetId, gameName, isDesc) {
try {
Logger.log('NEW getGameLeaderboard 실행됨, sheetId=' + sheetId + ', gameName=' + gameName);
const ss = getLeaderboardSpreadsheet_(sheetId);
Logger.log('leaderboard spreadsheet=' + ss.getName());
const sheet = ss.getSheetByName(LEADERBOARD_SHEET_NAME);
if (!sheet) {
return {
success: false,
message: LEADERBOARD_SHEET_NAME + ' 시트를 찾지 못했습니다.',
data: [],
total: 0
};
}
ensureLeaderboardHeader_(sheet);
const values = sheet.getDataRange().getDisplayValues();
if (!values || values.length <= 1) {
return {
success: true,
data: [],
total: 0
};
}
const targetGameName = normalizeGameName_(gameName);
const rows = values
.slice(1)
.map(function(row) {
return normalizeLeaderboardRow_(row);
})
.filter(function(row) {
return normalizeGameName_(row.gameName) === targetGameName;
})
.filter(function(row) {
return String(row.nickname || '').trim() !== '' &&
!isNaN(Number(row.score));
})
.sort(function(a, b) {
const scoreA = Number(a.score) || 0;
const scoreB = Number(b.score) || 0;
return isDesc ? scoreB - scoreA : scoreA - scoreB;
});
const topRows = rows.slice(0, 5);
return {
success: true,
data: topRows,
total: rows.length
};
} catch (error) {
Logger.log('[getGameLeaderboard error] ' + error.message);
return {
success: false,
message: error.message,
error: error.toString(),
data: [],
total: 0
};
}
}
// ==========================================
// 전체 랭킹 행 조회
// 저장 후 내 순위 계산용
// ==========================================
function getAllLeaderboardRows_(sheetId, gameName, isDesc) {
const sheet = getLeaderboardSheet_(sheetId);
const values = sheet.getDataRange().getDisplayValues();
if (!values || values.length <= 1) {
return [];
}
const targetGameName = normalizeGameName_(gameName);
return values
.slice(1)
.map(function(row) {
return normalizeLeaderboardRow_(row);
})
.filter(function(row) {
return normalizeGameName_(row.gameName) === targetGameName;
})
.filter(function(row) {
return String(row.nickname || '').trim() !== '' &&
!isNaN(Number(row.score));
})
.sort(function(a, b) {
const scoreA = Number(a.score) || 0;
const scoreB = Number(b.score) || 0;
return isDesc ? scoreB - scoreA : scoreA - scoreB;
});
}
// ==========================================
// 테스트 함수
// ==========================================
function testDefaultSpreadsheetOpen() {
const ss = getDefaultSpreadsheet_();
Logger.log(ss.getName());
}
function testFeedbackListDefault() {
const result = getFeedbackList('');
Logger.log(JSON.stringify(result, null, 2));
}
function testLeaderboardRaw() {
const ss = getDefaultSpreadsheet_();
const sheet = ss.getSheetByName(LEADERBOARD_SHEET_NAME);
if (!sheet) {
Logger.log(LEADERBOARD_SHEET_NAME + ' 시트를 찾지 못했습니다.');
return;
}
// Date 객체 문제 확인을 위해 display values 사용
const data = sheet.getDataRange().getDisplayValues();
Logger.log(JSON.stringify(data.slice(0, 10), null, 2));
}
function testLeaderboardDefault() {
const result = getGameLeaderboard('', '1024마스터', true);
Logger.log(JSON.stringify(result, null, 2));
}
function testLeaderboardNormalize() {
const ss = getDefaultSpreadsheet_();
const sheet = ss.getSheetByName(LEADERBOARD_SHEET_NAME);
if (!sheet) {
Logger.log(LEADERBOARD_SHEET_NAME + ' 시트를 찾지 못했습니다.');
return;
}
// Date 객체가 섞이지 않게 display values 사용
const data = sheet.getDataRange().getDisplayValues();
const rows = data.slice(1).map(function(row) {
return normalizeLeaderboardRow_(row);
});
Logger.log(JSON.stringify(rows, null, 2));
}

// ==========================================
// [게시물 삭제] 관리자 피드백 삭제 함수
// ==========================================
function deleteFeedbackItem(sheetId, rowIndex) {
  try {
    const ss = getFeedbackSpreadsheet_();
    const sheet = ss.getSheetByName(FEEDBACK_SHEET_NAME);
    if (!sheet) return { success: false, error: '시트를 찾을 수 없습니다.' };
    sheet.deleteRow(Number(rowIndex));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// [운영/관리] 명예의 전당 통합 관리 함수
// ==========================================
function getAllGamesLeaderboard(sheetId) {
  try {
    const sheet = getLeaderboardSheet_(sheetId);
    if (!sheet) return { success: false, error: '명예의 전당 시트를 찾을 수 없습니다.' };
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, data: [] };
    
    const dataRange = sheet.getRange(2, 1, lastRow - 1, LEADERBOARD_HEADERS.length);
    const data = dataRange.getValues();
    
    const rows = data.map((row, index) => {
      return {
        rowIdx: index + 2,
        ...normalizeLeaderboardRow_(row)
      };
    });
    
    // 최신순 정렬 (index 역순)
    rows.reverse();
    
    return { success: true, data: rows };
  } catch (error) {
    Logger.log('[getAllGamesLeaderboard error] ' + error.message);
    return { success: false, error: error.message };
  }
}

function clearLeaderboardDataImmediately(sheetId) {
  try {
    const sheet = getLeaderboardSheet_(sheetId);
    if (!sheet) return { success: false, error: '명예의 전당 시트를 찾을 수 없습니다.' };
    
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }
    return { success: true, message: '명예의 전당 기록이 모두 초기화되었습니다.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function clearMonthlyLeaderboard() {
  try {
    // 자동 스케줄러는 기본 원본 시트만 비웁니다.
    const ss = getDefaultSpreadsheet_();
    const sheet = ss.getSheetByName(LEADERBOARD_SHEET_NAME);
    if (!sheet) return;
    
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }
    Logger.log('월간 명예의 전당 자동 초기화 완료');
  } catch (e) {
    Logger.log('월간 초기화 실패: ' + e.message);
  }
}

function setupMonthlyClearTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'clearMonthlyLeaderboard') {
        return { success: true, message: '이미 월간 초기화 트리거가 설정되어 있습니다.' };
      }
    }
    
    ScriptApp.newTrigger('clearMonthlyLeaderboard')
      .timeBased()
      .onMonthDay(1)
      .atHour(0)
      .create();
      
    return { success: true, message: '매월 1일 자정 명예의 전당 자동 초기화 트리거가 설정되었습니다.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
// touch

// ==========================================
// [수학실험실] 방문자 글로벌 카운터 로직
// ==========================================

// 방문자 수만 단순히 조회하는 함수 (새로고침 중복 방지용)
function getVisitorCount() {
  var props = PropertiesService.getScriptProperties();
  var total = parseInt(props.getProperty('total_visits') || '0');
  var todayDate = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  var storedDate = props.getProperty('today_date');
  var todayCount = parseInt(props.getProperty('today_visits') || '0');
  
  if (storedDate !== todayDate) {
    todayCount = 0; // 날짜가 바뀌었으면 오늘 방문자는 0으로 처리
  }
  
  return { total: total, today: todayCount };
}

// 새로운 유저가 접속했을 때 카운트를 +1 증가시키는 함수
function getAndIncrementVisitorCount() {
  var props = PropertiesService.getScriptProperties();
  var todayDate = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(3000); // 동시 접속자 충돌 방지 락
  } catch (e) {
    return getVisitorCount();
  }
  
  try {
    var total = parseInt(props.getProperty('total_visits') || '0');
    var storedDate = props.getProperty('today_date') || '';
    var todayCount = parseInt(props.getProperty('today_visits') || '0');
    
    // 날짜가 바뀌었으면 오늘 방문자를 0으로 초기화
    if (storedDate !== todayDate) {
      todayCount = 0;
      props.setProperty('today_date', todayDate);
    }
    
    // 방문자 1명 추가
    total++;
    todayCount++;
    
    // 구글 서버에 새로운 통계 저장
    props.setProperty('total_visits', total.toString());
    props.setProperty('today_visits', todayCount.toString());
    
    return { total: total, today: todayCount };
  } finally {
    lock.releaseLock();
  }
}