# SIFI NFL — 代码审查修复清单

> 基于 `fix/p0-p1-recovery` 相对 `main` 的两轮 review 整理。目标不是记录所有瑕疵，而是给出一份可执行的修复顺序，优先消除会导致错误比赛结果、错误季后赛、错误存档、错误统计和错误休赛期状态的问题。

## 1. 修复优先级

### P0 - 必须先修

1. **修复 UI Worker 加时赛逻辑**
   - 文件：`src/ui/workers/simWorker.ts`
   - 问题：平局后只递增 `overtimes`，没有执行 `simOvertime()`。
   - 影响：UI 手动比赛在常规时间打平时不会进入真实 OT，季后赛可能直接产出非法结果。
   - 建议：
     - 让 worker 路径复用 `GameSim.run()` 的 OT 行为，或在 worker loop 中显式调用 `sim.simOvertime()`。
     - 避免手写一套和核心逻辑分叉的比赛主循环。
   - 必补测试：
     - 新增 worker 路径的平局进入 OT 测试。
     - 新增季后赛平局必须分出胜负的 worker 集成测试。

2. **修复单败淘汰 bracket 生成与推进**
   - 文件：`src/worker/core/playoffs/index.ts`
   - 问题：
     - 分区轮没有写入 1-4 号种子。
     - winner 推进下一轮时按原始 `matchupId` 计算位置，映射错误。
   - 影响：第一/第二大陆季后赛无法正确产生冠军。
   - 建议：
     - 在 bracket 生成时直接布置 1-4 号种子和外卡对阵落位。
     - 用“当前 round 内索引”而不是全局 `matchupId` 计算下一轮目标。
     - 明确 round 1 -> round 2 -> round 3 -> final 的固定 bracket 拓扑。
   - 必补测试：
     - 新增单败淘汰 bracket 单测。
     - 覆盖 12 队、4 个首轮 bye、最终冠军产出。

### P1 - 高优先级业务错误

3. **修复休赛期后自由球员池与主状态脱节**
   - 文件：`src/worker/api/GameEngine.ts`、`src/ui/components/FreeAgencyView.tsx`
   - 问题：`advanceSeason()` 没把 `state.freeAgents` 带入休赛期，也没在结束后重建 `state.freeAgents`。
   - 影响：自由市场会显示旧名单，和 `players` 主数据不一致。
   - 建议：
     - 统一自由球员来源。
     - 休赛期结束后根据 `players` 重建 `state.freeAgents`，或让 `OffseasonManager` 直接返回新 FA 池。
   - 必补测试：
     - season advance 后，`getFreeAgents()` 与 `players.filter(tid undefined/<0)` 一致。

4. **修复合同到期 off-by-one**
   - 文件：`src/worker/core/season/offseason.ts`
   - 问题：先判断 `years <= 0`，再 `years -= 1`，导致 1 年合同不会在本次休赛期到期。
   - 影响：合同会平白多续一年，`getPendingFreeAgents()` 结果也会误导 UI。
   - 建议：
     - 先消耗当前赛季，再判断是否到期；或改成基于 `exp <= season` 的单一规则。
     - 统一 `years` 与 `exp` 的语义，不要两套时间轴并行漂移。
   - 必补测试：
     - `years === 1` 的球员在 season advance 后必须变成自由球员。
     - 新签 1 年合同的球员下一次休赛期必须到期。

5. **修复 StatsManager 不进入存档边界**
   - 文件：`src/worker/api/GameEngine.ts`、`src/worker/core/stats/StatsManager.ts`
   - 问题：`saveGame()` / `loadGame()` 没有使用 `StatsManager.export()` / `import()`。
   - 影响：
     - 读档后统计会丢失。
     - 同赛季读另一个档时，旧内存统计可能串进新档。
   - 建议：
     - 把 stats 纳入存档结构。
     - `loadGame()` 时显式 reset/import，不能只靠 season 变化触发重置。
   - 必补测试：
     - 同赛季 save/load round-trip 后统计不丢失。
     - 同赛季加载不同存档时，统计不会串档。

6. **修复常规赛/季后赛统计混桶**
   - 文件：`src/worker/core/stats/StatsManager.ts`、`src/ui/components/StatsView.tsx`
   - 问题：season stats 只按 `pid` 存，`playoffs` 标记被第一次初始化结果固定。
   - 影响：常规赛和季后赛统计会合并，榜单和筛选结果错误。
   - 建议：
     - key 至少改成 `(pid, playoffs)`。
     - `getAllPlayerStats()`、league leaders、team player stats 都按该维度聚合。
   - 必补测试：
     - 同一球员常规赛和季后赛各打一场，必须得到两条独立记录。

7. **修复公共存档入口未接 schema/version 校验**
   - 文件：`src/worker/api/GameEngine.ts`、`src/worker/api/storage.ts`、`src/cli/saveManager.ts`
   - 问题：`cli/saveManager.ts` 做了 `zod + schemaVersion`，但 UI/CLI 实际入口仍走未校验的 IDB 路径。
   - 影响：坏档、旧档、半残 state 仍可直接注入运行时。
   - 建议：
     - 明确一个唯一的 save/load contract。
     - UI/CLI 都走同一套 schema/version 校验和迁移逻辑。
   - 必补测试：
     - 对公共 `GameEngine.loadGame()` 做旧版本 / 缺字段 / 畸形结构加载测试。

### P2 - 第二轮 review 补充问题

8. **修复休赛期自动选秀绕过真实 draft pick 所有权**
   - 文件：`src/worker/core/season/offseason.ts`
   - 问题：`runDraft()` 只是按球队排序每轮固定选一次，没有使用真实 `draftPicks` / 交易后的签位所有权。
   - 影响：赛季中交易首轮签后，自动 offseason draft 仍会把签位还给原球队。
   - 建议：
     - 休赛期选秀改为复用当前分支已经建立的真实 `draftPicks` 与 draft order 逻辑。
   - 必补测试：
     - 交易未来签位后执行 season advance，验证签位归属被正确兑现。

9. **修复 Origin Continent 升降级未真正落库到球队**
   - 文件：`src/worker/core/season/offseason.ts`
   - 问题：`applyPromotionRelegation()` 只处理 `miningIsland`，没有更新 `originContinent` 球队的 `leagueIndex`。
   - 影响：起源大陆赛季结果不会影响下赛季联赛归属。
   - 建议：
     - 让 offseason 真正修改 Origin Continent 球队的 league/tier 归属。
     - 和 `seasonManagerV2` 的排程输入保持一致。
   - 必补测试：
     - 起源大陆降级/升级队伍在下一季进入正确 league。

10. **修复 Node 版本声明与脚本能力不一致**
   - 文件：`package.json`、`tools/pre-test.ts`
   - 问题：项目声明 `node >=20`，但脚本广泛使用 `node --run`，Node 20 并不保证支持。
   - 影响：本机 Node 22+ 正常，CI 或其他开发环境用 Node 20 时脚本可能直接失败。
   - 建议：
     - 要么把 engines 提升到真实最低版本。
     - 要么把脚本改回兼容 Node 20 的调用方式。
   - 必补测试：
     - 在 CI 明确锁定支持的 Node 版本矩阵。

11. **修复 `GameSimView` 未按 `gid` 过滤 worker 返回消息**
   - 文件：`src/ui/components/GameSimView.tsx`
   - 问题：`onmessage` 直接接收所有 `event/done/error`，没有校验 `msg.gid === gidRef.current`。
   - 影响：用户快速 `Play Again`、`Reset`、`Pause/Resume` 时，旧比赛的迟到消息可能污染当前 UI。
   - 建议：
     - 在消息处理入口先校验 `gid`。
     - `abort` 后也要保证旧 run 的迟到消息被忽略。
   - 必补测试：
     - 新增 worker 消息乱序 / 迟到消息不会串台的组件测试。

12. **修复 `PromotionRelegationView` 的缓存依赖不完整**
   - 文件：`src/ui/components/PromotionRelegationView.tsx`
   - 问题：
     - `standings` 和 `zones` 的 `useMemo` 没依赖 `season` / `phase` / 实际 standings 数据。
     - `isSeasonComplete` 用 `phase >= 4`，但当前 `SeasonManagerV2` 只会把 phase 推到 `PLAYOFFS = 3`。
   - 影响：页面可能长期显示过期投影；赛季结束后也可能始终停留在 “Season In Progress”。
   - 建议：
     - 用 store 中的真实 standings 或显式把相关状态纳入依赖。
     - 用实际赛季完成条件替代硬编码 `phase >= 4`。
   - 必补测试：
     - 周次推进后页面数据刷新测试。
     - 赛季结束后结果摘要切换测试。

## 2. 推荐修复顺序

1. `simWorker` OT 错误
2. 单败淘汰 bracket 错误
3. offseason 合同到期 + FA 池一致性
4. stats save/load + 常规赛/季后赛拆桶
5. 公共 save/load schema/version 收口
6. offseason draft pick 所有权
7. Origin Continent 升降级持久化
8. Node 版本契约收口

## 3. 第二轮 review 重点检查面

- `simWorker` 是否与 `GameSim.run()` 继续存在分叉。
- playoffs 是否只有 double-elim 有测试，而 single-elim 没测试。
- offseason 是否继续绕过已有的 draft / contract / promotion-relegation 正式逻辑。
- save/load 是否仍存在“CLI 路径有校验、公共 API 路径无校验”的双轨实现。
- stats 是否仍在 UI worker、engine、save/load 三个生命周期边界上不一致。
- 组件层是否存在 worker 消息竞态和 `useMemo` 依赖缺失造成的过期视图。

## 4. 当前测试盲区

- 没看到 single-elimination playoffs 的测试。
- 没看到 `simWorker` / `GameSimView` 的测试。
- 现有 save 相关测试覆盖的是 `src/cli/saveManager.ts`，没有覆盖公共 `GameEngine` 存档路径。
- 没看到 season advance 后自由球员池一致性的测试。
- 没看到 stats save/load round-trip 的测试。

## 5. 当前结论

当前分支不是“代码质量差”，而是“关键路径存在几处高风险业务错误，且这些错误主要落在新增但测试尚未覆盖的路径上”。修完 P0 + P1 后，再看是否还需要第三轮 review。
