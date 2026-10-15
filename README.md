# 华东交通大学课表订阅（全 GitHub 版）

把学校微信课表转换成 iPhone、iCloud 日历和 Apple Watch 可订阅的 `.ics` 链接。

只使用两个 GitHub 自带功能：

- GitHub Actions：北京时间每天约 03:23 读取课表、生成日历。
- GitHub Pages：提供稳定的 HTTPS / Webcal 订阅地址。

学校读取失败时不会覆盖上一次成功结果。默认课前 15 分钟提醒。

## 1. 新建并上传仓库

1. 登录 GitHub，点击右上角 `+` → `New repository`。
2. 仓库名建议填写 `ecjtu-calendar`。
3. 选择 **Public**。GitHub Free 的 Pages 只支持公开仓库；代码不含你的教务标识。
4. 创建仓库后，点击 `uploading an existing file`，把本压缩包解压后的**全部文件**上传。
5. 提交到 `main` 分支。

请确保 `.github` 文件夹也已上传。macOS Finder 可用 `Command + Shift + .` 显示隐藏文件。

## 2. 保存教务标识

1. 仓库中打开 `Settings`。
2. 左侧进入 `Secrets and variables` → `Actions`。
3. 点击 `New repository secret`。
4. Name 填写：`ECJTU_WEIXIN_ID`
5. Secret 填写原课表链接中 `weiXinID=` 后面的那一段字符，**不要粘贴整个网址**。

这个值只存在 GitHub Secret 中，不会出现在代码、提交记录或 Pages 页面。

## 3. 首次生成课表

1. 打开仓库顶部 `Actions`。
2. 左侧点击“更新课表日历”。
3. 点击 `Run workflow` → 绿色的 `Run workflow`。
4. 等待任务显示绿色对勾，通常需要几分钟。

成功后，仓库的 `docs` 目录会自动出现 `calendar.ics`。之后系统每天自动更新。

如果 Actions 提示没有写入权限：进入 `Settings` → `Actions` → `General` → `Workflow permissions`，选择 `Read and write permissions` 后保存，再运行一次。

## 4. 开启 GitHub Pages

1. 仓库中打开 `Settings` → `Pages`。
2. 在 `Build and deployment` 下，将 `Source` 设为 `Deploy from a branch`。
3. Branch 选择 `main`，文件夹选择 `/docs`，点击 `Save`。
4. 等待一两分钟，页面顶部会显示站点地址。

如果 GitHub 用户名是 `zhangsan`，仓库名是 `ecjtu-calendar`，则：

- 订阅网页：`https://zhangsan.github.io/ecjtu-calendar/`
- ICS 链接：`https://zhangsan.github.io/ecjtu-calendar/calendar.ics`

## 5. 在 iPhone 和 Apple Watch 订阅

最简单的方法：用 iPhone Safari 打开上面的“订阅网页”，点击“在 iPhone 上订阅”。

也可以手动添加：

1. iPhone 打开“日历”App → 底部“日历”。
2. 点击“添加日历”→“添加订阅日历”。
3. 粘贴 ICS 链接并保存。
4. 账户选择 iCloud；Apple Watch 会随 iPhone 同步。

## 已设置的作息时间

上午第 3、4 节会根据教学地点自动选择对应时段：

- 较早：南区教25栋、北区教31栋第2/3层、体育/实践/教学楼外场地。
- 较晚：南区教14栋、教6栋、教10栋、图书馆等，以及北区教31栋第4/5/6层、教38栋。

| 节次 | 时间 |
| --- | --- |
| 1 | 08:00–08:45 |
| 2 | 08:55–09:40 |
| 3 | 10:05–10:50 或 10:20–11:05 |
| 4 | 10:55–11:40 或 11:15–12:00 |
| 5 | 14:00–14:45 |
| 6 | 14:55–15:40 |
| 7 | 16:10–16:55（5–7节连续时结束于16:35） |
| 8 | 17:05–17:50 |
| 9 | 19:00–19:45 |
| 10 | 19:55–20:40 |

## 下学期怎么改

打开 `config.mjs`，修改：

- `semesterFirstMonday`：新学期第一周星期一。
- `semesterWeeks`：教学周数。
- `alarmMinutes`：提前提醒分钟数，填 `0` 可关闭。

提交后 Actions 会自动重新生成。

## 隐私提醒

- 不要把完整微信课表链接或 `weiXinID` 写进代码、README、Issues 或截图。
- Pages 上的 `calendar.ics` 会公开课程名称、教师和教室。链接不要随意分享。
- 若将来不再使用，在仓库 `Settings` → `Pages` 中关闭站点，并删除仓库 Secret。

## 本地测试

```bash
npm test
```
