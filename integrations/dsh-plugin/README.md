# Clastar Studio DSH 资产插件 (@local/dsh-clastar-assets)

为 DSH（DeepSeek Harness）提供 **像素工坊（Clastar Studio）** 资产索引侧边栏面板与 AI 工具，避免 AI 编写模组时幻觉资产路径或擅自重画贴图。

## 安装到 DSH

在命令行将本目录添加进目标 profile（例如 `desktop`）：

```bash
dsh plugin --profile desktop add "D:/0CreaterMods/Github/CLAstarStudio/integrations/dsh-plugin"
```

安装后重启 DSH 即可生效。

## 使用流程

1. 在像素工坊中打开右侧快捷栏 **「DSH 资产索引」 -> 「同步到 DSH 索引」**（默认写入 `~/.clastar-studio/dsh-bridge/`，可用环境变量 `CLASTAR_DSH_BRIDGE_DIR` 覆盖）。
2. 在 DSH 右侧栏打开 **「像素工坊」** 标签页：
   - 浏览像素缩略图，按 `方块 / 物品 / 动画 / 盔甲 / 模型` 筛选或按关键字搜索；
   - 点击 **「插入」** 可把 `[clastar:<kind>:<namespace>:<slug>]` 句柄直接写入当前对话输入框；
   - 点击 **「复制」** 可复制完整引用句柄。
3. AI 对话中会自动拥有工具：
   - `clastar_list_assets`：列出已定稿资产与模型；
   - `clastar_get_asset`：读取精确磁盘路径、`mcmeta` / `bbmodel` 元数据与贴图预览；
   - `clastar_copy_asset_to_mod_dir`：把实文件直接复制到目标模组资源目录。
4. 聊天快捷命令：输入 `/clastar-assets` 可快速查看当前索引同步状态。
