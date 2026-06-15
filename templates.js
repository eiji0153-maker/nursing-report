export const TEMPLATES = [
  {
    id: 'sns-rehab',
    label: 'SNS報告（リハビリ）',
    type: 'sns',
    category: 'rehab',
    fields: ['visitDate', 'vitals', 'carepalette'],
    generate: (data) => {
      const lines = [];
      lines.push('いつもお世話になっております。');
      lines.push(`本日のリハビリの報告です。`);
      lines.push('');
      if (data.vitals) lines.push(data.vitals);
      if (data.carepalette) lines.push(data.carepalette);
      lines.push('');
      lines.push('以上報告です。今後もよろしくお願い致します。');
      return lines.join('\n');
    }
  },
  {
    id: 'sns-nursing',
    label: 'SNS報告（看護）',
    type: 'sns',
    category: 'nursing',
    fields: ['visitDate', 'vitals', 'carepalette'],
    generate: (data) => {
      const lines = [];
      lines.push('お世話になっております。本日訪問のご報告です。');
      lines.push('');
      if (data.vitals) lines.push(formatVitals(data.vitals));
      lines.push('');
      if (data.carepalette) lines.push(data.carepalette);
      lines.push('');
      lines.push('ご報告以上です。よろしくお願い致します。');
      return lines.join('\n');
    }
  },
  {
    id: 'fax-status',
    label: 'FAX（状態報告）',
    type: 'fax',
    category: 'status',
    fields: ['visitDate', 'vitals', 'carepalette', 'nextVisit'],
    generate: (data) => {
      const lines = [];
      lines.push('いつもお世話になっております。');
      lines.push('');
      lines.push(`本日の訪問状況についてご報告いたします。`);
      lines.push('');
      if (data.vitals) {
        lines.push('【バイタルサイン】');
        lines.push(formatVitals(data.vitals));
        lines.push('');
      }
      if (data.carepalette) {
        lines.push('【訪問内容・経過】');
        lines.push(data.carepalette);
        lines.push('');
      }
      if (data.nextVisit) {
        lines.push(`【次回訪問予定】${data.nextVisit}`);
        lines.push('');
      }
      lines.push('引き続きよろしくお願い致します。');
      return lines.join('\n');
    }
  },
  {
    id: 'fax-schedule',
    label: 'FAX（スケジュール変更）',
    type: 'fax',
    category: 'schedule',
    fields: ['scheduleFrom', 'scheduleTo', 'scheduleTime', 'scheduleNote'],
    generate: (data) => {
      const lines = [];
      lines.push('日頃よりお世話になっております。');
      lines.push('');
      lines.push(`事業所都合により、訪問スケジュールを変更させていただきたくご連絡いたします。`);
      lines.push('');
      if (data.scheduleFrom) lines.push(`【変更前】${data.scheduleFrom}`);
      if (data.scheduleTo) lines.push(`【変更後】${data.scheduleTo}`);
      if (data.scheduleTime) lines.push(`【時間】${data.scheduleTime}`);
      lines.push('');
      lines.push('ご本人には電話にてご説明し、同意をいただいております。');
      lines.push('');
      if (data.scheduleNote) lines.push(data.scheduleNote);
      lines.push('');
      lines.push('急な変更でご迷惑をおかけして申し訳ありません。');
      lines.push('今後ともよろしくお願い致します。');
      return lines.join('\n');
    }
  },
  {
    id: 'fax-monthly',
    label: 'FAX（月次報告）',
    type: 'fax',
    category: 'monthly',
    fields: ['reportMonth', 'visitCount', 'vitalsTrend', 'carepalette', 'nextPlan'],
    generate: (data) => {
      const lines = [];
      lines.push('いつもお世話になっております。');
      lines.push('');
      const month = data.reportMonth || '';
      lines.push(`${month}分の訪問看護サービス提供状況についてご報告いたします。`);
      lines.push('');
      if (data.visitCount) {
        lines.push(`【訪問回数】${data.visitCount}回`);
        lines.push('');
      }
      if (data.vitalsTrend) {
        lines.push('【バイタル傾向】');
        lines.push(data.vitalsTrend);
        lines.push('');
      }
      if (data.carepalette) {
        lines.push('【経過サマリー】');
        lines.push(data.carepalette);
        lines.push('');
      }
      if (data.nextPlan) {
        lines.push('【今後の方針】');
        lines.push(data.nextPlan);
        lines.push('');
      }
      lines.push('引き続きよろしくお願い致します。');
      return lines.join('\n');
    }
  },
  {
    id: 'fax-emergency',
    label: 'FAX（緊急連絡）',
    type: 'fax',
    category: 'emergency',
    fields: ['visitDate', 'vitals', 'carepalette', 'action'],
    generate: (data) => {
      const lines = [];
      lines.push('【緊急連絡】');
      lines.push('');
      lines.push('お世話になっております。緊急のご連絡です。');
      lines.push('');
      if (data.vitals) {
        lines.push('【バイタルサイン】');
        lines.push(formatVitals(data.vitals));
        lines.push('');
      }
      if (data.carepalette) {
        lines.push('【状況】');
        lines.push(data.carepalette);
        lines.push('');
      }
      if (data.action) {
        lines.push('【対応内容】');
        lines.push(data.action);
        lines.push('');
      }
      lines.push('ご確認の上、ご指示いただけますようお願いいたします。');
      return lines.join('\n');
    }
  }
];

function formatVitals(v) {
  if (!v) return '';
  return v;
}

export const DEFAULT_PHRASES = [
  { category: '共通', text: '引き続き経過観察を行います。' },
  { category: '共通', text: '主治医と相談の上、対応いたします。' },
  { category: '共通', text: '今後もよろしくお願い致します。' },
  { category: '共通', text: 'ご本人・ご家族には説明済みです。' },
  { category: 'リハビリ', text: '日常生活動作は以前と変化なく経過されています。' },
  { category: 'リハビリ', text: 'リハビリへの意欲は良好です。' },
  { category: 'リハビリ', text: '転倒リスクに注意しながら継続しています。' },
  { category: '看護', text: '特に自覚症状の訴えなく経過されています。' },
  { category: '看護', text: 'バイタルサイン安定しています。' },
  { category: '看護', text: '創部の状態は前回と大きな変化ありません。' },
  { category: '看護', text: '服薬管理に問題なく自己管理できています。' },
];

export const MASKING_RULES = [
  { pattern: /様$/, replace: 'ご利用者様' },
];

export function maskPersonalInfo(text, patientName) {
  if (!patientName) return text;
  const names = [patientName];
  const lastName = patientName.split(/\s|　/)[0];
  if (lastName && lastName !== patientName) names.push(lastName);
  let result = text;
  for (const n of names) {
    if (n) result = result.replace(new RegExp(n, 'g'), 'ご利用者様');
  }
  return result;
}
