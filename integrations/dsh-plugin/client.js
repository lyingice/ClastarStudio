// Clastar Studio DSH Client Plugin (@local/dsh-clastar-assets)
// Registers a right-sidebar "像素工坊" asset browser tab (or panellist fallback)
// plus a composer input-dock bar for one-click [clastar:...] reference insertion.
window.__ModuleLoader__.load({
  id: '@local/dsh-clastar-assets',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const TAB_ID = 'clastar-assets'
    const STYLE_ID = 'clastar-dsh-assets-style'

    const CSS = [
      '.csa-wrap{display:flex;flex-direction:column;height:100%;min-height:0;padding:10px;gap:8px;font-size:12px;color:var(--dsw-alias-label-primary,#e8e8e8)}',
      '.csa-head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.csa-title{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.csa-title b{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.csa-sub{font-size:11px;color:var(--dsw-alias-label-secondary,#9aa0a6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.csa-btn{padding:4px 9px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06));color:inherit;font-size:11px;cursor:pointer;white-space:nowrap}',
      '.csa-btn:hover{border-color:#4c9a2a;background:rgba(76,154,42,.18)}',
      '.csa-btn.pri{background:#4c9a2a;border-color:#5eb838;color:#fff;font-weight:600}',
      '.csa-btn.pri:hover{background:#57ad33}',
      '.csa-search{width:100%;box-sizing:border-box;padding:6px 9px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));background:var(--dsw-alias-bg-layer-1,rgba(0,0,0,.22));color:inherit;font-size:12px;outline:none}',
      '.csa-search:focus{border-color:#4c9a2a}',
      '.csa-chips{display:flex;flex-wrap:wrap;gap:4px}',
      '.csa-chip{padding:3px 8px;border-radius:999px;font-size:11px;cursor:pointer;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.12));background:transparent;color:var(--dsw-alias-label-secondary,#9aa0a6)}',
      '.csa-chip.on{background:rgba(76,154,42,.22);border-color:#4c9a2a;color:#9be675;font-weight:600}',
      '.csa-list{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:6px;padding-right:2px}',
      '.csa-card{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1));background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.03))}',
      '.csa-card:hover{border-color:rgba(76,154,42,.7)}',
      '.csa-thumb{width:38px;height:38px;flex:0 0 38px;border-radius:5px;border:1px solid rgba(0,0,0,.45);background:repeating-conic-gradient(#343434 0 25%,#232323 0 50%) 50%/10px 10px;display:flex;align-items:center;justify-content:center;overflow:hidden}',
      '.csa-thumb img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}',
      '.csa-thumb-badge{font-size:10px;font-weight:700;color:#8be263;font-family:ui-monospace,Consolas,monospace}',
      '.csa-meta{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.csa-name{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.csa-ref{font-size:10.5px;font-family:ui-monospace,Consolas,monospace;color:#8be263;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.csa-info{font-size:10.5px;color:var(--dsw-alias-label-secondary,#9aa0a6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.csa-acts{display:flex;flex-direction:column;gap:4px;flex:0 0 auto}',
      '.csa-empty{padding:16px 10px;border-radius:8px;border:1px dashed var(--dsw-alias-border-l1,rgba(255,255,255,.15));color:var(--dsw-alias-label-secondary,#9aa0a6);line-height:1.55;text-align:center}',
      '.csa-dock{display:flex;align-items:center;gap:8px;padding:5px 10px;margin-bottom:4px;border-radius:8px;border:1px solid rgba(76,154,42,.5);background:rgba(76,154,42,.12);font-size:11.5px}',
      '.csa-dock code{font-family:ui-monospace,Consolas,monospace;color:#8be263;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}',
      '.csa-toast{font-size:11px;color:#8be263}',
    ].join('\n')

    const KIND_LABELS = {
      all: '全部',
      block: '方块',
      item: '物品',
      anim: '动画',
      armor: '盔甲',
      model: '模型',
      texture: '纹理',
    }

    // Shared pending reference & active composer bridge between sidebar and input dock
    let pendingItem = null
    const pendingListeners = new Set()
    let activeDraftBridge = null

    function setPending(item) {
      pendingItem = item
      for (const fn of pendingListeners) { try { fn(item) } catch {} }
    }

    function usePending() {
      const [val, setVal] = React.useState(pendingItem)
      React.useEffect(() => {
        pendingListeners.add(setVal)
        return () => pendingListeners.delete(setVal)
      }, [])
      return val
    }

    function insertSnippetText(currentDraft, snippet) {
      const raw = currentDraft == null ? '' : String(currentDraft)
      if (!raw.trim()) return snippet + ' '
      return raw.replace(/\s+$/, '') + ' ' + snippet + ' '
    }

    async function copyToClipboard(text) {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
          return true
        }
      } catch {}
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        ta.remove()
        return !!ok
      } catch { return false }
    }

    function formatInsertToken(item) {
      return '[' + item.ref + ']'
    }

    function firstPngPath(item) {
      const paths = Array.isArray(item.paths) ? item.paths : []
      return paths.find((p) => /\.png$/i.test(p)) || ''
    }

    function AssetPanel() {
      const [state, setState] = React.useState({ loading: true, error: null, payload: null })
      const [query, setQuery] = React.useState('')
      const [kind, setKind] = React.useState('all')
      const [notice, setNotice] = React.useState('')

      const load = React.useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }))
        try {
          const resp = await fetch('/clastar-assets/index', { cache: 'no-store' })
          if (!resp.ok) throw new Error('HTTP ' + resp.status)
          const payload = await resp.json()
          setState({ loading: false, error: null, payload })
        } catch (err) {
          setState({ loading: false, error: err?.message || String(err), payload: null })
        }
      }, [])

      React.useEffect(() => { load() }, [load])

      const flashNotice = React.useCallback((msg) => {
        setNotice(msg)
        if (typeof setTimeout === 'function') {
          setTimeout(() => setNotice((cur) => (cur === msg ? '' : cur)), 2200)
        }
      }, [])

      const index = state.payload?.index || null
      const allRows = React.useMemo(() => {
        if (!index) return []
        const out = []
        for (const a of (index.assets || [])) {
          out.push({
            key: a.id || a.ref,
            kind: a.kind || "texture",
            name: a.name || a.slug || a.ref,
            ref: a.ref,
            dims: a.dimensions || "",
            ws: a.workspace || "",
            paths: a.paths || [],
            thumb: firstPngPath(a),
          })
        }
        for (const m of (index.models || [])) {
          const parts = Array.isArray(m.parts) ? m.parts : []
          out.push({
            key: m.id || m.ref,
            kind: 'model',
            name: m.name || m.ref,
            ref: m.ref,
            dims: parts.length + ' 部件',
            ws: m.format || 'bbmodel',
            paths: parts.map((p) => p.path).filter(Boolean),
            thumb: '',
          })
        }
        return out
      }, [index])

      const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        return allRows.filter((item) => {
          if (kind !== 'all' && item.kind !== kind) return false
          if (!q) return true
          return (item.name + ' ' + item.ref + ' ' + item.paths.join(' ')).toLowerCase().includes(q)
        })
      }, [allRows, kind, query])

      const handleInsert = async (item) => {
        const token = formatInsertToken(item)
        if (activeDraftBridge?.setDraft) {
          try {
            const next = insertSnippetText(activeDraftBridge.getDraft(), token)
            activeDraftBridge.setDraft(next)
            flashNotice('已插入输入框：' + item.name)
            return
          } catch {}
        }
        setPending(item)
        await copyToClipboard(token)
        flashNotice('已准备引用并复制：' + item.name)
      }

      const handleCopy = async (item) => {
        const ok = await copyToClipboard(formatInsertToken(item))
        flashNotice(ok ? ('已复制：' + item.ref) : item.ref)
      }

      return h('div', { className: 'csa-wrap' },
        h('div', { className: 'csa-head' },
          h('div', { className: 'csa-title' },
            h('b', null, '像素工坊资产索引'),
            h('span', { className: 'csa-sub' },
              state.loading
                ? '正在读取本地索引…'
                : (state.payload?.indexExists && index
                  ? (allRows.length + ' 项 · ' + (index.namespace || 'pixel_workshop'))
                  : '尚未检测到已同步资产'))
          ),
          h('button', { type: 'button', className: 'csa-btn', onClick: load }, '刷新')
        ),
        notice ? h('div', { className: 'csa-toast' }, notice) : null,
        h('input', {
          className: 'csa-search',
          type: 'search',
          value: query,
          placeholder: '搜索名称、clastar: 句柄或路径…',
          onChange: (e) => setQuery(e.target.value),
        }),
        h('div', { className: 'csa-chips' },
          Object.keys(KIND_LABELS).map((k) =>
            h('button', {
              key: k,
              type: 'button',
              className: 'csa-chip' + (kind === k ? ' on' : ''),
              onClick: () => setKind(k),
            }, KIND_LABELS[k])
          )
        ),
        h('div', { className: 'csa-list' },
          state.error
            ? h('div', { className: 'csa-empty' }, '读取失败：' + state.error)
            : (!state.loading && !state.payload?.indexExists)
              ? h('div', { className: 'csa-empty' },
                '未找到索引文件。',
                h('br'),
                '请在像素工坊点击右侧「DSH 资产索引 -> 同步到 DSH 索引」。')
              : filtered.length === 0 && !state.loading
                ? h('div', { className: 'csa-empty' }, '没有匹配的资产或模型。')
                : filtered.slice(0, 120).map((item) =>
                  h('div', { key: item.key, className: 'csa-card' },
                    h('div', { className: 'csa-thumb' },
                      item.thumb
                        ? h('img', { src: '/clastar-assets/file?path=' + encodeURIComponent(item.thumb), alt: item.name })
                        : h('span', { className: 'csa-thumb-badge' }, item.kind === 'model' ? '3D' : item.kind.toUpperCase())
                    ),
                    h('div', { className: 'csa-meta' },
                      h('div', { className: 'csa-name', title: item.name }, item.name),
                      h('div', { className: 'csa-ref', title: item.ref }, item.ref),
                      h('div', { className: 'csa-info' },
                        (KIND_LABELS[item.kind] || item.kind) + (item.dims ? ' · ' + item.dims : '') + (item.ws ? ' · ' + item.ws : '')
                      )
                    ),
                    h('div', { className: 'csa-acts' },
                      h('button', { type: 'button', className: 'csa-btn pri', onClick: () => handleInsert(item) }, '插入'),
                      h('button', { type: 'button', className: 'csa-btn', onClick: () => handleCopy(item) }, '复制')
                    )
                  )
                )
        )
      )
    }

    function ReferenceDock(props) {
      const item = usePending()
      const draft = props.useInput ? props.useInput((s) => s.draft) : ''
      React.useEffect(() => {
        if (!props.inputActions?.setDraft) return undefined
        const setFn = (v) => props.inputActions.setDraft(v)
        activeDraftBridge = {
          getDraft: () => draft,
          setDraft: setFn,
        }
        return () => {
          if (activeDraftBridge?.setDraft === setFn) activeDraftBridge = null
        }
      }, [draft, props.inputActions])

      if (!item) return null
      const token = formatInsertToken(item)
      return h('div', { className: 'csa-dock' },
        h('span', null, '待插入工坊引用'),
        h('code', { title: token }, token),
        h('button', {
          type: 'button',
          className: 'csa-btn pri',
          onClick: () => {
            if (props.inputActions?.setDraft) {
              props.inputActions.setDraft(insertSnippetText(draft, token))
            }
            setPending(null)
          },
        }, '插入输入框'),
        h('button', { type: 'button', className: 'csa-btn', onClick: () => setPending(null) }, '取消')
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
          const styleEl = document.createElement('style')
          styleEl.id = STYLE_ID
          styleEl.textContent = CSS
          document.head.appendChild(styleEl)
          ctx.effect(() => () => { try { styleEl.remove() } catch {} })
        }

        const slots = ctx.slots || ctx.get?.('slots')
        if (!slots) return

        ctx.effect(() => slots.inject('conversation.input.dock', () => slots.register(
          { name: 'conversation.input.dock', id: 'clastar-assets-ref-dock', order: 18 },
          (props) => h(ReferenceDock, { useInput: props.useInput, inputActions: props.inputActions })
        )))

        // Keyed right-sidebar pane slots wait harmlessly until the tab opens
        ctx.effect(() => slots.inject('sidebar.right.pane.tab', () => slots.register(
          { name: 'sidebar.right.pane.tab', key: TAB_ID },
          () => h(AssetPanel, null)
        )))
        ctx.effect(() => slots.inject('sidebar.right.pane.tab.title', () => slots.register(
          { name: 'sidebar.right.pane.tab.title', key: TAB_ID },
          () => h('span', null, '像素工坊')
        )))

        // Wait reactively for sidebarRightTabs rather than sampling synchronously in apply(),
        // otherwise cold page boots miss registration when sidebarRightTabs mounts later.
        const registerRightTab = (scope) => {
          const tabs = scope?.get?.('sidebarRightTabs')
          if (!tabs || typeof tabs.register !== 'function') return
          scope.effect(() => tabs.register({
            id: TAB_ID,
            kind: TAB_ID,
            priority: 'extension',
            title: () => '像素工坊',
            guide: [{
              id: 'open',
              order: 45,
              title: () => '像素工坊资产索引',
              description: () => '在右侧栏浏览像素工坊定稿贴图、动画、方块材质与模型，并一键插入对话引用',
            }],
          }))
        }

        if (typeof ctx.inject === 'function') {
          ctx.inject(['sidebarRightTabs'], registerRightTab)
        } else {
          registerRightTab(ctx)
        }
      },
    }
  },
})
