/* ============================================================
   AI 助手界面：聊天面板 / 配置 / 同意卡片 / 工具日志
   ------------------------------------------------------------
   - 经典脚本，无构建；通过 window.PWAgentUI 暴露
   - 所有用户与工具文本都经 esc() 转义；图片只接受 data:image
   ============================================================ */
(() => {
  const views = new Map();
  const CONSENT_UI_TIMEOUT = 31000;
  const IMAGE_KEYS = new Set(['dataURL', 'thumb', 'full']);

  const PROVIDER_FALLBACK = [
    { id:'openai', name:'OpenAI 兼容', baseUrl:'https://api.openai.com/v1', model:'gpt-4o-mini', hint:'通用 OpenAI 兼容接口' },
    { id:'deepseek', name:'DeepSeek', baseUrl:'https://api.deepseek.com/v1', model:'deepseek-chat', hint:'DeepSeek 开放平台' },
    { id:'moonshot', name:'Moonshot 月之暗面', baseUrl:'https://api.moonshot.cn/v1', model:'moonshot-v1-8k', hint:'Kimi 开放平台' },
    { id:'zhipu', name:'智谱 GLM', baseUrl:'https://open.bigmodel.cn/api/paas/v4', model:'glm-4-flash', hint:'智谱开放平台' },
    { id:'siliconflow', name:'硅基流动', baseUrl:'https://api.siliconflow.cn/v1', model:'Qwen/Qwen2.5-7B-Instruct', hint:'SiliconFlow 模型广场' },
    { id:'dashscope', name:'阿里云百炼', baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1', model:'qwen-plus', hint:'DashScope 兼容模式' },
    { id:'anthropic', name:'Anthropic Claude', baseUrl:'https://api.anthropic.com', model:'claude-3-5-sonnet-latest', hint:'Claude Messages API' },
    { id:'gemini', name:'Google Gemini', baseUrl:'https://generativelanguage.googleapis.com', model:'gemini-1.5-flash', hint:'Gemini generateContent API' },
    { id:'ollama', name:'Ollama 本地', baseUrl:'http://127.0.0.1:11434/v1', model:'llama3.1', hint:'本机 Ollama' },
    { id:'lmstudio', name:'LM Studio 本地', baseUrl:'http://127.0.0.1:1234/v1', model:'local-model', hint:'本机 LM Studio' },
    { id:'custom', name:'自定义', baseUrl:'', model:'', hint:'手动填写兼容接口地址与模型' }
  ];

  const TOOL_LABELS = {
    list_workspaces: '查看工作区',
    list_cards: '查看卡片',
    list_textures: '列出纹理',
    get_texture_colors: '分析纹理颜色',
    list_ramps: '列出色阶',
    list_palettes: '列出色卡',
    search_assets: '搜索素材',
    recolor_texture: '换色预览',
    apply_ramp: '套用色阶',
    generate_variants: '生成变种',
    paint_texture: '绘制纹理',
    save_texture: '保存纹理',
    create_texture_card: '新建纹理卡片',
    export_resource_pack: '导出资源包',
    model_list_formats: '列出模型格式',
    model_list: '列出模型集',
    model_get: '查看模型集',
    model_build: '构建模型',
    model_save: '保存模型',
    model_delete_set: '删除模型集',
    model_delete_part: '移除部件',
    model_export_part: '导出 .bbmodel',
    model_export_set: '导出模型集',
    model_export_library: '备份模型库',
    model_open_blockbench: '在 Blockbench 打开'
  };
  const DESTRUCTIVE_HINTS = {
    save_texture: '会把预览图写回仓库，并覆盖原纹理。',
    create_texture_card: '会在工作区里新建一张纹理卡片。',
    export_resource_pack: '会打包资源并让浏览器下载 ZIP 文件。',
    model_save: '会把模型保存进模型库（新建模型集或加入部件）。',
    model_delete_set: '会从模型库删除整个模型集及其所有部件。',
    model_delete_part: '会从模型集移除一个部件。',
    model_export_part: '会导出 .bbmodel 文件并让浏览器下载。',
    model_export_set: '会打包模型集 ZIP 并让浏览器下载。',
    model_export_library: '会打包整个模型库 ZIP 并让浏览器下载。'
  };

  /* ---------------- 基础工具 ---------------- */
  function A(){ return window.PWAgent; }
  function E(value){
    try{ return esc(value); }
    catch(_){
      return String(value == null ? '' : value).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
    }
  }
  function ico(name, size){
    try{ return typeof iconSVG === 'function' ? iconSVG(name, size) : ''; }
    catch(_){ return ''; }
  }
  function say(message){
    try{ toast(message); }catch(_){}
  }
  function errorText(err){
    if(err == null) return '未知错误';
    if(typeof err === 'string') return err;
    return err.message || String(err);
  }
  function stateSafe(){
    const api = A();
    if(api && typeof api.getState === 'function'){
      const st = api.getState();
      if(st && typeof st === 'object') return st;
    }
    return {
      messages: [], busy:false, config:{}, hasKey:false, keyLocked:false, proxyAvailable:false
    };
  }
  function providerList(){
    const api = A();
    if(api && typeof api.getProviders === 'function'){
      const list = api.getProviders();
      if(Array.isArray(list) && list.length) return list;
    }
    return PROVIDER_FALLBACK.slice();
  }
  function providerOf(id){
    return providerList().find(p => p.id === id) || null;
  }
  function toolLabel(name){
    return TOOL_LABELS[name] || String(name || '工具');
  }
  function imageURL(value){
    return typeof value === 'string' && /^data:image\//i.test(value) ? value : '';
  }
  function timeNow(){
    try{ return new Date().toLocaleTimeString('zh-CN', { hour12:false }); }
    catch(_){ return new Date().toTimeString().slice(0, 8); }
  }

  /* 工具参数/结果的短摘要：始终剥离图片数据，避免大 base64 进入 DOM */
  function safeValue(value, depth, seen){
    depth = depth || 0;
    seen = seen || new Set();
    if(depth > 4) return '[…]';
    if(typeof value === 'string') return value.length > 200 ? value.slice(0, 200) + '…' : value;
    if(value == null || typeof value !== 'object') return value;
    if(seen.has(value)) return '[循环数据]';
    seen.add(value);
    let out;
    if(Array.isArray(value)){
      out = value.slice(0, 20).map(v => safeValue(v, depth + 1, seen));
    }else{
      out = {};
      Object.keys(value).slice(0, 30).forEach(k => {
        if(IMAGE_KEYS.has(k) || /^(dataurl|thumb|full)$/i.test(k)) out[k] = '[图像数据]';
        else out[k] = safeValue(value[k], depth + 1, seen);
      });
    }
    seen.delete(value);
    return out;
  }
  function safeArgsText(args){
    if(!args || typeof args !== 'object') return '';
    if(!Array.isArray(args) && !Object.keys(args).length) return '';
    try{
      let text = JSON.stringify(safeValue(args), null, 2);
      if(text && text.length > 1400) text = text.slice(0, 1400) + '\n…';
      return text;
    }catch(_){ return ''; }
  }
  function argBrief(args){
    if(!args || typeof args !== 'object') return '';
    const bits = [];
    Object.keys(args).slice(0, 4).forEach(k => {
      let v = args[k];
      if(IMAGE_KEYS.has(k) || /^(dataurl|thumb|full)$/i.test(k)) v = '[图像]';
      else if(typeof v === 'string') v = v.length > 26 ? v.slice(0, 26) + '…' : v;
      else if(Array.isArray(v)) v = '[' + v.length + ']';
      else if(v && typeof v === 'object') v = '{…}';
      bits.push(k + '=' + String(v));
    });
    return bits.join(' ');
  }
  function logSummary(result){
    if(!result || typeof result !== 'object') return '';
    if(result.denied) return '用户拒绝';
    if(result.error) return '错误：' + String(result.error).slice(0, 90);
    if(Array.isArray(result)) return '返回 ' + result.length + ' 项';
    if(Array.isArray(result.variants)) return '生成 ' + result.variants.length + ' 个变种';
    if(Array.isArray(result.colors)) return result.colors.length + ' 种颜色';
    if(result.pngCount != null) return '导出 ' + result.pngCount + ' 张 / ' + result.fileCount + ' 个文件';
    if(result.dataURL || result.thumb){
      const w = result.width != null ? result.width : (result.meta && result.meta.width);
      const h = result.height != null ? result.height : (result.meta && result.meta.height);
      return '已生成 ' + (w != null ? w : '?') + '×' + (h != null ? h : '?') + ' 预览';
    }
    if(result.cardName) return '卡片：' + result.cardName;
    const keys = Object.keys(result).filter(k => !IMAGE_KEYS.has(k) && typeof result[k] !== 'object');
    if(keys.length) return keys.slice(0, 3).map(k => k + '=' + String(result[k]).slice(0, 30)).join(' · ');
    return '完成';
  }

  /* ---------------- 页面骨架 ---------------- */
  function pageHTML(){
    return `
    <div class="agent-page">
      <div class="ag-head">
        <div class="ag-head-main">
          <span class="ag-logo">${ico('ai', 16)}</span>
          <b>AI 助手</b>
          <span class="ag-badge off" data-ag-badge>未配置</span>
          <span class="ag-status" data-ag-status>就绪</span>
        </div>
        <div class="ag-head-actions">
          <button type="button" class="btn sm" data-ag-config>配置</button>
          <button type="button" class="btn sm" data-ag-clear>清空对话</button>
        </div>
      </div>
      <div class="ag-messages" data-ag-messages>
        <div class="ag-guide-slot" data-ag-guide></div>
        <div class="ag-empty" data-ag-empty>
          ${ico('ai', 30)}
          <b>AI 助手</b>
          <span>配置模型密钥后，可以让我查看纹理、分析颜色、换色、生成变种、绘制图案或导出资源包。</span>
        </div>
      </div>
      <div class="ag-log" data-ag-log>
        <button type="button" class="ag-log-head" data-ag-log-toggle aria-expanded="false">
          <span>工具日志</span><em data-ag-log-count>0</em><i>▾</i>
        </button>
        <div class="ag-log-body" data-ag-log-body hidden></div>
      </div>
      <div class="ag-input">
        <textarea data-ag-text rows="2" placeholder="描述你想做的纹理操作，Enter 发送，Shift+Enter 换行" spellcheck="false"></textarea>
        <button type="button" class="btn pri ag-send" data-ag-send>发送</button>
      </div>
      <div class="ag-config" data-ag-config-panel></div>
    </div>`;
  }

  function mount(t, host){
    const pane = document.createElement('div');
    pane.className = 'ed-pane agent-pane on';
    pane.dataset.tab = t.id;
    pane.innerHTML = pageHTML();
    host.appendChild(pane);
    t._pane = pane;

    const view = {
      pane, t,
      messagesEl: pane.querySelector('[data-ag-messages]'),
      guideEl: pane.querySelector('[data-ag-guide]'),
      emptyEl: pane.querySelector('[data-ag-empty]'),
      statusEl: pane.querySelector('[data-ag-status]'),
      badgeEl: pane.querySelector('[data-ag-badge]'),
      sendBtn: pane.querySelector('[data-ag-send]'),
      logEl: pane.querySelector('[data-ag-log]'),
      logBody: pane.querySelector('[data-ag-log-body]'),
      logCount: pane.querySelector('[data-ag-log-count]'),
      configEl: pane.querySelector('[data-ag-config-panel]'),
      logTotal: 0,
      pendingLogs: new Map(),
      consents: new Map(),
      unsubs: [],
      dead: false,
      saving: false
    };
    views.set(t.id, view);

    bindBase(view);
    hydrate(view);
    updateAll(view);
    subscribe(view);
    return pane;
  }

  function subscribe(view){
    const api = A();
    if(!api || typeof api.on !== 'function') return;
    const events = ['status','message','toolcall','toolresult','consent','error','done','config','key','reset'];
    events.forEach(ev => {
      const off = api.on(ev, payload => {
        if(view.dead) return;
        if(!view.pane.isConnected){ cleanup(view); return; }
        handle(view, ev, payload);
      });
      if(typeof off === 'function') view.unsubs.push(off);
    });
  }
  function cleanup(view){
    if(!view || view.dead) return;
    view.dead = true;
    view.unsubs.forEach(off => { try{ off(); }catch(_){} });
    view.unsubs = [];
    views.delete(view.t.id);
  }

  function hydrate(view){
    const st = stateSafe();
    (st.messages || []).forEach(msg => {
      if(msg && (msg.role === 'user' || msg.role === 'assistant')) renderMessage(view, msg);
    });
  }

  /* ---------------- 事件分发 ---------------- */
  function handle(view, ev, payload){
    switch(ev){
      case 'status':
        if(typeof payload === 'string' && payload) view.statusEl.textContent = payload;
        syncBusy(view);
        break;
      case 'message':
        if(payload && (payload.role === 'user' || payload.role === 'assistant')){
          renderMessage(view, payload);
          scrollEnd(view);
        }
        break;
      case 'toolcall':
        view.statusEl.textContent = '调用工具：' + toolLabel(payload && payload.name);
        addLogCall(view, payload || {});
        break;
      case 'toolresult':
        removeConsentsFor(view, payload && payload.id);
        renderToolResult(view, payload || {});
        updateLogResult(view, payload || {});
        scrollEnd(view);
        break;
      case 'consent':
        renderConsent(view, payload || {});
        view.statusEl.textContent = '等待你的确认';
        scrollEnd(view);
        break;
      case 'error':
        renderError(view, payload);
        view.statusEl.textContent = '出错';
        break;
      case 'done':
        clearConsentCards(view);
        syncBusy(view);
        break;
      case 'config':
        updateBadge(view);
        refreshConfigStatus(view);
        break;
      case 'key':
        updateBadge(view);
        renderGuide(view);
        refreshConfigStatus(view);
        break;
      case 'reset':
        clearChat(view);
        break;
    }
  }

  function updateAll(view){
    updateBadge(view);
    renderGuide(view);
    syncBusy(view);
    refreshConfigStatus(view);
  }

  function syncBusy(view){
    const st = stateSafe();
    view.sendBtn.textContent = st.busy ? '停止' : '发送';
    view.sendBtn.classList.toggle('stop', !!st.busy);
    if(!st.busy && view.statusEl.textContent === '处理中…') view.statusEl.textContent = '就绪';
  }

  /* ---------------- 消息渲染 ---------------- */
  function renderMessage(view, message){
    const content = typeof message.content === 'string' ? message.content : '';
    const calls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
    if(!content && !calls.length) return;
    const isUser = message.role === 'user';
    const row = document.createElement('div');
    row.className = 'ag-msg ' + (isUser ? 'user' : 'assistant');
    let html = '<div class="ag-role">' + (isUser ? '你' : 'AI 助手') + '</div>';
    if(content) html += '<div class="ag-bubble">' + E(content) + '</div>';
    if(calls.length){
      html += '<div class="ag-toolchips">' + calls.map(call => {
        const name = call && call.name ? String(call.name) : '工具';
        const brief = argBrief(call && call.args);
        const full = safeArgsText(call && call.args);
        return '<span class="ag-toolchip" title="' + E(full) + '">' + E(toolLabel(name)) +
          (brief ? '<em>' + E(brief) + '</em>' : '') + '</span>';
      }).join('') + '</div>';
    }
    row.innerHTML = html;
    appendNode(view, row);
  }

  function renderError(view, payload){
    let text = '';
    if(typeof payload === 'string') text = payload;
    else if(payload && typeof payload.message === 'string') text = payload.message;
    else text = '发生未知错误';
    const box = document.createElement('div');
    box.className = 'ag-error';
    box.innerHTML = ico('close', 14) + '<span>' + E(text) + '</span>';
    appendNode(view, box);
  }

  function variantsHTML(variants){
    const list = Array.isArray(variants) ? variants : [];
    const shown = list.filter(v => v && (imageURL(v.dataURL) || imageURL(v.thumb))).slice(0, 24);
    if(!shown.length) return '';
    let html = '<div class="ag-variants">' + shown.map((v, i) => {
      const src = imageURL(v.dataURL) || imageURL(v.thumb);
      const label = v.rampName || v.name || ('变种 ' + (i + 1));
      return '<figure><img src="' + E(src) + '" alt="' + E(label) + '" loading="lazy">' +
        '<figcaption>' + E(label) + '</figcaption></figure>';
    }).join('') + '</div>';
    if(list.length > shown.length){
      html += '<div class="ag-toolnote">只展示前 ' + shown.length + ' / ' + list.length + ' 个变种</div>';
    }
    return html;
  }

  function colorsHTML(colors){
    const list = Array.isArray(colors) ? colors.filter(c => c && /^#[0-9a-f]{6}$/i.test(String(c.hex || ''))).slice(0, 64) : [];
    if(!list.length) return '';
    return '<div class="ag-colors">' + list.map(c => {
      const hex = String(c.hex).toLowerCase();
      const share = Number(c.share);
      const pct = Number.isFinite(share) ? ((share <= 1 ? share * 100 : share).toFixed(1) + '%') : '';
      const title = hex.toUpperCase() + (pct ? ' · ' + pct : '') + (c.count != null ? ' · ' + c.count + ' px' : '');
      return '<span class="ag-color" title="' + E(title) + '"><i style="background:' + hex + '"></i><em>' + E(hex) + '</em></span>';
    }).join('') + '</div>';
  }

  function resultSummary(result){
    if(!result || typeof result !== 'object') return '';
    if(Array.isArray(result)) return '返回 ' + result.length + ' 项';
    const bits = [];
    const rw = result.width != null ? result.width : (result.meta && result.meta.width);
    const rh = result.height != null ? result.height : (result.meta && result.meta.height);
    if(rw != null && rh != null) bits.push(rw + '×' + rh);
    if(result.meta && result.meta.elements != null) bits.push(result.meta.elements + ' 立方体');
    if(result.changed != null) bits.push('替换 ' + result.changed + ' 像素');
    if(result.rampName) bits.push('色阶：' + result.rampName);
    if(result.cardName) bits.push('卡片：' + result.cardName);
    if(result.slot) bits.push('槽位：' + result.slot);
    if(result.pngCount != null) bits.push('PNG ' + result.pngCount + ' 张 / 文件 ' + result.fileCount + ' 个');
    if(result.filename) bits.push(result.filename);
    if(result.unique != null) bits.push('唯一色 ' + result.unique);
    if(result.opaque != null) bits.push('不透明像素 ' + result.opaque);
    if(result.truncated) bits.push('结果已截断');
    if(Array.isArray(result.variants)) bits.push('变种 ' + result.variants.length + ' 个');
    return bits.join(' · ');
  }

  function renderToolResult(view, payload){
    const result = payload.result;
    const ok = payload.ok !== false && !(result && result.error);
    const box = document.createElement('div');
    box.className = 'ag-toolresult' + (ok ? '' : ' err');
    box.dataset.toolId = payload.id == null ? '' : String(payload.id);

    let body = '';
    if(result && result.error){
      body += '<div class="ag-error-line">' + E(String(result.error)) + '</div>';
    }else if(result && typeof result === 'object'){
      if(Array.isArray(result.variants)) body += variantsHTML(result.variants);
      const full = imageURL(result.dataURL);
      const thumb = imageURL(result.thumb);
      if(!Array.isArray(result.variants) && (full || thumb)){
        const src = full || thumb;
        body += '<img class="ag-img" src="' + E(src) + '" alt="' + E(payload.name || '纹理预览') + '" loading="lazy">';
      }
      if(Array.isArray(result.colors)) body += colorsHTML(result.colors);
      const summary = resultSummary(result);
      if(summary) body += '<div class="ag-toolnote">' + E(summary) + '</div>';
    }

    const argsText = safeArgsText(payload.args);
    box.innerHTML =
      '<div class="ag-toolresult-head">' +
        '<span class="ag-toolchip">' + E(toolLabel(payload.name)) + '</span>' +
        '<b>' + (ok ? '完成' : '失败') + '</b>' +
        '<span class="ag-log-state">' + (ok ? '成功' : '错误') + '</span>' +
      '</div>' +
      (argsText ? '<div class="ag-toolargs">' + E(argsText) + '</div>' : '') +
      (body ? '<div class="ag-toolresult-body">' + body + '</div>' : '');
    appendNode(view, box);
  }

  /* ---------------- 同意卡片 ---------------- */
  function renderConsent(view, payload){
    const resolve = payload.resolve;
    if(typeof resolve !== 'function') return;
    const name = payload.name ? String(payload.name) : '';
    const idKey = payload.id == null ? '' : String(payload.id);
    const card = document.createElement('div');
    card.className = 'ag-consent';
    card.dataset.consent = idKey;
    const hint = DESTRUCTIVE_HINTS[name] || '此操作会修改仓库或导出文件。';
    card.innerHTML =
      '<div class="ag-consent-head">' + ico('ai', 14) +
        '<b>需要你的同意</b><span>' + E(toolLabel(name)) + '</span></div>' +
      '<p>' + E(hint) + '请确认参数后再批准。</p>' +
      '<pre>' + E(safeArgsText(payload.args) || '（无参数）') + '</pre>' +
      '<div class="ag-consent-actions">' +
        '<button type="button" class="btn sm" data-ag-deny>拒绝</button>' +
        '<button type="button" class="btn pri sm" data-ag-allow>批准执行</button>' +
      '</div>';

    const finish = approved => {
      if(card.dataset.done) return;
      card.dataset.done = '1';
      clearTimeout(card._agTimer);
      try{ resolve(!!approved); }catch(_){}
      card.remove();
      updateEmpty(view);
    };
    card.querySelector('[data-ag-allow]').onclick = () => finish(true);
    card.querySelector('[data-ag-deny]').onclick = () => finish(false);
    card._agTimer = setTimeout(() => {
      if(card.dataset.done) return;
      card.dataset.done = '1';
      card.querySelectorAll('button').forEach(btn => { btn.disabled = true; });
      const note = document.createElement('div');
      note.className = 'ag-toolnote';
      note.textContent = '等待超时，已自动拒绝';
      card.appendChild(note);
    }, CONSENT_UI_TIMEOUT);

    const arr = view.consents.get(idKey) || [];
    arr.push(card);
    view.consents.set(idKey, arr);
    appendNode(view, card);
  }
  function removeConsentsFor(view, id){
    const key = id == null ? '' : String(id);
    const arr = view.consents.get(key);
    if(!arr) return;
    arr.forEach(card => { clearTimeout(card._agTimer); card.remove(); });
    view.consents.delete(key);
    updateEmpty(view);
  }
  function clearConsentCards(view){
    view.consents.forEach(arr => arr.forEach(card => { clearTimeout(card._agTimer); card.remove(); }));
    view.consents.clear();
    updateEmpty(view);
  }

  /* ---------------- 工具日志 ---------------- */
  function addLogCall(view, payload){
    const idKey = payload.id == null ? '' : String(payload.id);
    const row = document.createElement('div');
    row.className = 'ag-log-row pending';
    row.innerHTML =
      '<span class="ag-log-time">' + E(timeNow()) + '</span>' +
      '<span class="ag-log-name" title="' + E(payload.name || '') + '">' + E(toolLabel(payload.name)) + '</span>' +
      '<span class="ag-log-state">执行中…</span>' +
      '<span class="ag-log-sum"></span>';
    view.logBody.appendChild(row);
    view.logTotal++;
    view.logCount.textContent = String(view.logTotal);
    const arr = view.pendingLogs.get(idKey) || [];
    arr.push(row);
    view.pendingLogs.set(idKey, arr);
  }
  function updateLogResult(view, payload){
    const idKey = payload.id == null ? '' : String(payload.id);
    const arr = view.pendingLogs.get(idKey) || [];
    let row = arr.shift();
    if(arr.length) view.pendingLogs.set(idKey, arr);
    else view.pendingLogs.delete(idKey);
    if(!row){
      addLogCall(view, payload);
      const rows = view.pendingLogs.get(idKey) || [];
      row = rows.shift() || null;
      if(rows.length) view.pendingLogs.set(idKey, rows);
      else view.pendingLogs.delete(idKey);
    }
    if(!row) return;
    const ok = payload.ok !== false && !(payload.result && payload.result.error);
    row.classList.remove('pending');
    row.classList.add(ok ? 'ok' : 'err');
    const stateEl = row.querySelector('.ag-log-state');
    if(stateEl) stateEl.textContent = ok ? '成功' : '失败';
    const sumEl = row.querySelector('.ag-log-sum');
    if(sumEl) sumEl.textContent = logSummary(payload.result);
  }

  function clearChat(view){
    view.messagesEl.querySelectorAll('.ag-msg, .ag-toolresult, .ag-error, .ag-consent').forEach(node => node.remove());
    view.consents.forEach(arr => arr.forEach(card => { clearTimeout(card._agTimer); card.remove(); }));
    view.consents.clear();
    view.pendingLogs.clear();
    view.logBody.innerHTML = '';
    view.logTotal = 0;
    view.logCount.textContent = '0';
    view.statusEl.textContent = '就绪';
    renderGuide(view);
    updateEmpty(view);
    syncBusy(view);
  }

  /* ---------------- 空状态 / 引导 ---------------- */
  function updateEmpty(view){
    const hasItems = !!view.messagesEl.querySelector('.ag-msg, .ag-toolresult, .ag-error, .ag-consent');
    const hasGuide = !!(view.guideEl && view.guideEl.childElementCount);
    view.emptyEl.hidden = hasItems || hasGuide;
  }

  function renderGuide(view){
    const st = stateSafe();
    if(st.keyLocked && !st.hasKey){
      view.guideEl.innerHTML =
        '<div class="ag-guide">' +
          '<div class="ag-guide-ico">' + ico('ai', 30) + '</div>' +
          '<b>密钥已加密保存</b>' +
          '<p>输入你设置的口令解锁 API key。口令只用于本机解密，不会发送到网络。</p>' +
          '<div class="ag-guide-row"><input type="password" data-ag-unlock-pass placeholder="解锁口令" autocomplete="current-password">' +
          '<button type="button" class="btn pri" data-ag-unlock>解锁</button></div>' +
          '<div class="ag-guide-row"><button type="button" class="btn sm" data-ag-guide-config>打开配置</button></div>' +
          '<p class="ag-note">密钥只保存在本机浏览器，仅发往你选择的模型服务；不上传 GitHub、不写入日志。</p>' +
        '</div>';
      const input = view.guideEl.querySelector('[data-ag-unlock-pass]');
      const btn = view.guideEl.querySelector('[data-ag-unlock]');
      const doUnlock = async () => {
        const pass = input.value;
        if(!pass){ say('请输入解锁口令'); input.focus(); return; }
        btn.disabled = true;
        btn.textContent = '解锁中…';
        try{
          await A().unlock(pass);
          input.value = '';
          say('密钥已解锁');
        }catch(err){
          say('解锁失败：' + errorText(err));
        }finally{
          renderGuide(view);
          updateBadge(view);
          refreshConfigStatus(view);
        }
      };
      btn.onclick = doUnlock;
      input.addEventListener('keydown', e => {
        if(e.key === 'Enter' && !e.isComposing){ e.preventDefault(); doUnlock(); }
      });
      const cfg = view.guideEl.querySelector('[data-ag-guide-config]');
      if(cfg) cfg.onclick = () => openConfig();
    }else if(!st.hasKey){
      view.guideEl.innerHTML =
        '<div class="ag-guide">' +
          '<div class="ag-guide-ico">' + ico('ai', 30) + '</div>' +
          '<b>还没有配置模型密钥</b>' +
          '<p>填入任意 OpenAI 兼容服务、Claude 或 Gemini 的 API key 后，就可以用自然语言操作纹理。</p>' +
          '<button type="button" class="btn pri" data-ag-guide-config>打开配置</button>' +
          '<p class="ag-note">密钥默认只保存在内存；勾选「加密记住」后才会以 AES-GCM 密文存在本机。公共电脑建议不要记住。</p>' +
        '</div>';
      const cfg = view.guideEl.querySelector('[data-ag-guide-config]');
      if(cfg) cfg.onclick = () => openConfig();
    }else{
      view.guideEl.innerHTML = '';
    }
    updateEmpty(view);
  }

  /* ---------------- 顶栏连接徽标 ---------------- */
  function connectionInfo(st){
    const cfg = st.config || {};
    if(cfg.useProxy === 'on'){
      return st.proxyAvailable
        ? { label:'本地代理（强制）', short:'本地代理', kind:'proxy', detail:'健康检查通过，请求强制走本地代理' }
        : { label:'本地代理不可用（强制）', short:'代理不可用', kind:'warn', detail:'健康检查失败；请启动 serve.py，或把连接方式改为自动 / 直连' };
    }
    if(cfg.useProxy === 'off'){
      return { label:'直连（强制）', short:'直连', kind:'direct', detail:'已关闭本地代理，浏览器直接请求模型服务' };
    }
    return st.proxyAvailable
      ? { label:'本地代理（自动）', short:'本地代理', kind:'proxy', detail:'检测到本地代理，优先通过 /api/llm 转发' }
      : { label:'直连（自动）', short:'直连', kind:'direct', detail:'未检测到本地代理，浏览器直接请求模型服务' };
  }

  function keyStateHTML(st){
    if(st.hasKey){
      return '密钥状态：<b>已载入内存</b>（仅本次页面有效）';
    }
    if(st.keyLocked){
      return '密钥状态：<b>已加密保存，等待解锁</b>';
    }
    return '密钥状态：<b>未配置</b>';
  }

  function updateBadge(view){
    const st = stateSafe();
    const cfg = st.config || {};
    let text = '未配置';
    let kind = 'off';
    let title = '';
    if(st.keyLocked && !st.hasKey){
      text = '密钥未解锁';
      kind = 'warn';
      title = '已保存加密密钥，需要输入口令解锁';
    }else if(!st.hasKey){
      text = '未配置';
      kind = 'off';
      title = '尚未配置 API key';
    }else{
      const info = connectionInfo(st);
      text = info.short;
      kind = info.kind;
      const prov = providerOf(cfg.provider);
      title = '模型：' + (prov ? prov.name : cfg.provider || '') + ' · ' + (cfg.model || '') + ' · ' + info.label;
    }
    view.badgeEl.textContent = text;
    view.badgeEl.className = 'ag-badge ' + kind;
    view.badgeEl.title = title;
  }

  /* ---------------- 输入 / 发送 ---------------- */
  function bindBase(view){
    const q = sel => view.pane.querySelector(sel);
    const send = () => {
      const api = A();
      if(!api){ say('AI 助手还没有初始化'); return; }
      const st = stateSafe();
      if(st.busy) return;
      const textarea = q('[data-ag-text]');
      const text = textarea.value.trim();
      if(!text) return;
      if(!st.hasKey){
        say(st.keyLocked ? '请先解锁保存的密钥' : '请先在配置里填入 API key');
        renderGuide(view);
        return;
      }
      textarea.value = '';
      textarea.style.height = '';
      try{
        const p = api.run(text);
        if(p && typeof p.catch === 'function') p.catch(() => {});
      }catch(err){
        say('发送失败：' + errorText(err));
      }
    };

    const sendBtn = q('[data-ag-send]');
    sendBtn.addEventListener('click', () => {
      const api = A();
      if(!api) return;
      if(stateSafe().busy){ api.stop(); return; }
      send();
    });

    const textarea = q('[data-ag-text]');
    textarea.addEventListener('keydown', e => {
      if(e.key === 'Enter' && !e.shiftKey && !e.isComposing){
        e.preventDefault();
        send();
      }
    });
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(140, Math.max(40, textarea.scrollHeight)) + 'px';
    });

    q('[data-ag-config]').addEventListener('click', () => showConfig(view));
    q('[data-ag-clear]').addEventListener('click', () => {
      const api = A();
      if(!api) return;
      api.reset();
      say('对话已清空');
    });

    const logBody = view.logBody;
    const logHead = q('[data-ag-log-toggle]');
    logHead.addEventListener('click', () => {
      const on = !view.logEl.classList.contains('on');
      view.logEl.classList.toggle('on', on);
      logBody.hidden = !on;
      logHead.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
  }

  /* ---------------- 配置面板 ---------------- */
  function configHTML(){
    const st = stateSafe();
    const cfg = st.config || {};
    const providers = providerList();
    const options = providers.map(p =>
      '<option value="' + E(p.id) + '"' + (p.id === cfg.provider ? ' selected' : '') + '>' + E(p.name) + '</option>'
    ).join('');
    const prov = providerOf(cfg.provider);
    const info = connectionInfo(st);
    return `
    <div class="ag-config-head">
      <div class="ag-config-title">${ico('ai', 16)}<b>AI 助手配置</b></div>
      <button type="button" class="btn sm" data-ag-config-close>返回对话</button>
    </div>
    <div class="ag-config-body">
      <section class="ag-config-section">
        <h3>模型服务</h3>
        <label class="ag-field"><span>服务商预设</span>
          <select data-ag-provider>${options}</select>
          <span class="ag-field-hint" data-ag-provider-hint>${E(prov ? (prov.hint || '') : '')}</span>
        </label>
        <div class="ag-grid2">
          <label class="ag-field"><span>Base URL</span>
            <input type="text" data-ag-baseurl value="${E(cfg.baseUrl || '')}" spellcheck="false" autocomplete="off">
          </label>
          <label class="ag-field"><span>模型</span>
            <input type="text" data-ag-model value="${E(cfg.model || '')}" spellcheck="false" autocomplete="off">
          </label>
        </div>
        <div class="ag-grid2">
          <label class="ag-field"><span>温度（0–2）</span>
            <input type="number" data-ag-temp min="0" max="2" step="0.1" value="${E(cfg.temperature)}">
          </label>
          <label class="ag-field"><span>最大输出 tokens</span>
            <input type="number" data-ag-maxtokens min="1" max="32768" step="64" value="${E(cfg.maxTokens)}">
          </label>
        </div>
        <label class="ag-field"><span>系统提示词</span>
          <textarea data-ag-system rows="5" spellcheck="false">${E(cfg.systemPrompt || '')}</textarea>
        </label>
      </section>

      <section class="ag-config-section">
        <h3>连接方式</h3>
        <label class="ag-field"><span>代理策略</span>
          <select data-ag-proxy>
            <option value="auto"${cfg.useProxy === 'auto' ? ' selected' : ''}>自动：优先本地代理，失败降级直连</option>
            <option value="on"${cfg.useProxy === 'on' ? ' selected' : ''}>强制本地代理</option>
            <option value="off"${cfg.useProxy === 'off' ? ' selected' : ''}>强制直连</option>
          </select>
        </label>
        <div class="ag-conn-line"><span>当前连接：</span><b data-ag-conn>${E(info.label)}</b><span data-ag-proxy-info>${E(info.detail)}</span></div>
        <p class="ag-note">本地代理由 serve.py 的 <code>/api/llm</code> 提供，可绕过浏览器跨域限制。GitHub Pages 等静态环境通常没有代理，只能直连；直连需要模型服务允许浏览器跨域访问。</p>
      </section>

      <section class="ag-config-section">
        <h3>API 密钥</h3>
        <div class="ag-key-state" data-ag-key-state>${keyStateHTML(st)}</div>
        <label class="ag-field"><span>API key</span>
          <input type="password" data-ag-key autocomplete="off" spellcheck="false" placeholder="${st.hasKey ? '已配置，留空保持不变' : '输入 API key'}">
        </label>
        <label class="ag-check"><input type="checkbox" data-ag-remember> 加密记住</label>
        <label class="ag-field ag-passfield"><span>解锁口令</span>
          <input type="password" data-ag-pass autocomplete="new-password" spellcheck="false" placeholder="设置一个仅你记得的口令">
        </label>
        <div class="ag-key-actions">
          <button type="button" class="btn pri" data-ag-save>保存配置与密钥</button>
          <button type="button" class="btn sm ag-danger" data-ag-clear-key>清除密钥</button>
        </div>
        <p class="ag-sec-note">密钥只保存在本机浏览器，仅发往你选择的模型服务；不上传 GitHub、不写入日志。公共电脑建议不勾选记住。</p>
        <p class="ag-note">不勾选「加密记住」时，密钥只保存在本次页面内存中，刷新后需要重新输入。配置文件本身不会写入 key。</p>
      </section>
    </div>`;
  }

  function showConfig(view){
    view.configEl.innerHTML = configHTML();
    bindConfig(view);
    view.configEl.classList.add('on');
    refreshConfigStatus(view);
  }
  function closeConfig(view){
    view.configEl.classList.remove('on');
  }

  function bindConfig(view){
    const q = sel => view.configEl.querySelector(sel);
    const providerSel = q('[data-ag-provider]');
    const hint = q('[data-ag-provider-hint]');
    const baseUrl = q('[data-ag-baseurl]');
    const model = q('[data-ag-model]');
    const applyHint = () => {
      const p = providerOf(providerSel.value);
      if(hint) hint.textContent = p ? (p.hint || '') : '';
    };
    providerSel.addEventListener('change', () => {
      const p = providerOf(providerSel.value);
      if(p && p.id !== 'custom'){
        baseUrl.value = p.baseUrl || '';
        model.value = p.model || '';
      }
      applyHint();
    });
    applyHint();

    const remember = q('[data-ag-remember]');
    const pass = q('[data-ag-pass]');
    const passField = q('.ag-passfield');
    const syncPass = () => {
      const on = !!remember.checked;
      pass.disabled = !on;
      if(passField) passField.classList.toggle('off', !on);
      if(!on) pass.value = '';
    };
    remember.addEventListener('change', syncPass);
    syncPass();

    q('[data-ag-save]').addEventListener('click', () => saveConfig(view));
    q('[data-ag-clear-key]').addEventListener('click', () => {
      const api = A();
      if(!api) return;
      const doClear = () => {
        try{
          api.clearKey();
          say('已清除 API 密钥');
          updateBadge(view);
          renderGuide(view);
          refreshConfigStatus(view);
        }catch(err){
          say('清除失败：' + errorText(err));
        }
      };
      if(typeof confirmDialog === 'function'){
        confirmDialog('清除 API 密钥', '清除后需要重新输入密钥才能继续使用 AI 助手。', '清除', doClear);
      }else{
        doClear();
      }
    });
    q('[data-ag-config-close]').addEventListener('click', () => closeConfig(view));
  }

  async function saveConfig(view){
    if(view.saving) return;
    const api = A();
    if(!api) return;
    const q = sel => view.configEl.querySelector(sel);
    const provider = q('[data-ag-provider]').value;
    const baseUrl = q('[data-ag-baseurl]').value.trim();
    const model = q('[data-ag-model]').value.trim();
    let temperature = Number(q('[data-ag-temp]').value);
    let maxTokens = Number(q('[data-ag-maxtokens]').value);
    const useProxy = q('[data-ag-proxy]').value;
    const systemPrompt = q('[data-ag-system]').value;
    const keyInput = q('[data-ag-key]');
    const remember = q('[data-ag-remember]').checked;
    const passInput = q('[data-ag-pass]');
    const keyValue = keyInput.value.trim();
    const passphrase = passInput.value;

    if(!baseUrl){ say('请填写 Base URL'); q('[data-ag-baseurl]').focus(); return; }
    if(!/^https?:\/\//i.test(baseUrl)){ say('Base URL 需要以 http:// 或 https:// 开头'); q('[data-ag-baseurl]').focus(); return; }
    if(!model){ say('请填写模型名称'); q('[data-ag-model]').focus(); return; }
    if(!Number.isFinite(temperature)) temperature = 0.7;
    if(!Number.isFinite(maxTokens)) maxTokens = 2048;
    temperature = Math.max(0, Math.min(2, temperature));
    maxTokens = Math.max(1, Math.min(32768, Math.round(maxTokens)));

    if(remember && keyValue && !passphrase){
      say('勾选「加密记住」后，请设置解锁口令');
      passInput.focus();
      return;
    }
    if(remember && !keyValue && passphrase){
      say('要加密记住密钥，请重新输入一次 API key 后再保存');
      keyInput.focus();
      return;
    }

    const btn = q('[data-ag-save]');
    view.saving = true;
    btn.disabled = true;
    btn.textContent = '保存中…';
    let keyError = null;
    try{
      api.setConfig({
        provider, baseUrl, model, temperature, maxTokens, useProxy, systemPrompt
      });
      if(keyValue){
        try{
          await api.setKey(keyValue, { remember, passphrase:remember ? passphrase : '' });
          keyInput.value = '';
          passInput.value = '';
        }catch(err){
          keyError = err;
        }
      }
      updateBadge(view);
      renderGuide(view);
      refreshConfigStatus(view);
      if(keyError) say('配置已保存，但密钥保存失败：' + errorText(keyError));
      else say(keyValue ? '配置与 API 密钥已保存' : '配置已保存');
    }catch(err){
      say('保存失败：' + errorText(err));
    }finally{
      view.saving = false;
      btn.disabled = false;
      btn.textContent = '保存配置与密钥';
    }
  }

  function refreshConfigStatus(view){
    if(!view.configEl || !view.configEl.classList.contains('on')) return;
    const st = stateSafe();
    const info = connectionInfo(st);
    const keyEl = view.configEl.querySelector('[data-ag-key-state]');
    if(keyEl) keyEl.innerHTML = keyStateHTML(st);
    const conn = view.configEl.querySelector('[data-ag-conn]');
    if(conn) conn.textContent = info.label;
    const infoEl = view.configEl.querySelector('[data-ag-proxy-info]');
    if(infoEl) infoEl.textContent = info.detail;
  }

  /* ---------------- 对外入口 ---------------- */
  function findAgentView(){
    try{
      if(typeof S !== 'undefined' && Array.isArray(S.tabs)){
        const tab = S.tabs.find(t => t.kind === 'agent');
        if(tab && views.get(tab.id)) return views.get(tab.id);
      }
    }catch(_){}
    const pane = document.querySelector('.agent-pane.on') || document.querySelector('.agent-pane');
    return pane ? (views.get(Number(pane.dataset.tab)) || null) : null;
  }

  function openConfig(){
    const api = A();
    if(!api){ say('AI 助手还没有初始化'); return; }
    try{
      if(typeof PWExtensions !== 'undefined' && typeof PWExtensions.isEnabled === 'function' &&
        !PWExtensions.isEnabled('ai-assistant')){
        say('「AI 助手」已在设置里关闭');
        return;
      }
    }catch(_){}
    let view = findAgentView();
    if(!view){
      api.open();
      view = findAgentView();
    }
    if(!view){ say('AI 助手界面还没有加载'); return; }
    showConfig(view);
  }

  function settingsRowHTML(){
    return `<div class="opt" data-set="agent"><div class="oi">${ico('ai', 16)}</div><div class="ot"><b>AI 助手</b><span>接入大模型 API key · 工具化纹理创作</span><i class="ost">配置模型 / 密钥 ›</i></div></div>`;
  }

  function appendNode(view, node){
    view.messagesEl.appendChild(node);
    updateEmpty(view);
  }
  function scrollEnd(view){
    const el = view.messagesEl;
    if(!el) return;
    if(typeof requestAnimationFrame === 'function'){
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }else{
      el.scrollTop = el.scrollHeight;
    }
  }

  window.PWAgentUI = { mount, openConfig, settingsRowHTML };
})();
