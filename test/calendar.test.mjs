import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCalendar,
  parseDayHtml,
  semesterDates
} from "../shared/calendar.mjs";

const SAMPLE = `
<ul class="rl_info">
  <li><p>
    <span class="class_span">1-2节<br /></span>
    电路原理Ⅱ(上课)<br />
    时间：1-8,10-15 1,2<br />
    地点：14-206<br />
    教师：张老师<br />
  </p></li>
</ul>`;

test("解析微信课表页面", () => {
  const rows = parseDayHtml(SAMPLE, "2026-09-03");
  assert.deepEqual(rows[0], {
    date: "2026-09-03",
    startPeriod: 1,
    endPeriod: 2,
    summary: "电路原理Ⅱ",
    type: "上课",
    weekText: "1-8,10-15 1,2",
    location: "14-206",
    teacher: "张老师"
  });
});

test("生成整个学期的日期", () => {
  const dates = semesterDates("2026-08-31", 20);
  assert.equal(dates.length, 140);
  assert.equal(dates[0], "2026-08-31");
  assert.equal(dates.at(-1), "2027-01-17");
});

test("生成 Apple 日历兼容 ICS", () => {
  const event = parseDayHtml(SAMPLE, "2026-09-03")[0];
  const ics = buildCalendar([event], { generatedAt: "2026-10-15T00:00:00.000Z" });
  assert.match(ics, /BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20260903T000000Z/);
  assert.match(ics, /DTEND:20260903T014000Z/);
  assert.match(ics, /SUMMARY:电路原理Ⅱ/);
  assert.match(ics, /BEGIN:VALARM/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});

test("按教学楼选择上午第3、4节时间", () => {
  const base = {
    date: "2026-09-03",
    startPeriod: 3,
    endPeriod: 4,
    summary: "测试课程",
    type: "上课",
    weekText: "1-16 3,4",
    teacher: "张老师"
  };
  const late = buildCalendar([{ ...base, location: "14-206" }], {
    generatedAt: "2026-10-15T00:00:00.000Z"
  });
  const early = buildCalendar([{ ...base, location: "25-301" }], {
    generatedAt: "2026-10-15T00:00:00.000Z"
  });
  assert.match(late, /DTSTART:20260903T022000Z/);
  assert.match(late, /DTEND:20260903T040000Z/);
  assert.match(early, /DTSTART:20260903T020500Z/);
  assert.match(early, /DTEND:20260903T034000Z/);
});

test("下午提前半小时且晚上不变", () => {
  const common = {
    date: "2026-09-03",
    summary: "测试课程",
    type: "上课",
    weekText: "1-16",
    location: "14-206",
    teacher: "张老师"
  };
  const afternoon = buildCalendar([{ ...common, startPeriod: 5, endPeriod: 6 }], {
    generatedAt: "2026-10-15T00:00:00.000Z"
  });
  const continuous = buildCalendar([{ ...common, startPeriod: 5, endPeriod: 7 }], {
    generatedAt: "2026-10-15T00:00:00.000Z"
  });
  const evening = buildCalendar([{ ...common, startPeriod: 9, endPeriod: 10 }], {
    generatedAt: "2026-10-15T00:00:00.000Z"
  });
  assert.match(afternoon, /DTSTART:20260903T060000Z/);
  assert.match(afternoon, /DTEND:20260903T074000Z/);
  assert.match(continuous, /DTEND:20260903T083500Z/);
  assert.match(evening, /DTSTART:20260903T110000Z/);
  assert.match(evening, /DTEND:20260903T124000Z/);
});
