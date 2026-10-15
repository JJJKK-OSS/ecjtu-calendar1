export const DEFAULT_PERIOD_TIMES = {
  "1": ["08:00", "08:45"],
  "2": ["08:55", "09:40"],
  "3": ["10:20", "11:05"],
  "4": ["11:15", "12:00"],
  "5": ["14:00", "14:45"],
  "6": ["14:55", "15:40"],
  "7": ["16:10", "16:55"],
  "8": ["17:05", "17:50"],
  "9": ["19:00", "19:45"],
  "10": ["19:55", "20:40"]
};

export const EARLY_MORNING_PERIOD_TIMES = {
  ...DEFAULT_PERIOD_TIMES,
  "3": ["10:05", "10:50"],
  "4": ["10:55", "11:40"]
};

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function cleanText(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n +/g, "\n")
    .trim();
}

export function parseDayHtml(html, date) {
  const events = [];
  const listMatch = html.match(/<ul\s+class=["']rl_info["'][^>]*>([\s\S]*?)<\/ul>/i);
  if (!listMatch) {
    if (/教务综合管理系统|请输入密码|微信扫一扫登录/.test(html)) {
      throw new Error("数据源跳转到了登录页");
    }
    throw new Error("没有找到课表列表，学校页面格式可能已经改变");
  }

  const itemPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  for (const match of listMatch[1].matchAll(itemPattern)) {
    const text = cleanText(
      match[1]
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
    );
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const periodLine = lines.find((line) => /\d+\s*[-–—]\s*\d+节/.test(line));
    const periodMatch = periodLine?.match(/(\d+)\s*[-–—]\s*(\d+)节/);
    const timeLine = lines.find((line) => line.startsWith("时间："));
    const locationLine = lines.find((line) => line.startsWith("地点："));
    const teacherLine = lines.find((line) => line.startsWith("教师："));
    const course = lines.find((line) =>
      line !== periodLine &&
      !line.startsWith("时间：") &&
      !line.startsWith("地点：") &&
      !line.startsWith("教师：")
    );

    if (!periodMatch || !course) continue;
    events.push({
      date,
      startPeriod: Number(periodMatch[1]),
      endPeriod: Number(periodMatch[2]),
      summary: course.replace(/\((上课|实验|实践|考试)\)\s*$/, ""),
      type: course.match(/\((上课|实验|实践|考试)\)\s*$/)?.[1] || "课程",
      weekText: timeLine?.slice(3).trim() || "",
      location: locationLine?.slice(3).trim() || "",
      teacher: teacherLine?.slice(3).trim() || ""
    });
  }
  return events;
}

function usesEarlyMorningSchedule(location = "") {
  const value = location.replace(/\s+/g, "");
  if (/(南区)?教?25(?:栋|-)/.test(value)) return true;

  const north31 = value.match(/(?:北区)?教?31(?:栋|-).*?([2-6])\d{2}/);
  if (north31) return !["4", "5", "6"].includes(north31[1]);

  if (/(?:南区)?教?(?:14|6|10|38)(?:栋|-)|图书馆|南图|北图/.test(value)) return false;
  return true;
}

export function periodTimesForEvent(event) {
  return usesEarlyMorningSchedule(event.location)
    ? EARLY_MORNING_PERIOD_TIMES
    : DEFAULT_PERIOD_TIMES;
}

export function semesterDates(firstMonday, semesterWeeks) {
  const base = new Date(`${firstMonday}T00:00:00+08:00`);
  if (Number.isNaN(base.getTime())) throw new Error("semesterFirstMonday 日期格式不正确");
  return Array.from({ length: semesterWeeks * 7 }, (_, index) => {
    const d = new Date(base.getTime() + index * 86400000);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  });
}

function escapeIcs(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function utcStamp(date, time) {
  return new Date(`${date}T${time}:00+08:00`)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function hash(input) {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(16).padStart(8, "0");
}

function foldLine(line) {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 73) return line;
  const chunks = [];
  let current = "";
  for (const char of line) {
    if (encoder.encode(current + char).length > 72) {
      chunks.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) chunks.push(current);
  return chunks.join("\r\n ");
}

export function buildCalendar(events, options = {}) {
  const alarmMinutes = Number(options.alarmMinutes ?? 15);
  const calendarName = options.calendarName || "我的课表";
  const generatedAt = options.generatedAt || new Date().toISOString();
  const dtstamp = generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const unique = new Map();

  for (const event of events) {
    const key = [event.date, event.startPeriod, event.endPeriod, event.summary, event.location].join("|");
    unique.set(key, event);
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ECJTU GitHub Calendar//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    "X-WR-TIMEZONE:Asia/Shanghai",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H"
  ];

  const sorted = [...unique.values()].sort((a, b) =>
    `${a.date}-${String(a.startPeriod).padStart(2, "0")}`.localeCompare(
      `${b.date}-${String(b.startPeriod).padStart(2, "0")}`
    )
  );

  for (const event of sorted) {
    const times = periodTimesForEvent(event);
    const startPair = times[String(event.startPeriod)];
    const endPair = times[String(event.endPeriod)];
    if (!startPair || !endPair) continue;
    const identity = [event.date, event.startPeriod, event.endPeriod, event.summary, event.location].join("|");
    const description = [
      event.teacher && `教师：${event.teacher}`,
      `节次：${event.startPeriod}-${event.endPeriod}节`,
      event.weekText && `原课表：${event.weekText}`,
      event.type && `类型：${event.type}`
    ].filter(Boolean).join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${hash(identity)}@ecjtu-calendar`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${utcStamp(event.date, startPair[0])}`,
      `DTEND:${utcStamp(
        event.date,
        event.startPeriod === 5 && event.endPeriod === 7 ? "16:35" : endPair[1]
      )}`,
      `SUMMARY:${escapeIcs(event.summary)}`,
      `LOCATION:${escapeIcs(event.location)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "CATEGORIES:课程"
    );
    if (Number.isFinite(alarmMinutes) && alarmMinutes > 0) {
      lines.push(
        "BEGIN:VALARM",
        `TRIGGER:-PT${Math.floor(alarmMinutes)}M`,
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeIcs(event.summary)}`,
        "END:VALARM"
      );
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
