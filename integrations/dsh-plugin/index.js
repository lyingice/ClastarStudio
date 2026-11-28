// Clastar Studio DSH Host Plugin (@local/dsh-clastar-assets)
// Exposes synced Pixel Workshop assets (~/.clastar-studio/dsh-bridge) to:
//   1) AI agent tools: clastar_list_assets, clastar_get_asset, clastar_copy_asset_to_mod_dir
//   2) Web UI endpoints: GET /clastar-assets/index & GET /clastar-assets/file?path=...
//   3) Slash command: /clastar-assets

import { defineTool } from '@deepseek-ai/dsh-tools'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const name = 'clastar-assets'
export const inject = ['tools', 'commands']

const MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.mcmeta': 'application/json; charset=utf-8',
  '.bbmodel': 'application/json; charset=utf-8',
}

function textBlocks(value) {
  return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }]
}

function resolveBridgeDir(config) {
  const fromCfg = typeof config?.bridgeDir === "string" ? config.bridgeDir.trim() : ""
  const fromEnv = (process.env.CLASTAR_DSH_BRIDGE_DIR || "").trim()
  const raw = fromCfg || fromEnv
  if (raw) {
    const expanded = raw.startsWith("~") ? path.join(os.homedir(), raw.slice(1)) : raw
    return path.resolve(expanded)
  }
  return path.resolve(os.homedir(), ".clastar-studio", "dsh-bridge")
}

function safeRelPath(raw) {
  if (typeof raw !== "string") return null
  const norm = raw.replace(/\\/g, "/").trim()
  if (!norm || norm.startsWith("/") || norm.includes(":") || norm.includes("\0")) return null
  const parts = norm.split("/").filter(Boolean)
  if (!parts.length || parts.some((p) => p === "." || p === "..")) return null
  return parts.join("/")
}

function isInsideDir(rootDir, targetPath) {
  const rel = path.relative(rootDir, targetPath)
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))
}

function readIndex(bridgeDir) {
  const indexFile = path.join(bridgeDir, "index.json")
  if (!fs.existsSync(indexFile)) return { exists: false, indexFile, data: null }
  const data = JSON.parse(fs.readFileSync(indexFile, "utf8"))
  return { exists: true, indexFile, data }
}

function resolveEntry(data, bridgeDir, { ref = "", id = "", name = "" } = {}) {
  const filesRoot = path.join(bridgeDir, "files")
  const assets = Array.isArray(data?.assets) ? data.assets : []
  const models = Array.isArray(data?.models) ? data.models : []

  for (const a of assets) {
    if ((ref && a.ref === ref) || (id && a.id === id) || (name && a.name === name)) {
      const resolvedFiles = (a.paths || []).map((rel) => {
        const safe = safeRelPath(rel)
        const abs = safe ? path.resolve(filesRoot, safe) : null
        const ok = Boolean(abs && isInsideDir(filesRoot, abs) && fs.existsSync(abs) && fs.statSync(abs).isFile())
        return { relPath: rel, absPath: ok ? abs : null, exists: ok }
      })
      return { type: "asset", item: { ...a, resolvedFiles } }
    }
  }

  for (const m of models) {
    if ((ref && m.ref === ref) || (id && m.id === id) || (name && m.name === name)) {
      const resolvedParts = (m.parts || []).map((p) => {
        const safe = safeRelPath(p.path || "")
        const abs = safe ? path.resolve(filesRoot, safe) : null
        const ok = Boolean(abs && isInsideDir(filesRoot, abs) && fs.existsSync(abs) && fs.statSync(abs).isFile())
        return { ...p, relPath: p.path, absPath: ok ? abs : null, exists: ok }
      })
      return { type: "model", item: { ...m, resolvedParts } }
    }
    for (const p of (m.parts || [])) {
      if ((ref && p.ref === ref) || (id && p.id === id)) {
        const safe = safeRelPath(p.path || "")
        const abs = safe ? path.resolve(filesRoot, safe) : null
        const ok = Boolean(abs && isInsideDir(filesRoot, abs) && fs.existsSync(abs) && fs.statSync(abs).isFile())
        return { type: "model_part", item: { ...p, relPath: p.path, absPath: ok ? abs : null, exists: ok } }
      }
    }
  }
  return null
}

export function apply(ctx, config = {}) {
  const bridgeDir = resolveBridgeDir(config)
  const attachments = ctx.get?.("attachments")
  const registered = []

  registered.push(ctx.tools.register(defineTool({
    name: "clastar_list_assets",
    description: "列出像素工坊 (Clastar Studio) 已同步的贴图、方块材质、动画、盔甲与 3D 模型资产及其确定性引用句柄。",
    parameters: {
      query: { type: "string", description: "按名称、句柄或路径过滤关键词" },
      kind: { type: "string", description: "按类型过滤：block | item | anim | armor | equip | texture | model" },
      workspace: { type: "string", description: "按工作区名称过滤" },
    },
    output: { schema: { type: "object", additionalProperties: true }, render: (_a, v) => textBlocks(v) },
    async execute(args = {}) {
      let snap
      try {
        snap = readIndex(bridgeDir)
      } catch (err) {
        return { ok: false, error: "读取索引失败: " + (err?.message || err), bridgeDir }
      }
      if (!snap.exists || !snap.data) {
        return { ok: false, error: "尚未找到像素工坊索引，请先在像素工坊点击「DSH 资产索引 -> 同步到 DSH 索引」。", bridgeDir }
      }
      const q = String(args.query || "").trim().toLowerCase()
      const kind = String(args.kind || "").trim().toLowerCase()
      const ws = String(args.workspace || "").trim().toLowerCase()

      const assets = (snap.data.assets || []).filter((a) => {
        if (kind && kind !== "model" && String(a.kind || "").toLowerCase() !== kind) return false
        if (ws && String(a.workspace || "").toLowerCase() !== ws) return false
        if (q) {
          const hay = [a.name, a.ref, a.kind, ...(a.paths || [])].join(" ").toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })

      const models = (!kind || kind === "model") ? (snap.data.models || []).filter((m) => {
        if (!q) return true
        return [m.name, m.ref, m.format].join(" ").toLowerCase().includes(q)
      }) : []

      return {
        ok: true,
        bridgeDir,
        namespace: snap.data.namespace,
        generatedAt: snap.data.generatedAt,
        assets,
        models,
      }
    },
  })))

  registered.push(ctx.tools.register(defineTool({
    name: "clastar_get_asset",
    description: "按精确引用句柄 (clastar:...)、ID 或名称读取资产详情、磁盘实文件路径，及可选图片与 mcmeta/bbmodel 文本。",
    parameters: {
      ref: { type: "string", description: "资产引用句柄，如 clastar:block:pixel_workshop:ruby_ore" },
      id: { type: "string", description: "卡片或模型 ID" },
      name: { type: "string", description: "资产名称" },
      include_text: { type: "boolean", description: "是否附带 .mcmeta / .bbmodel JSON 文本" },
      include_image: { type: "boolean", description: "是否把首张 PNG 贴图作为视觉附件返回" },
    },
    output: { schema: { type: "object", additionalProperties: true }, render: (_a, v) => textBlocks(v) },
    async execute(args = {}) {
      let snap
      try {
        snap = readIndex(bridgeDir)
      } catch (err) {
        return { ok: false, error: "读取索引失败: " + (err?.message || err), bridgeDir }
      }
      if (!snap.exists || !snap.data) {
        return { ok: false, error: "尚未找到像素工坊索引", bridgeDir }
      }
      const hit = resolveEntry(snap.data, bridgeDir, args)
      if (!hit) return { ok: false, error: "未匹配到指定资产或模型" }

      const targets = hit.item.resolvedFiles || hit.item.resolvedParts || (hit.item.absPath ? [hit.item] : [])
      if (args.include_text) {
        for (const f of targets) {
          if (f.absPath && /\.(mcmeta|bbmodel|json)$/i.test(f.absPath) && fs.existsSync(f.absPath)) {
            try { f.text = fs.readFileSync(f.absPath, "utf8") } catch { /* ignore */ }
          }
        }
      }
      let attachment = null
      if (args.include_image && attachments?.saveImage) {
        const pngTarget = targets.find((f) => f.absPath && /\.png$/i.test(f.absPath) && fs.existsSync(f.absPath))
        if (pngTarget) {
          try {
            const data = fs.readFileSync(pngTarget.absPath)
            attachment = await attachments.saveImage({ data, mediaType: "image/png", name: path.basename(pngTarget.absPath) })
          } catch { /* ignore */ }
        }
      }
      return { ok: true, type: hit.type, bridgeDir, item: hit.item, ...(attachment ? { attachment } : {}) }
    },
  })))

  registered.push(ctx.tools.register(defineTool({
    name: "clastar_copy_asset_to_mod_dir",
    description: "将像素工坊导出的真实 PNG / .png.mcmeta / .bbmodel 文件直接复制到目标模组资源根目录下，避免手动或 AI 重写纹理。",
    parameters: {
      ref: { type: "string", description: "资产或模型句柄" },
      id: { type: "string", description: "资产或模型 ID" },
      name: { type: "string", description: "资产或模型名称" },
      target_dir: { type: "string", required: true, description: "目标模组资源根目录（如 src/main/resources 或资源包根目录）" },
      overwrite: { type: "boolean", description: "目标已存在时是否覆盖，默认 true" },
    },
    output: { schema: { type: "object", additionalProperties: true }, render: (_a, v) => textBlocks(v) },
    async execute(args = {}) {
      let snap
      try {
        snap = readIndex(bridgeDir)
      } catch (err) {
        return { ok: false, error: "读取索引失败: " + (err?.message || err), bridgeDir }
      }
      if (!snap.exists || !snap.data) return { ok: false, error: "尚未找到像素工坊索引", bridgeDir }
      const targetRoot = path.resolve(String(args.target_dir || "").trim())
      if (!String(args.target_dir || "").trim()) return { ok: false, error: "缺少 target_dir 参数" }
      const hit = resolveEntry(snap.data, bridgeDir, args)
      if (!hit) return { ok: false, error: "未匹配到指定资产或模型" }

      const overwrite = args.overwrite !== false
      const candidates = hit.item.resolvedFiles || hit.item.resolvedParts || (hit.item.absPath ? [hit.item] : [])
      const copied = []
      for (const c of candidates) {
        const rel = safeRelPath(c.relPath || c.path || "")
        if (!rel || !c.absPath || !fs.existsSync(c.absPath)) continue
        const dest = path.resolve(targetRoot, rel)
        if (!isInsideDir(targetRoot, dest)) return { ok: false, error: "非法目标路径: " + rel }
        if (fs.existsSync(dest) && !overwrite) {
          copied.push({ relPath: rel, destPath: dest, skipped: true })
          continue
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.copyFileSync(c.absPath, dest)
        copied.push({ relPath: rel, destPath: dest, skipped: false })
      }
      return { ok: true, ref: hit.item.ref, targetDir: targetRoot, copied }
    },
  })))

  registered.push(ctx.commands.register({
    name: "clastar-assets",
    description: "查看像素工坊 (Clastar Studio) 已同步到 DSH 的资产索引状态",
    async handler() {
      try {
        const snap = readIndex(bridgeDir)
        if (!snap.exists || !snap.data) {
          return { kind: "success", text: "尚未同步索引。目录：" + bridgeDir + "\n请在像素工坊点击「DSH 资产索引 -> 同步到 DSH 索引」。" }
        }
        const a = (snap.data.assets || []).length
        const m = (snap.data.models || []).length
        return { kind: "success", text: `像素工坊索引就绪：${a} 个资产，${m} 个模型组\n命名空间：${snap.data.namespace || "-"}\n更新时间：${snap.data.generatedAt || "-"}\n目录：${bridgeDir}` }
      } catch (err) {
        return { kind: "error", text: "读取像素工坊索引失败：" + (err?.message || err) }
      }
    },
  }))

  // Web UI endpoints for DSH right-sidebar plugin (inject webServer reactively so startup order never yields 404)
  ctx.inject(["webServer"], (scope) => {
    const webServer = scope.webServer
    if (!webServer?.register) return
    scope.effect(() => webServer.register({
      kind: "exact",
      path: "/clastar-assets/index",
      handler(_req, res) {
        try {
          const snap = readIndex(bridgeDir)
          res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" })
          res.end(JSON.stringify({ ok: true, dir: bridgeDir, indexExists: snap.exists, index: snap.data }))
        } catch (err) {
          res.writeHead(500, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" })
          res.end(JSON.stringify({ ok: false, dir: bridgeDir, error: err?.message || String(err) }))
        }
      },
    }))
    scope.effect(() => webServer.register({
      kind: "exact",
      path: "/clastar-assets/file",
      handler(req, res) {
        try {
          const rawPath = new URL(req.url || "/", "http://localhost").searchParams.get("path") || ""
          const rel = safeRelPath(rawPath)
          if (!rel) {
            res.writeHead(400, { "content-type": "application/json; charset=utf-8" })
            res.end(JSON.stringify({ error: "invalid path" }))
            return
          }
          const filesRoot = path.join(bridgeDir, "files")
          const target = path.resolve(filesRoot, rel)
          if (!isInsideDir(filesRoot, target) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
            res.writeHead(404, { "content-type": "application/json; charset=utf-8" })
            res.end(JSON.stringify({ error: "not found" }))
            return
          }
          const ext = path.extname(target).toLowerCase()
          res.writeHead(200, {
            "content-type": MIME_MAP[ext] || "application/octet-stream",
            "cache-control": "no-store",
          })
          res.end(fs.readFileSync(target))
        } catch {
          res.writeHead(500, { "content-type": "application/json; charset=utf-8" })
          res.end(JSON.stringify({ error: "read failed" }))
        }
      },
    }))
  })

  ctx.effect(() => () => {
    for (const dispose of registered) { try { dispose?.() } catch {} }
  })
}
