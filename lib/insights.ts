import { DailyEntry } from './types';

export type EncouragementStyle = 'gentle' | 'direct' | 'energetic' | 'minimal';

export const encouragementStyles: Array<{ key: EncouragementStyle; label: string }> = [
  { key: 'gentle', label: '温柔型' },
  { key: 'direct', label: '直接型' },
  { key: 'energetic', label: '元气型' },
  { key: 'minimal', label: '极简型' },
];

const styleStorageKey = 'wish_health_encouragement_style';

export function getEncouragementStyle(): EncouragementStyle {
  if (typeof window === 'undefined') return 'gentle';
  const saved = localStorage.getItem(styleStorageKey);
  return isEncouragementStyle(saved) ? saved : 'gentle';
}

export function saveEncouragementStyle(style: EncouragementStyle): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(styleStorageKey, style);
}

function isEncouragementStyle(value: string | null): value is EncouragementStyle {
  return value === 'gentle' || value === 'direct' || value === 'energetic' || value === 'minimal';
}

export function sortEntriesDesc(entries: DailyEntry[]): DailyEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

export function getEntriesWithinDays(entries: DailyEntry[], days: number): DailyEntry[] {
  const today = startOfLocalDay(new Date());
  const start = new Date(today);
  start.setDate(today.getDate() - days + 1);
  return entries.filter((entry) => {
    const date = parseDate(entry.date);
    return date >= start && date <= today;
  });
}

export function buildWeeklySummary(entries: DailyEntry[]): string {
  const weekEntries = getEntriesWithinDays(entries, 7);
  if (weekEntries.length === 0) {
    return '这周还没有记录。先从今天的一小条开始就很好。';
  }

  const sleepEntries = weekEntries.filter((entry) => entry.sleep);
  const moodEntries = weekEntries.filter((entry) => entry.mood);
  const exerciseMinutes = weekEntries.reduce((sum, entry) => sum + (entry.exercise?.duration || 0), 0);
  const stomachIssues = weekEntries.reduce((sum, entry) => {
    return sum + entry.diet.filter((item) => item.stomachFeeling === 'pain' || item.stomachFeeling === 'uncomfortable').length;
  }, 0);
  const gratitudeDays = weekEntries.filter((entry) => entry.gratitude.trim()).length;

  const parts = [`这周记录了 ${weekEntries.length} 天`];
  if (sleepEntries.length > 0) {
    const avgSleep = sleepEntries.reduce((sum, entry) => sum + (entry.sleep?.hours || 0), 0) / sleepEntries.length;
    parts.push(`平均睡眠 ${avgSleep.toFixed(1)} 小时`);
  }
  if (moodEntries.length > 0) {
    const avgAnxiety = moodEntries.reduce((sum, entry) => sum + (entry.mood?.anxietyLevel || 0), 0) / moodEntries.length;
    parts.push(`平均焦虑 ${avgAnxiety.toFixed(1)}/5`);
  }
  if (exerciseMinutes > 0) parts.push(`运动 ${exerciseMinutes} 分钟`);
  if (stomachIssues > 0) parts.push(`肠胃不适 ${stomachIssues} 次`);
  if (gratitudeDays > 0) parts.push(`${gratitudeDays} 天写下了感恩`);

  return `${parts.join('，')}。这些线索会让你更容易照顾自己。`;
}

export function buildStreakMessage(totalDays: number, streak: number): string {
  if (totalDays === 0) return '今天先留下一条小记录。';
  if (streak >= 14) return `你已经陪自己连续 ${streak} 天了，稳定得很漂亮。`;
  if (streak >= 7) return `连续 ${streak} 天记录了，已经形成一个很好的节奏。`;
  if (streak >= 3) return `连续 ${streak} 天了，照顾自己正在变成习惯。`;
  return `已经记录 ${totalDays} 天，每一次都算数。`;
}

export function buildHealthAlerts(entries: DailyEntry[]): string[] {
  const sorted = sortEntriesDesc(entries);
  const lastSeven = getEntriesWithinDays(entries, 7);
  const alerts: string[] = [];
  const recentSleep = sorted.filter((entry) => entry.sleep).slice(0, 3);
  const recentMood = sorted.filter((entry) => entry.mood).slice(0, 3);
  const stomachIssueCount = lastSeven.reduce((sum, entry) => {
    return sum + entry.diet.filter((item) => item.stomachFeeling === 'pain' || item.stomachFeeling === 'uncomfortable').length;
  }, 0);

  if (recentSleep.length >= 2 && recentSleep.filter((entry) => (entry.sleep?.hours || 0) < 6).length >= 2) {
    alerts.push('最近睡眠偏少，可以把今晚的休息优先级放高一点。');
  }

  if (recentMood.length >= 2 && recentMood.filter((entry) => (entry.mood?.anxietyLevel || 0) >= 4).length >= 2) {
    alerts.push('最近焦虑分数偏高，先减少一点额外消耗，给自己留出缓冲。');
  }

  if (stomachIssueCount >= 3) {
    alerts.push('这周肠胃不适出现较多，饮食先尽量清淡、温热、规律。');
  }

  if (alerts.length === 0 && sorted.length > 0) {
    alerts.push('最近没有明显异常，继续保持这种轻轻记录的节奏。');
  }

  return alerts;
}

export function downloadEntriesCsv(entries: DailyEntry[], filename = 'health-records.csv'): void {
  if (typeof window === 'undefined') return;
  const csv = buildEntriesCsv(entries);
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function openPrintableReport(entries: DailyEntry[], title = '健康记录报告'): void {
  if (typeof window === 'undefined') return;
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) return;

  reportWindow.document.write(buildPrintableHtml(entries, title));
  reportWindow.document.close();
  reportWindow.focus();
  window.setTimeout(() => reportWindow.print(), 300);
}

export function buildEntriesCsv(entries: DailyEntry[]): string {
  const rows = [
    ['日期', '饮食', '情绪', '焦虑分', '睡眠小时', '睡眠质量', '生理期', '运动', '感恩', '原文'],
    ...sortEntriesDesc(entries).map((entry) => [
      entry.date,
      entry.diet.map((item) => `${item.food}(${item.stomachFeeling})`).join('；'),
      entry.mood?.mood || '',
      entry.mood?.anxietyLevel?.toString() || '',
      entry.sleep?.hours?.toString() || '',
      entry.sleep?.quality || '',
      entry.period ? `${entry.period.day}/${entry.period.flow}` : '',
      entry.exercise ? `${entry.exercise.type} ${entry.exercise.duration}min` : '',
      entry.gratitude,
      entry.rawText || '',
    ]),
  ];

  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function buildPrintableHtml(entries: DailyEntry[], title: string): string {
  const sorted = sortEntriesDesc(entries);
  const rows = sorted.map((entry) => `
    <section>
      <h2>${escapeHtml(entry.date)}</h2>
      <p><strong>饮食：</strong>${escapeHtml(entry.diet.map((item) => `${item.food}（${item.stomachFeeling}）`).join('；') || '未记录')}</p>
      <p><strong>情绪：</strong>${escapeHtml(entry.mood ? `${entry.mood.mood}，焦虑 ${entry.mood.anxietyLevel}/5` : '未记录')}</p>
      <p><strong>睡眠：</strong>${escapeHtml(entry.sleep ? `${entry.sleep.hours} 小时，${entry.sleep.quality}` : '未记录')}</p>
      <p><strong>生理期：</strong>${escapeHtml(entry.period ? `${entry.period.day}，${entry.period.flow}` : '未记录')}</p>
      <p><strong>运动：</strong>${escapeHtml(entry.exercise ? `${entry.exercise.type} ${entry.exercise.duration} 分钟` : '未记录')}</p>
      <p><strong>今日感恩：</strong>${escapeHtml(entry.gratitude || '未记录')}</p>
      ${entry.rawText ? `<p><strong>原文：</strong>${escapeHtml(entry.rawText)}</p>` : ''}
    </section>
  `).join('');

  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #333; padding: 32px; line-height: 1.65; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        section { border-top: 1px solid #ddd; padding: 16px 0; break-inside: avoid; }
        h2 { font-size: 18px; margin: 0 0 8px; }
        p { margin: 4px 0; white-space: pre-wrap; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <p>共 ${sorted.length} 条记录，生成时间：${escapeHtml(new Date().toLocaleString('zh-CN'))}</p>
      ${rows || '<p>暂无记录</p>'}
    </body>
  </html>`;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
