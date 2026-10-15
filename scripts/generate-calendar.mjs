import { mkdir, writeFile } from "node:fs/promises";
import { CONFIG } from "../config.mjs";
import {
  buildCalendar,
  mapConcurrent,
  parseDayHtml,
  semesterDates
} from "../shared/calendar.mjs";

const SOURCE = "https://jwxt.ecjtu.edu.cn/weixin/CalendarServlet";
const weiXinId = process.env.ECJTU_WEIXIN_ID;

if (!weiXinId) {
  throw new Error("缺少 GitHub Secret：ECJTU_WEIXIN_ID");
}

async function fetchHtml(date) {
  let lastError;
  for (let attempt = 1; attempt <= CONFIG.requestAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
    try {
      const url = new URL(SOURCE);
      url.searchParams.set("weiXinID", weiXinId);
      url.searchParams.set("date", date);
      const response = await fetch(url, {
        headers: { "user-agent": "ECJTU-GitHub-Calendar/1.0" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < CONFIG.requestAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(lastError?.message || "请求失败");
}

const dates = semesterDates(CONFIG.semesterFirstMonday, CONFIG.semesterWeeks);
const failures = [];
const batches = await mapConcurrent(dates, CONFIG.fetchConcurrency, async (date) => {
  try {
    return parseDayHtml(await fetchHtml(date), date);
  } catch (error) {
    failures.push(`${date}: ${error?.message || String(error)}`);
    return [];
  }
});

if (failures.length) {
  console.error(`有 ${failures.length} 天读取失败；为避免清空旧课表，本次不发布。`);
  for (const failure of failures.slice(0, 20)) console.error(failure);
  throw new Error("课表读取不完整");
}

const events = batches.flat();
if (!events.length) {
  throw new Error("整个学期没有解析到任何课程；为避免覆盖旧课表，本次不发布");
}

const generatedAt = new Date().toISOString();
const calendar = buildCalendar(events, {
  alarmMinutes: CONFIG.alarmMinutes,
  calendarName: CONFIG.calendarName,
  generatedAt
});

const updated = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
}).format(new Date(generatedAt));

const indexHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>我的课表订阅</title>
  <style>
    :root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f3f6fb; color: #152033; }
    main { width: min(92vw, 520px); box-sizing: border-box; padding: 32px; border-radius: 24px; background: white; box-shadow: 0 18px 50px #20304a1a; }
    h1 { margin: 0 0 10px; font-size: 28px; }
    p { line-height: 1.65; color: #566174; }
    .button { display: block; margin: 20px 0 12px; padding: 15px 18px; border-radius: 14px; text-align: center; text-decoration: none; font-weight: 700; background: #1473e6; color: white; }
    button { width: 100%; padding: 13px; border: 1px solid #cbd3df; border-radius: 12px; background: transparent; color: inherit; font: inherit; }
    small { display: block; margin-top: 22px; color: #798395; }
    @media (prefers-color-scheme: dark) { body { background: #10141c; color: #eef3fb; } main { background: #1b2230; } p { color: #b9c3d2; } }
  </style>
</head>
<body>
  <main>
    <h1>我的课表</h1>
    <p>共 ${events.length} 节课程。点击下面按钮，在 iPhone 上添加为订阅日历；Apple Watch 会随 iPhone/iCloud 同步。</p>
    <a class="button" id="subscribe" href="calendar.ics">在 iPhone 上订阅</a>
    <button id="copy" type="button">复制 HTTPS 订阅链接</button>
    <small>上次更新：${updated}（北京时间）</small>
  </main>
  <script>
    const httpsUrl = new URL("calendar.ics", location.href).href;
    document.querySelector("#subscribe").href = httpsUrl.replace(/^https:/, "webcal:");
    document.querySelector("#copy").addEventListener("click", async (event) => {
      await navigator.clipboard.writeText(httpsUrl);
      event.currentTarget.textContent = "已复制";
    });
  </script>
</body>
</html>`;

await mkdir("docs", { recursive: true });
await writeFile("docs/calendar.ics", calendar, "utf8");
await writeFile("docs/index.html", indexHtml, "utf8");
await writeFile("docs/.nojekyll", "", "utf8");

console.log(`生成完成：${events.length} 节课程，${dates.length} 天，${updated}（北京时间）`);
