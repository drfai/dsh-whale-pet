# Coopanion Whale 桌宠素材署名与许可 (COOPANION ATTRIBUTION)

本目录 `whale-pet/assets/coopanion/` 内的 whale 桌宠素材（分层部件 PNG、model.json、
figure.js、rig.js）全部来自开源项目 **Coopanion**，用于 DeepSeek Harness 的 whale-pet
桌宠插件。本文件记录来源、许可与署名义务，随素材一同分发。

## 来源

| 项 | 值 |
|---|---|
| 仓库 | <https://github.com/Pal-AI-Lab/Coopanion> |
| 分支 / 提交 | `main` @ `54dbe58391d8c3d482d3fd199d14e04559aafa52`（2026-09-29，"chore: v0.1.8"） |
| 上游路径 | `packages/cortico-world-desktop-pet/web/whale/`（whale 素材） |
| 渲染引擎 | `packages/cortico-world-desktop-pet/web/rig/rig.js`（figure.js 的 `createRig` 依赖） |
| 作者 | Phant（GitHub: Phantivia；邮箱 phantivia@gmail.com） |
| 上游包 | `cortico-world-desktop-pet`，其 package.json `license: "MIT"` |

## 收录清单（摘要）

- `whale/model.json`（8,289 B）——部件/表情/动画定义
- `whale/figure.js`（32,199 B）——动画引擎
- `whale/rig/rig.js`（8,298 B）——WebGL 分层渲染引擎（figure.js 依赖）
- `whale/tex/`——默认配色（deepseek「原版」）身体部件，25 张 PNG
- `whale/feat/`——默认配色表情部件，25 张 PNG
- `whale/schemes/<名称>/{tex,feat}/`——7 套备选配色 × 各 50 张：chatgpt、claude、
  gemini、harness、kimi、minimax、qwen（model.json 中的第 8 套 "deepseek" 即默认
  tex/feat，不在 schemes/ 目录中）
- 未收录 `whale/thumbs/`（缩略图，非渲染所需）
- `LICENSE`、`THIRD_PARTY_NOTICES.md`、`README-upstream.md`——上游许可与声明原文

素材合计 **403 个文件，10,568,247 字节**；连同三份许可文档 **406 个文件，
10,582,572 字节**。逐文件清单见 `MANIFEST.md`。

## 许可证

**MIT License**，版权所有 **Copyright (c) 2026 Phantivia**。

要点（全文见随附 `LICENSE`，包级 `packages/cortico-world-desktop-pet/LICENSE`
与仓库根 LICENSE 为同一文件，SHA `498d5f18d01558c5fd72289fb9c209818bf65237`）：

- 任何人可免费获得副本，并**无限制地**使用、复制、修改、合并、发布、分发、再许可
  及/或销售本软件及其文档；
- 前提：在软件的所有副本或实质部分中**保留上述版权声明与本许可声明**；
- 软件按「原样」提供，无任何明示或暗示担保；作者或版权持有人不对任何索赔、损害
  或其他责任负责。

## 素材来源声明（上游 THIRD_PARTY_NOTICES.md）

`web/whale/` 的贴图由 **ChatGPT（OpenAI 的图像模型）按参考图生成后拆件**；角色原设
为「溟月」（上善无形）；**DeepSeek 女仆装二次创作参考 ZipZipPipe**。围裙上的标志是
DeepSeek、OpenAI、Anthropic（Claude）、Google（Gemini）、阿里云（通义千问）、
月之暗面（Kimi）、MiniMax 的**商标图形，归各自公司所有**，仅用于标明配色对应哪一
家，**与这些公司没有关联，也不代表其认可**。

## 署名

- 保留本文件与随附 `LICENSE`（MIT 版权声明），以履行 MIT 许可证的署名义务；
- 若修改或二次分发素材，请在修改处注明改动并继续保留上述版权与许可声明；
- 各配色上的品牌商标图形归对应公司所有，插件中请勿暗示这些公司对本插件背书。
