/* ============================================================
   AI 助手：模型接入 / 工具注册 / agent 循环 / 同意门控
   ------------------------------------------------------------
   - 经典脚本，无构建；通过 window.PWAgent 暴露
   - API key 默认只保存在内存，可选 WebCrypto AES-GCM 加密记忆
   - 不把 key 写入配置、日志或错误消息；工具结果中的大图会先剥离
   ============================================================ */
(() => {
  const LS_CONFIG = 'pixelWorkshop_agent_v1';
  const LS_KEY = 'pixelWorkshop_agentKey_v1';
  const MAX_ROUNDS = 12;
  const CONSENT_TIMEOUT = 30000;
  const IMAGE_PLACEHOLDER = '[图像预览已展示给用户]';
  const IMAGE_KEYS = new Set(['dataURL', 'thumb', 'full']);
  const MAX_LLM_STRING = 1500;
  const MAX_PREVIEWS = 24;

  const DEFAULT_SYSTEM_PROMPT = '你是像素工坊（ClastarStudio）的纹理创作助手。你可以通过工具查看工作区、检索纹理、分析颜色、换色、套用色阶、生成变种、绘制纹理，并在必要时保存回仓库或导出资源包。\n\n工作规则：\n1. 不确定素材 ID 时，先用 list_textures / search_assets / list_cards 查找，不要编造 ID。\n2. 修改仓库或导出文件前，先用预览工具生成结果并向用户说明，再调用破坏性工具（会弹出确认）。\n3. 工具结果里的「[图像预览已展示给用户]」表示图片已经显示在界面上，不要索要、复述或猜测图片数据。\n4. 一次只做用户要求的事，避免无关改动；参数和说明使用简体中文。';

  const DEFAULT_CONFIG = {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2048,
    useProxy: 'auto',
    systemPrompt: DEFAULT_SYSTEM_PROMPT
  };

  /* 供 UI 下拉使用的服务商预设；anthropic / gemini 使用各自适配器 */
  const PROVIDERS = [
    { id:'openai',      name:'OpenAI 兼容', baseUrl:'https://api.openai.com/v1', model:'gpt-4o-mini', hint:'通用 OpenAI 兼容接口，也可填第三方中转地址' },
    { id:'deepseek',    name:'DeepSeek', baseUrl:'https://api.deepseek.com/v1', model:'deepseek-chat', hint:'DeepSeek 开放平台（OpenAI 兼容）' },
    { id:'moonshot',    name:'Moonshot 月之暗面', baseUrl:'https://api.moonshot.cn/v1', model:'moonshot-v1-8k', hint:'Kimi 开放平台（OpenAI 兼容）' },
    { id:'zhipu',       name:'智谱 GLM', baseUrl:'https://open.bigmodel.cn/api/paas/v4', model:'glm-4-flash', hint:'智谱开放平台（OpenAI 兼容路径）' },
    { id:'siliconflow', name:'硅基流动', baseUrl:'https://api.siliconflow.cn/v1', model:'Qwen/Qwen2.5-7B-Instruct', hint:'SiliconFlow 模型广场（OpenAI 兼容）' },
    { id:'dashscope',   name:'阿里云百炼', baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1', model:'qwen-plus', hint:'DashScope 兼容模式' },
    { id:'anthropic',   name:'Anthropic Claude', baseUrl:'https://api.anthropic.com', model:'claude-3-5-sonnet-latest', hint:'Claude Messages API；浏览器直连需服务方允许' },
    { id:'gemini',      name:'Google Gemini', baseUrl:'https://generativelanguage.googleapis.com', model:'gemini-1.5-flash', hint:'Gemini generateContent API' },
    { id:'ollama',      name:'Ollama 本地', baseUrl:'http://127.0.0.1:11434/v1', model:'llama3.1', hint:'本机 Ollama，需要允许跨域访问' },
    { id:'lmstudio',    name:'LM Studio 本地', baseUrl:'http://127.0.0.1:1234/v1', model:'local-model', hint:'本机 LM Studio 的 OpenAI 兼容服务' },
    { id:'custom',      name:'自定义', baseUrl:'', model:'', hint:'手动填写兼容接口的 Base URL 与模型名' }
  ];
  const PROVIDER_IDS = new Set(PROVIDERS.map(p => p.id));

  /* ---------------- 配置 ---------------- */
  function sanitizeConfig(raw){
    const out = Object.assign({}, DEFAULT_CONFIG);
    if(!raw || typeof raw !== 'object') return out;
    if(PROVIDER_IDS.has(raw.provider)) out.provider = raw.provider;
    if(typeof raw.baseUrl === 'string' && raw.baseUrl.trim()) out.baseUrl = raw.baseUrl.trim().slice(0, 500);
    if(typeof raw.model === 'string' && raw.model.trim()) out.model = raw.model.trim().slice(0, 200);
    const t = Number(raw.temperature);
    if(Number.isFinite(t)) out.temperature = Math.max(0, Math.min(2, t));
    const mt = Number(raw.maxTokens);
    if(Number.isFinite(mt)) out.maxTokens = Math.max(1, Math.min(32768, Math.round(mt)));
    if(raw.useProxy === 'auto' || raw.useProxy === 'on' || raw.useProxy === 'off') out.useProxy = raw.useProxy;
    if(typeof raw.systemPrompt === 'string') out.systemPrompt = raw.systemPrompt.slice(0, 8000);
    return out;
  }
  function readConfigRaw(){
    try{ return JSON.parse(localStorage.getItem(LS_CONFIG) || 'null'); }
    catch(_){ return null; }
  }
  let config = sanitizeConfig(readConfigRaw());

  function getConfig(){ return Object.assign({}, config); }

  function setConfig(patch){
    if(!patch || typeof patch !== 'object') return getConfig();
    const next = Object.assign({}, config);
    if(PROVIDER_IDS.has(patch.provider)) next.provider = patch.provider;
    if(typeof patch.baseUrl === 'string' && patch.baseUrl.trim()) next.baseUrl = patch.baseUrl.trim().slice(0, 500);
    if(typeof patch.model === 'string' && patch.model.trim()) next.model = patch.model.trim().slice(0, 200);
    const t = Number(patch.temperature);
    if(Number.isFinite(t)) next.temperature = Math.max(0, Math.min(2, t));
    const mt = Number(patch.maxTokens);
    if(Number.isFinite(mt)) next.maxTokens = Math.max(1, Math.min(32768, Math.round(mt)));
    if(patch.useProxy === 'auto' || patch.useProxy === 'on' || patch.useProxy === 'off') next.useProxy = patch.useProxy;
    if(typeof patch.systemPrompt === 'string') next.systemPrompt = patch.systemPrompt.slice(0, 8000);
    config = sanitizeConfig(next);
    try{ localStorage.setItem(LS_CONFIG, JSON.stringify(config)); }
    catch(_){ try{ toast('AI 配置保存失败：浏览器本地存储不可用'); }catch(__){} }
    emit('config', getConfig());
    return getConfig();
  }

  /* ---------------- 密钥：只进内存，可选加密记忆 ---------------- */
  let apiKey = '';
  let inited = false;
  let lastPreview = null;       // 仅内存的最近预览，供 save_texture 等兜底
  const previews = new Map();   // previewId -> {dataURL,assetId,tool,at}，供精确引用某张预览
  let previewSeq = 0;
  let proxyProbe = null;

  const state = {
    messages: [],
    busy: false,
    controller: null,
    keyLocked: false,
    proxyAvailable: false
  };
  let runSeq = 0;

  function hasKey(){ return !!apiKey; }

  function bytesToB64(bytes){
    const arr = new Uint8Array(bytes);
    let s = '';
    for(let i=0; i<arr.length; i++) s += String.fromCharCode(arr[i]);
    return btoa(s);
  }
  function b64ToBytes(text){
    const bin = atob(text);
    const out = new Uint8Array(bin.length);
    for(let i=0; i<bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function webCrypto(){
    if(!(window.crypto && window.crypto.subtle)) throw new Error('当前浏览器不支持 WebCrypto，无法加密保存密钥');
    return window.crypto;
  }
  async function deriveAesKey(passphrase, salt){
    const c = webCrypto();
    const material = await c.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return c.subtle.deriveKey(
      { name:'PBKDF2', salt, iterations:150000, hash:'SHA-256' },
      material,
      { name:'AES-GCM', length:256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
  async function encryptKey(key, passphrase){
    const c = webCrypto();
    const salt = c.getRandomValues(new Uint8Array(16));
    const iv = c.getRandomValues(new Uint8Array(12));
    const derived = await deriveAesKey(passphrase, salt);
    const ct = await c.subtle.encrypt({ name:'AES-GCM', iv }, derived, new TextEncoder().encode(key));
    return { v:1, salt:bytesToB64(salt), iv:bytesToB64(iv), ct:bytesToB64(ct) };
  }
  async function decryptKey(blob, passphrase){
    const c = webCrypto();
    const derived = await deriveAesKey(passphrase, b64ToBytes(blob.salt));
    const plain = await c.subtle.decrypt(
      { name:'AES-GCM', iv:b64ToBytes(blob.iv) },
      derived,
      b64ToBytes(blob.ct)
    );
    return new TextDecoder().decode(plain);
  }
  function readKeyBlob(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(!raw) return null;
      const d = JSON.parse(raw);
      if(d && d.v === 1 && typeof d.salt === 'string' && typeof d.iv === 'string' && typeof d.ct === 'string') return d;
      return null;
    }catch(_){ return null; }
  }
  async function setKey(key, opts){
    const nextKey = String(key == null ? '' : key).trim();
    const remember = !!(opts && opts.remember);
    const passphrase = opts && opts.passphrase != null ? String(opts.passphrase) : '';
    apiKey = nextKey;
    let storeError = null;
    if(remember && passphrase && nextKey){
      try{
        const blob = await encryptKey(nextKey, passphrase);
        localStorage.setItem(LS_KEY, JSON.stringify(blob));
        state.keyLocked = false;
      }catch(err){
        storeError = err;
        state.keyLocked = false;
        try{ localStorage.removeItem(LS_KEY); }catch(_){}
      }
    }else{
      try{ localStorage.removeItem(LS_KEY); }catch(_){}
      state.keyLocked = false;
    }
    emit('key', { hasKey:hasKey(), keyLocked:state.keyLocked });
    if(storeError) throw storeError;
    return true;
  }
  async function unlock(passphrase){
    const blob = readKeyBlob();
    if(!blob) throw new Error('没有可解锁的加密密钥');
    webCrypto();
    let plain;
    try{ plain = await decryptKey(blob, String(passphrase == null ? '' : passphrase)); }
    catch(_){ throw new Error('口令不正确'); }
    apiKey = String(plain || '');
    state.keyLocked = false;
    emit('key', { hasKey:hasKey(), keyLocked:state.keyLocked });
    return true;
  }
  function clearKey(){
    apiKey = '';
    try{ localStorage.removeItem(LS_KEY); }catch(_){}
    state.keyLocked = false;
    emit('key', { hasKey:false, keyLocked:false });
  }

  /* ---------------- 事件 ---------------- */
  const listeners = Object.create(null);
  function on(ev, fn){
    if(typeof fn !== 'function') return () => {};
    (listeners[ev] || (listeners[ev] = [])).push(fn);
    return () => {
      const list = listeners[ev];
      if(!list) return;
      const i = list.indexOf(fn);
      if(i >= 0) list.splice(i, 1);
    };
  }
  function emit(ev, payload){
    const list = listeners[ev];
    if(!list || !list.length) return;
    list.slice().forEach(fn => { try{ fn(payload); }catch(_){} });
  }

  /* ---------------- 文本与工具结果安全处理 ---------------- */
  function redact(text){
    let s = String(text == null ? '' : text);
    if(apiKey) s = s.split(apiKey).join('***');
    s = s.replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer ***');
    return s;
  }
  function errorMessage(err){
    if(err == null) return '未知错误';
    if(typeof err === 'string') return err;
    return err.message || String(err);
  }
  function safeParse(value){
    if(value && typeof value === 'object') return value;
    if(typeof value !== 'string') return {};
    try{
      const out = JSON.parse(value);
      return out && typeof out === 'object' && !Array.isArray(out) ? out : {};
    }catch(_){ return {}; }
  }
  function parseMaybe(value){
    if(typeof value !== 'string') return value;
    try{ return JSON.parse(value); }
    catch(_){ return value; }
  }
  function sanitizeForLLM(value, depth, seen){
    depth = depth || 0;
    seen = seen || new Set();
    if(depth > 12) return '[数据层级过深]';
    if(typeof value === 'string') return value.length > MAX_LLM_STRING ? IMAGE_PLACEHOLDER : value;
    if(value == null || typeof value !== 'object') return value;
    if(seen.has(value)) return '[循环数据]';
    seen.add(value);
    let out;
    if(Array.isArray(value)){
      out = value.map(v => sanitizeForLLM(v, depth + 1, seen));
    }else{
      out = {};
      Object.keys(value).forEach(k => {
        if(IMAGE_KEYS.has(k) || /^(dataurl|thumb|full)$/i.test(k)){
          out[k] = IMAGE_PLACEHOLDER;
        }else{
          out[k] = sanitizeForLLM(value[k], depth + 1, seen);
        }
      });
    }
    seen.delete(value);
    return out;
  }
  function toolContentForLLM(result){
    try{
      const text = JSON.stringify(sanitizeForLLM(result));
      return text == null ? 'null' : text;
    }catch(_){
      return JSON.stringify({ error:'工具结果无法序列化' });
    }
  }
  function normalizeToolResult(result){
    if(result === undefined || result === null) return { ok:true };
    if(typeof result !== 'object') return { value:result };
    return result;
  }
  function isDataURL(v){ return typeof v === 'string' && /^data:image\//i.test(v); }
  /* 给每张预览发一个短句柄；base64 不进模型上下文，LLM 凭 previewId 引用具体某张 */
  function storePreview(dataURL, assetId, tool){
    const id = 'pv_' + (++previewSeq).toString(36) + '_' + Date.now().toString(36);
    previews.set(id, { dataURL, assetId:assetId || null, tool, at:Date.now() });
    while(previews.size > MAX_PREVIEWS){
      const oldest = previews.keys().next().value;
      previews.delete(oldest);
    }
    return id;
  }
  function rememberPreview(name, args, result){
    if(!result || typeof result !== 'object') return;
    const assetId = args && typeof args.assetId === 'string' ? args.assetId : null;
    const tag = item => {
      if(!item || typeof item !== 'object') return;
      const url = isDataURL(item.dataURL) ? item.dataURL : (isDataURL(item.thumb) ? item.thumb : '');
      if(!url) return;
      item.previewId = storePreview(url, assetId, name);
    };
    const setLast = item => {
      if(item && item.previewId && previews.has(item.previewId)){
        lastPreview = { dataURL:previews.get(item.previewId).dataURL, assetId, tool:name, at:Date.now() };
      }
    };
    if(Array.isArray(result)){
      result.forEach(tag);
      setLast(result.find(v => v && v.previewId));
      return;
    }
    if(Array.isArray(result.variants)){
      result.variants.forEach(tag);
      const first = result.variants.find(v => v && v.previewId);
      if(first){ setLast(first); return; }
    }
    tag(result);
    setLast(result);
  }
  function previewDataURL(args, requireSameAsset){
    args = args || {};
    if(typeof args.previewId === 'string' && previews.has(args.previewId)){
      const p = previews.get(args.previewId);
      if(requireSameAsset && args.assetId && p.assetId && p.assetId !== args.assetId){
        throw new Error('该预览不属于目标纹理，请重新生成预览');
      }
      return p.dataURL;
    }
    const given = typeof args.dataURL === 'string' ? args.dataURL : '';
    if(isDataURL(given)) return given;
    if(!lastPreview) throw new Error('没有可用的预览图，请先调用换色 / 色阶 / 变种 / 绘制工具');
    if(requireSameAsset && args.assetId && lastPreview.assetId !== args.assetId){
      throw new Error('最近一次预览不属于该纹理，请先重新生成预览');
    }
    return lastPreview.dataURL;
  }

  /* 供模型工具按 previewId 取回预览图（画纹理 → 建模型闭环） */
  function getPreviewDataURL(id){
    if(typeof id === 'string' && previews.has(id)) return previews.get(id).dataURL;
    return null;
  }

  /* ---------------- Provider 适配器 ---------------- */
  function openaiAdapter(){
    return {
      build(messages, tools, cfg, key){
        const url = String(cfg.baseUrl || '').replace(/\/+$/, '') + '/chat/completions';
        const mapped = (messages || []).map(m => {
          if(m.role === 'user') return { role:'user', content:m.content };
          if(m.role === 'assistant'){
            const out = { role:'assistant', content:m.content || null };
            if(m.toolCalls && m.toolCalls.length){
              out.tool_calls = m.toolCalls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) }
              }));
            }
            return out;
          }
          return { role:'tool', tool_call_id:m.toolCallId, content:m.content };
        });
        if(cfg.systemPrompt) mapped.unshift({ role:'system', content:cfg.systemPrompt });
        const body = {
          model: cfg.model,
          messages: mapped,
          temperature: cfg.temperature,
          max_tokens: cfg.maxTokens,
          stream: false,
          tools: (tools || []).map(t => ({
            type: 'function',
            function: { name:t.name, description:t.description, parameters:t.parameters }
          })),
          tool_choice: 'auto'
        };
        return {
          url,
          headers: { Authorization:'Bearer ' + key, 'Content-Type':'application/json' },
          body
        };
      },
      parse(json){
        const msg = json && json.choices && json.choices[0] && json.choices[0].message;
        if(!msg) throw new Error('模型返回格式异常（缺少 choices[0].message）');
        let content = '';
        if(typeof msg.content === 'string') content = msg.content;
        else if(Array.isArray(msg.content)){
          content = msg.content.map(part => (part && typeof part.text === 'string') ? part.text : '').join('');
        }
        const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls.map((tc, i) => ({
          id: (tc && tc.id) || ('tc_' + i),
          name: tc && tc.function ? String(tc.function.name || '') : '',
          args: safeParse(tc && tc.function ? tc.function.arguments : '{}')
        })).filter(tc => tc.name) : [];
        const out = { role:'assistant', content };
        if(calls.length) out.toolCalls = calls;
        return out;
      }
    };
  }

  function anthropicAdapter(){
    return {
      build(messages, tools, cfg, key){
        const url = String(cfg.baseUrl || '').replace(/\/+$/, '') + '/v1/messages';
        const body = {
          model: cfg.model,
          max_tokens: cfg.maxTokens,
          system: cfg.systemPrompt,
          messages: (messages || []).map(m => {
            if(m.role === 'user') return { role:'user', content:[{ type:'text', text:m.content }] };
            if(m.role === 'assistant'){
              const content = [];
              if(m.content) content.push({ type:'text', text:m.content });
              (m.toolCalls || []).forEach(tc => {
                content.push({ type:'tool_use', id:tc.id, name:tc.name, input:tc.args || {} });
              });
              return { role:'assistant', content };
            }
            return {
              role:'user',
              content:[{ type:'tool_result', tool_use_id:m.toolCallId, content:m.content }]
            };
          }),
          tools: (tools || []).map(t => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters
          }))
        };
        return {
          url,
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body
        };
      },
      parse(json){
        const blocks = Array.isArray(json && json.content) ? json.content : [];
        let content = '';
        const calls = [];
        blocks.forEach((block, i) => {
          if(!block) return;
          if(block.type === 'text' && typeof block.text === 'string') content += block.text;
          else if(block.type === 'tool_use' && block.name){
            calls.push({
              id: block.id || ('toolu_' + i),
              name: String(block.name),
              args: block.input && typeof block.input === 'object' ? block.input : {}
            });
          }
        });
        const out = { role:'assistant', content };
        if(calls.length) out.toolCalls = calls;
        return out;
      }
    };
  }

  function geminiAdapter(){
    return {
      build(messages, tools, cfg, key){
        const url = String(cfg.baseUrl || '').replace(/\/+$/, '') + '/v1beta/models/' + cfg.model + ':generateContent';
        const contents = [];
        (messages || []).forEach(m => {
          if(m.role === 'user'){
            contents.push({ role:'user', parts:[{ text:m.content }] });
          }else if(m.role === 'assistant'){
            const parts = [];
            if(m.content) parts.push({ text:m.content });
            (m.toolCalls || []).forEach(tc => {
              parts.push({ functionCall:{ name:tc.name, args:tc.args || {} } });
            });
            contents.push({ role:'model', parts });
          }else{
            contents.push({
              role:'user',
              parts:[{
                functionResponse:{
                  name: m.name || m.toolCallId,
                  response:{ result:parseMaybe(m.content) }
                }
              }]
            });
          }
        });
        const body = {
          contents,
          systemInstruction:{ parts:[{ text:cfg.systemPrompt }] },
          tools:[{
            functionDeclarations:(tools || []).map(t => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters
            }))
          }],
          generationConfig:{
            temperature: cfg.temperature,
            maxOutputTokens: cfg.maxTokens
          }
        };
        return {
          url,
          headers: { 'x-goog-api-key': key, 'content-type':'application/json' },
          body
        };
      },
      parse(json){
        const parts = json && json.candidates && json.candidates[0] &&
          json.candidates[0].content && Array.isArray(json.candidates[0].content.parts)
          ? json.candidates[0].content.parts : [];
        let content = '';
        const calls = [];
        parts.forEach((part, i) => {
          if(!part) return;
          if(typeof part.text === 'string') content += part.text;
          if(part.functionCall && part.functionCall.name){
            calls.push({
              id: 'gem_' + i,
              name: String(part.functionCall.name),
              args: part.functionCall.args && typeof part.functionCall.args === 'object' ? part.functionCall.args : {}
            });
          }
        });
        const out = { role:'assistant', content };
        if(calls.length) out.toolCalls = calls;
        return out;
      }
    };
  }

  function adapterFor(provider){
    if(provider === 'anthropic') return anthropicAdapter();
    if(provider === 'gemini') return geminiAdapter();
    return openaiAdapter();
  }

  /* ---------------- 传输：本地代理优先，失败可降级直连 ---------------- */
  function directFetch(req, signal){
    return fetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(req.body),
      signal
    });
  }
  async function transport(req, signal){
    const mode = config.useProxy;
    const viaProxy = mode === 'on' || (mode !== 'off' && state.proxyAvailable);
    if(!viaProxy) return directFetch(req, signal);

    let res;
    try{
      res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ url:req.url, headers:req.headers, body:req.body }),
        signal
      });
    }catch(err){
      if(err && err.name === 'AbortError') throw err;
      if(mode === 'on') throw new Error('无法连接本地代理，请确认 serve.py 正在运行');
      state.proxyAvailable = false;
      emit('config', getConfig());
      return directFetch(req, signal);
    }
    if(res.status === 404){
      state.proxyAvailable = false;
      emit('config', getConfig());
      if(mode === 'on') throw new Error('本地代理不可用（HTTP 404），请启动本地代理或把连接方式改为自动 / 直连');
      return directFetch(req, signal);
    }
    return res;
  }
  async function httpError(res){
    let text = '';
    try{ text = await res.text(); }catch(_){}
    let detail = '';
    if(text){
      try{
        const j = JSON.parse(text);
        if(j && typeof j === 'object'){
          if(typeof j.error === 'string') detail = j.error;
          else if(j.error && typeof j.error.message === 'string') detail = j.error.message;
          else if(typeof j.message === 'string') detail = j.message;
          else if(typeof j.detail === 'string') detail = j.detail;
        }
      }catch(_){ detail = text; }
    }
    detail = redact(detail).replace(/\s+/g, ' ').trim().slice(0, 300);
    return new Error('模型服务返回 HTTP ' + res.status + (detail ? '：' + detail : ''));
  }
  async function detectProxy(){
    if(proxyProbe) return proxyProbe;
    proxyProbe = (async () => {
      let ctrl = null, timer = null;
      try{
        if(typeof AbortController === 'function'){
          ctrl = new AbortController();
          timer = setTimeout(() => { try{ ctrl.abort(); }catch(_){} }, 2500);
        }
        const res = await fetch('/api/llm/health', {
          cache: 'no-store',
          headers: { Accept:'application/json' },
          signal: ctrl ? ctrl.signal : undefined
        });
        if(!res.ok){
          state.proxyAvailable = false;
          return false;
        }
        const data = await res.json();
        state.proxyAvailable = !!(data && data.ok === true && data.proxy !== false);
        return state.proxyAvailable;
      }catch(_){
        state.proxyAvailable = false;
        return false;
      }finally{
        if(timer) clearTimeout(timer);
        proxyProbe = null;
        emit('config', getConfig());
      }
    })();
    return proxyProbe;
  }

  /* ---------------- 工具注册表 ---------------- */
  const tools = [];
  function registerTool(def){
    if(!def || !def.name) throw new Error('工具需要 name');
    if(typeof def.handler !== 'function') throw new Error('工具需要 handler');
    const rawHandler = def.handler;
    const tool = {
      name: String(def.name),
      description: String(def.description || ''),
      parameters: def.parameters || { type:'object', properties:{} },
      destructive: !!def.destructive,
      handler: async function(args){
        try{ return await rawHandler(args); }
        catch(err){ return { error:redact(errorMessage(err)) }; }
      }
    };
    const i = tools.findIndex(t => t.name === tool.name);
    if(i >= 0) tools[i] = tool;
    else tools.push(tool);
    return tool;
  }
  function findTool(name){ return tools.find(t => t.name === name) || null; }
  function toolsForLLM(){
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }));
  }
  function texture(){
    const T = window.PWAgentTexture;
    if(!T) throw new Error('纹理工具尚未加载，请刷新页面后重试');
    return T;
  }
  function model(){
    const M = window.PWAgentModel;
    if(!M) throw new Error('模型工具尚未加载，请刷新页面后重试');
    return M;
  }
  function clampLimit(value, fallback, min, max){
    const n = Number(value);
    if(!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }
  function requireString(args, key, label){
    const v = args && typeof args[key] === 'string' ? args[key].trim() : '';
    if(!v) throw new Error('缺少参数 ' + (label || key));
    return v;
  }

  registerTool({
    name: 'list_workspaces',
    description: '列出所有项目工作区（不含素材库），以及每个工作区里的卡片数量。用于先确认有哪些工作区可选。',
    parameters: { type:'object', properties:{} },
    handler(){
      const list = (typeof WS !== 'undefined' && Array.isArray(WS) ? WS : []).filter(w => !w.assetLibrary);
      return list.map(w => ({
        id: w.id,
        name: w.name,
        count: (w.cats || []).reduce((n, c) => n + ((c.cards || []).length), 0)
      }));
    }
  });

  registerTool({
    name: 'list_cards',
    description: '列出指定或当前工作区里的卡片（会遍历文件夹内部），只返回名称、徽标、类型和元信息，不含图片。可用 query 过滤名称 / 元信息。',
    parameters: {
      type:'object',
      properties:{
        workspaceId:{ type:'string', description:'工作区 ID；省略时使用当前工作区' },
        query:{ type:'string', description:'按名称 / 元信息模糊过滤' },
        limit:{ type:'number', description:'最多返回数量，默认 50，最大 200' }
      }
    },
    handler(args){
      args = args || {};
      const list = (typeof WS !== 'undefined' && Array.isArray(WS) ? WS : []).filter(w => !w.assetLibrary);
      let ws = null;
      if(args.workspaceId){
        ws = list.find(w => w.id === args.workspaceId) || null;
        if(!ws) throw new Error('找不到指定工作区：' + args.workspaceId);
      }else{
        ws = (typeof currentWS === 'function' ? currentWS() : null);
        if(ws && ws.assetLibrary) ws = null;
      }
      if(!ws) throw new Error('当前没有打开的项目工作区，请先选择或创建工作区');
      const q = String(args.query || '').trim().toLowerCase();
      const limit = clampLimit(args.limit, 50, 1, 200);
      const out = [];
      const walk = cards => {
        (cards || []).forEach(c => {
          if(!c || out.length >= limit) return;
          if(c.type === 'folder'){
            walk(c.cards);
            return;
          }
          const text = (String(c.name || '') + ' ' + String(c.meta || '') + ' ' + String(c.badge || '')).toLowerCase();
          if(q && !text.includes(q)) return;
          out.push({
            id: c.id,
            name: c.name,
            badge: c.badge || '',
            type: c.type || 'item',
            meta: c.meta || ''
          });
        });
      };
      (ws.cats || []).forEach(cat => { if(out.length < limit) walk(cat.cards); });
      return out;
    }
  });

  registerTool({
    name: 'list_textures',
    description: '列出可用于 AI 编辑的纹理资产（含卡片各纹理槽位），返回 assetId、卡片名、工作区、槽位等信息。换色 / 变种 / 保存等工具都需要 assetId。',
    parameters: {
      type:'object',
      properties:{
        query:{ type:'string', description:'按卡片名 / 工作区 / 槽位名称模糊搜索' },
        workspaceId:{ type:'string', description:'限定工作区 ID；省略则搜索全部' },
        limit:{ type:'number', description:'最多返回数量，默认 50，最大 200' }
      }
    },
    handler(args){
      args = args || {};
      return texture().listTextures({
        query: args.query,
        workspaceId: args.workspaceId,
        limit: clampLimit(args.limit, 50, 1, 200)
      });
    }
  });

  registerTool({
    name: 'get_texture_colors',
    description: '分析一张纹理的颜色：返回宽高、主要颜色（hex / 像素数 / 占比）、唯一色数量与不透明像素数。mode=exact 为精确配色，mode=cluster 为聚类主色。',
    parameters: {
      type:'object',
      properties:{
        assetId:{ type:'string', description:'纹理资产 ID（来自 list_textures / search_assets）' },
        mode:{ type:'string', description:'exact 精确取色（默认）或 cluster 聚类主色' },
        clusterCount:{ type:'number', description:'聚类数量，2–16，默认 6' }
      },
      required:['assetId']
    },
    handler(args){
      args = args || {};
      const assetId = requireString(args, 'assetId');
      return texture().getTextureColors(assetId, {
        mode: args.mode,
        clusterCount: args.clusterCount
      });
    }
  });

  registerTool({
    name: 'list_ramps',
    description: '列出所有可用材质色阶（含内置与自定义），返回 id、名称、颜色数组。apply_ramp / generate_variants 需要色阶 ID。',
    parameters: { type:'object', properties:{} },
    handler(){ return texture().listRamps(); }
  });

  registerTool({
    name: 'list_palettes',
    description: '列出所有内置色卡（按分组），返回 id、分组、名称和颜色数组。recolor_texture 可通过 paletteId 指定色卡。',
    parameters: { type:'object', properties:{} },
    handler(){ return texture().listPalettes(); }
  });

  registerTool({
    name: 'search_assets',
    description: '在素材库（原版 / 模组 / 本地素材）中搜索参考纹理，返回 id、名称、命名空间、分类、分组和尺寸。只用于查素材，不修改任何数据。',
    parameters: {
      type:'object',
      properties:{
        query:{ type:'string', description:'按名称 / 路径 / 命名空间搜索' },
        namespace:{ type:'string', description:'限定命名空间，如 minecraft' },
        category:{ type:'string', description:'限定分类，如 block / item / entity' },
        limit:{ type:'number', description:'最多返回数量，默认 40，最大 100' }
      }
    },
    handler(args){
      args = args || {};
      return texture().searchAssets({
        query: args.query,
        namespace: args.namespace,
        category: args.category,
        limit: clampLimit(args.limit, 40, 1, 100)
      });
    }
  });

  registerTool({
    name: 'recolor_texture',
    description: '按预设 / 色卡 / 显式颜色映射生成换色预览，不写回仓库。preset 可选：theme（主题色）、lighten（提亮）、darken（压暗）、swap（色相互换）、gray（灰阶）、random（随机）、invert（反相）、palette（使用 paletteId 色卡）。mapping 为 [{source,target}] 形式的十六进制颜色映射。',
    parameters: {
      type:'object',
      properties:{
        assetId:{ type:'string', description:'要换色的纹理资产 ID' },
        preset:{ type:'string', enum:['theme','lighten','darken','swap','gray','random','invert','palette'], description:'换色预设' },
        paletteId:{ type:'string', description:'色卡 ID；提供后等价于 preset=palette' },
        mapping:{ type:'array', description:'显式颜色映射数组，每项 {source:原色 hex, target:目标 hex}', items:{ type:'object', properties:{ source:{type:'string'}, target:{type:'string'} }, required:['source','target'] } },
        mode:{ type:'string', description:'取色模式：exact 精确（默认）或 cluster 聚类' },
        tolerance:{ type:'number', description:'颜色容差 0–255，默认 5' }
      },
      required:['assetId']
    },
    handler(args){
      args = args || {};
      const assetId = requireString(args, 'assetId');
      const opts = {};
      ['preset','paletteId','mapping','mode','tolerance'].forEach(k => {
        if(args[k] !== undefined) opts[k] = args[k];
      });
      return texture().recolor(assetId, opts);
    }
  });

  registerTool({
    name: 'apply_ramp',
    description: '把一张纹理按指定材质色阶重新映射，生成预览图但不写回仓库。opts 可覆盖变种参数：autoStretch、protectEdge、preserveBlack、invert、contrast、gamma。',
    parameters: {
      type:'object',
      properties:{
        assetId:{ type:'string', description:'母版纹理资产 ID' },
        rampId:{ type:'string', description:'色阶 ID（来自 list_ramps）' },
        opts:{ type:'object', description:'可选变种参数覆盖', properties:{
          autoStretch:{type:'boolean'}, protectEdge:{type:'boolean'}, preserveBlack:{type:'boolean'},
          invert:{type:'boolean'}, contrast:{type:'number'}, gamma:{type:'number'}
        } }
      },
      required:['assetId','rampId']
    },
    handler(args){
      args = args || {};
      const assetId = requireString(args, 'assetId');
      const rampId = requireString(args, 'rampId');
      return texture().applyRamp(assetId, rampId, args.opts || {});
    }
  });

  registerTool({
    name: 'generate_variants',
    description: '用一张母版纹理批量生成多个色阶变种预览，不写回仓库。rampIds 为色阶 ID 数组；建议一次不超过 12 个，避免结果过多。opts 可覆盖变种参数。',
    parameters: {
      type:'object',
      properties:{
        assetId:{ type:'string', description:'母版纹理资产 ID' },
        rampIds:{ type:'array', items:{type:'string'}, description:'要生成的色阶 ID 数组' },
        opts:{ type:'object', description:'可选变种参数覆盖', properties:{
          autoStretch:{type:'boolean'}, protectEdge:{type:'boolean'}, preserveBlack:{type:'boolean'},
          invert:{type:'boolean'}, contrast:{type:'number'}, gamma:{type:'number'}
        } }
      },
      required:['assetId','rampIds']
    },
    handler(args){
      args = args || {};
      const assetId = requireString(args, 'assetId');
      if(!Array.isArray(args.rampIds) || !args.rampIds.length) throw new Error('rampIds 必须是非空数组');
      return texture().generateVariants(assetId, args.rampIds, args.opts || {});
    }
  });

  registerTool({
    name: 'paint_texture',
    description: '用绘制指令生成一张新纹理预览，不写回仓库。画布 1–512 像素，默认 16×16。operations 支持：fill{color} 整图填充；clear 清空；rect{x,y,w,h,color,fill=true} 矩形（fill=false 为描边）；pixel{x,y,color} 单像素；line{x1,y1,x2,y2,color} 1px 直线；noise{color,density=0.1,seed} 噪点；gradient{colors:[至少两个 hex],direction:horizontal|vertical|diagonal} 渐变。颜色均为 #rrggbb。',
    parameters: {
      type:'object',
      properties:{
        width:{ type:'number', description:'画布宽 1–512，默认 16' },
        height:{ type:'number', description:'画布高 1–512，默认 16' },
        background:{ type:'string', description:'可选背景色 #rrggbb' },
        operations:{ type:'array', description:'绘制指令数组', minItems:1, items:{
          type:'object',
          properties:{
            op:{ type:'string', enum:['fill','clear','rect','pixel','line','noise','gradient'] },
            color:{ type:'string' },
            x:{ type:'number' }, y:{ type:'number' },
            x1:{ type:'number' }, y1:{ type:'number' }, x2:{ type:'number' }, y2:{ type:'number' },
            w:{ type:'number' }, h:{ type:'number' },
            fill:{ type:'boolean' }, density:{ type:'number' }, seed:{ type:'number' },
            colors:{ type:'array', items:{type:'string'} },
            direction:{ type:'string', enum:['horizontal','vertical','diagonal'] }
          },
          required:['op']
        } }
      },
      required:['operations']
    },
    handler(args){
      args = args || {};
      if(!Array.isArray(args.operations) || !args.operations.length) throw new Error('operations 必须是非空数组');
      const opts = { operations: args.operations };
      if(args.width !== undefined) opts.width = args.width;
      if(args.height !== undefined) opts.height = args.height;
      if(args.background !== undefined) opts.background = args.background;
      return texture().paintTexture(opts);
    }
  });

  /* ---- 破坏性工具：必须经过用户同意 ---- */
  registerTool({
    name: 'save_texture',
    description: '破坏性操作：把一张预览图写回仓库，覆盖 assetId 对应的原纹理。必须先把预览展示给用户并取得确认。优先传 previewId（预览工具结果里返回的句柄）指定要写回的那张预览；省略时由系统复用该纹理最近一次预览。',
    parameters: {
      type:'object',
      properties:{
        assetId:{ type:'string', description:'要覆盖的纹理资产 ID' },
        previewId:{ type:'string', description:'预览句柄（来自 recolor_texture / apply_ramp / generate_variants 结果的 previewId）；省略则复用该纹理最近一次预览' },
        dataURL:{ type:'string', description:'可选，直接指定 PNG data URL；一般无需传入，用 previewId 即可' }
      },
      required:['assetId']
    },
    destructive: true,
    handler(args){
      args = args || {};
      const assetId = requireString(args, 'assetId');
      const dataURL = previewDataURL(args, true);
      return texture().writeTexture(assetId, dataURL);
    }
  });

  registerTool({
    name: 'create_texture_card',
    description: '破坏性操作：在工作区里新建一张纹理卡片。必须先把预览展示给用户并取得确认。优先传 previewId（预览工具结果里返回的句柄）指定用哪张预览建卡；省略时复用最近一次预览。',
    parameters: {
      type:'object',
      properties:{
        name:{ type:'string', description:'新卡片名称' },
        previewId:{ type:'string', description:'预览句柄（来自 paint_texture / recolor_texture / apply_ramp / generate_variants 结果的 previewId）；省略则复用最近一次预览' },
        dataURL:{ type:'string', description:'可选，直接指定 PNG data URL；一般无需传入，用 previewId 即可' },
        workspaceId:{ type:'string', description:'目标工作区 ID；省略时用当前工作区' },
        category:{ type:'string', description:'目标大类别名称，默认「AI 生成」' }
      },
      required:['name']
    },
    destructive: true,
    handler(args){
      args = args || {};
      const name = requireString(args, 'name', 'name');
      const dataURL = previewDataURL(args, false);
      const opts = { name, dataURL };
      if(args.workspaceId !== undefined) opts.workspaceId = args.workspaceId;
      if(args.category !== undefined) opts.category = args.category;
      return texture().createTextureCard(opts);
    }
  });

  registerTool({
    name: 'export_resource_pack',
    description: '破坏性操作：把指定卡片打包成 Minecraft 资源包 ZIP 并触发浏览器下载。必须取得用户确认。cardIds 来自 list_cards；format 默认 69，textureCategory 为 item 或 block。',
    parameters: {
      type:'object',
      properties:{
        cardIds:{ type:'array', items:{type:'string'}, description:'要导出的卡片 ID 数组' },
        namespace:{ type:'string', description:'资源包命名空间，默认 pixel_workshop' },
        format:{ type:'number', description:'资源包 pack_format，默认 69' },
        textureCategory:{ type:'string', enum:['item','block'], description:'纹理类别，默认 item' },
        filename:{ type:'string', description:'ZIP 文件名（不含扩展名）' },
        description:{ type:'string', description:'资源包描述文本' }
      },
      required:['cardIds']
    },
    destructive: true,
    handler(args){
      args = args || {};
      if(!Array.isArray(args.cardIds) || !args.cardIds.length) throw new Error('cardIds 必须是非空数组');
      const opts = { cardIds: args.cardIds };
      ['namespace','format','textureCategory','filename','description'].forEach(k => {
        if(args[k] !== undefined) opts[k] = args[k];
      });
      return texture().exportPack(opts);
    }
  });

  /* ---- 模型工具：无头 .bbmodel 构建 + 模型库 CRUD + Blockbench 联动 ---- */
  registerTool({
    name: 'model_list_formats',
    description: '列出可用的 Blockbench 模型格式（java_block / free / bedrock 等），model_build 的 format 参数从中选。',
    parameters: { type:'object', properties:{} },
    handler(){ return model().listFormats(); }
  });
  registerTool({
    name: 'model_list',
    description: '列出模型库里的模型集（含部件数 / 命名空间 / 更新时间），不含模型几何数据。用于先确认有哪些模型集。',
    parameters: { type:'object', properties:{
      query:{ type:'string', description:'按模型集 / 部件名模糊搜索' },
      limit:{ type:'number', description:'最多返回数量，默认 50' }
    } },
    handler(args){ return model().listSets(args || {}); }
  });
  registerTool({
    name: 'model_get',
    description: '查看一个模型集的详情：名称 / 命名空间 / 各部件的 id、名称、类型（静态/动态）、旋转轴与元信息。不含几何数据。',
    parameters: { type:'object', properties:{
      setId:{ type:'string', description:'模型集 ID（来自 model_list）' }
    }, required:['setId'] },
    handler(args){ return model().getSet(requireString(args, 'setId')); }
  });
  registerTool({
    name: 'model_build',
    description: '按立方体规格生成一个 Blockbench .bbmodel 模型预览（不入库）。cubes 每项 {name,from:[x,y,z],to:[x,y,z],origin?,inflate?,texture?(纹理索引或名),faces?}；坐标范围 -128..128，方块模型常用 0..16。textures 每项可用 assetId（素材库纹理）、previewId（AI 画的纹理预览）或 color（纯色占位）。返回 draftId 供 model_save 入库。',
    parameters: { type:'object', properties:{
      name:{ type:'string', description:'模型名称' },
      format:{ type:'string', enum:['java_block','free','bedrock','bedrock_block','modded_entity'], description:'模型格式，默认 java_block' },
      resolution:{ type:'array', items:{ type:'number' }, description:'纹理分辨率 [宽,高]，默认 [16,16]' },
      textures:{ type:'array', description:'纹理数组', items:{ type:'object', properties:{
        name:{ type:'string' }, assetId:{ type:'string', description:'素材库纹理资产 ID' },
        previewId:{ type:'string', description:'AI 纹理预览句柄' }, color:{ type:'string', description:'纯色占位 #rrggbb' }
      } } },
      cubes:{ type:'array', description:'立方体数组（非空）', items:{ type:'object', properties:{
        name:{ type:'string' },
        from:{ type:'array', items:{ type:'number' }, description:'起点 [x,y,z]' },
        to:{ type:'array', items:{ type:'number' }, description:'终点 [x,y,z]' },
        origin:{ type:'array', items:{ type:'number' }, description:'旋转枢轴，默认 [8,8,8]' },
        inflate:{ type:'number' },
        texture:{ description:'纹理索引（数字）或纹理名（字符串）' },
        faces:{ type:'object', description:'可选，按面覆盖 {north/south/east/west/up/down:{uv:[u1,v1,u2,v2],texture}}' }
      }, required:['from','to'] } },
      groups:{ type:'array', description:'可选分组 {name,cubes:[立方体索引]}', items:{ type:'object', properties:{
        name:{ type:'string' }, cubes:{ type:'array', items:{ type:'number' } }
      } } }
    }, required:['cubes'] },
    handler: async function(args){
      const r = await model().buildModel(args || {});
      /* 不把完整 raw 回灌模型上下文；几何留在 draft，入库用 draftId */
      return { draftId:r.draftId, name:r.name, meta:r.meta, thumb:r.thumb };
    }
  });
  registerTool({
    name: 'model_save',
    description: '破坏性操作：把 model_build 生成的模型（draftId）保存进模型库。省略 setId 则新建模型集；给定 setId 则作为新部件加入。role 可选 static/dynamic/item/overlay，动态部件可设 axis 旋转轴。',
    parameters: { type:'object', properties:{
      draftId:{ type:'string', description:'model_build 返回的草稿句柄' },
      name:{ type:'string', description:'模型集 / 部件名称' },
      setId:{ type:'string', description:'加入已有模型集的 ID；省略则新建' },
      role:{ type:'string', enum:['static','dynamic','item','overlay'], description:'部件类型，默认 static' },
      axis:{ type:'string', enum:['y','x','z','none'], description:'动态部件旋转轴，默认 y' },
      namespace:{ type:'string', description:'命名空间，如 create / minecraft' }
    }, required:['draftId'] },
    destructive: true,
    handler(args){ return model().saveModel(args || {}); }
  });
  registerTool({
    name: 'model_delete_set',
    description: '破坏性操作：从模型库删除整个模型集（含所有部件）。',
    parameters: { type:'object', properties:{ setId:{ type:'string' } }, required:['setId'] },
    destructive: true,
    handler(args){ return model().deleteSet(requireString(args, 'setId')); }
  });
  registerTool({
    name: 'model_delete_part',
    description: '破坏性操作：从模型集移除一个部件；若模型集因此变空则一并删除。',
    parameters: { type:'object', properties:{ partId:{ type:'string' } }, required:['partId'] },
    destructive: true,
    handler(args){ return model().deletePart(requireString(args, 'partId')); }
  });
  registerTool({
    name: 'model_export_part',
    description: '破坏性操作：把一个部件导出为 .bbmodel 文件并触发浏览器下载。',
    parameters: { type:'object', properties:{ partId:{ type:'string' } }, required:['partId'] },
    destructive: true,
    handler(args){ return model().exportPart(requireString(args, 'partId')); }
  });
  registerTool({
    name: 'model_export_set',
    description: '破坏性操作：把一个模型集导出为 ZIP（含各部件 .bbmodel 与 model-set.json）并触发下载。',
    parameters: { type:'object', properties:{ setId:{ type:'string' } }, required:['setId'] },
    destructive: true,
    handler(args){ return model().exportSet(requireString(args, 'setId')); }
  });
  registerTool({
    name: 'model_export_library',
    description: '破坏性操作：把整个模型库备份导出为 ZIP 并触发下载。',
    parameters: { type:'object', properties:{} },
    destructive: true,
    handler(){ return model().exportLibrary(); }
  });
  registerTool({
    name: 'model_open_blockbench',
    description: '把模型库里某个部件发送到 Blockbench 打开编辑（会打开 Blockbench 网页弹窗；首次需用户安装 Clastar Bridge 插件并连接）。改完在 Blockbench 里执行「同步回像素工坊」即可回存。',
    parameters: { type:'object', properties:{ partId:{ type:'string', description:'部件 ID（来自 model_get）' } }, required:['partId'] },
    handler(args){ return model().openInBlockbench(args || {}); }
  });

  /* ---------------- 同意门控 ---------------- */
  const consentWaiters = new Set();
  function requestConsent(id, name, args){
    return new Promise(resolve => {
      let settled = false;
      const entry = {};
      const finish = val => {
        if(settled) return;
        settled = true;
        clearTimeout(entry.timer);
        consentWaiters.delete(entry);
        resolve(!!val);
      };
      entry.finish = finish;
      entry.timer = setTimeout(() => finish(false), CONSENT_TIMEOUT);
      consentWaiters.add(entry);
      if(!listeners.consent || !listeners.consent.length){
        finish(false);
        return;
      }
      emit('consent', { id, name, args, resolve: finish });
    });
  }
  function cancelConsents(){
    [...consentWaiters].forEach(entry => {
      try{ entry.finish(false); }catch(_){}
    });
  }

  /* ---------------- Agent 循环 ---------------- */
  function abortError(){
    const err = new Error('已停止');
    err.name = 'AbortError';
    return err;
  }
  function isAbort(err){
    return !!(err && (err.name === 'AbortError' || err.code === 20));
  }

  async function run(userText){
    const text = String(userText == null ? '' : userText).trim();
    if(!text || state.busy) return false;
    if(!hasKey()){
      emit('error', '请先在配置里填入 API key');
      return false;
    }
    const seq = ++runSeq;
    const alive = () => seq === runSeq;
    state.busy = true;
    const userMessage = { role:'user', content:text };
    state.messages.push(userMessage);
    emit('message', userMessage);
    emit('status', '思考中…');
    const ctrl = typeof AbortController === 'function'
      ? new AbortController()
      : { signal:null, abort(){ } };
    state.controller = ctrl;
    const interrupted = () => !alive() || !!(ctrl.signal && ctrl.signal.aborted);
    let completed = false;

    try{
      for(let round=0; round<MAX_ROUNDS; round++){
        if(interrupted()) throw abortError();
        if(round > 0) emit('status', '思考中…');
        const adapter = adapterFor(config.provider);
        const req = adapter.build(state.messages, toolsForLLM(), config, apiKey);
        const resp = await transport(req, ctrl.signal);
        if(interrupted()) throw abortError();
        if(!resp.ok) throw await httpError(resp);
        let json;
        try{ json = await resp.json(); }
        catch(_){ throw new Error('模型返回的不是有效 JSON'); }
        if(interrupted()) throw abortError();
        const assistant = adapter.parse(json);
        assistant.role = 'assistant';
        state.messages.push(assistant);
        emit('message', assistant);

        const calls = Array.isArray(assistant.toolCalls) ? assistant.toolCalls : [];
        if(!calls.length){
          emit('status', '完成');
          completed = true;
          break;
        }

        for(const call of calls){
          if(interrupted()) throw abortError();
          const id = call && call.id
            ? String(call.id)
            : ('call_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
          const name = call && call.name ? String(call.name) : '';
          const args = call && call.args && typeof call.args === 'object' ? call.args : {};
          emit('toolcall', { id, name, args });

          let result;
          const tool = findTool(name);
          if(!tool){
            result = { error: '未知工具：' + name };
          }else{
            let approved = true;
            if(tool.destructive){
              approved = await requestConsent(id, name, args);
              if(interrupted()) throw abortError();
            }
            if(!approved){
              result = { error:'用户拒绝执行此操作', denied:true };
            }else{
              try{ result = await tool.handler(args); }
              catch(err){ result = { error:redact(errorMessage(err)) }; }
              if(interrupted()) throw abortError();
            }
          }
          result = normalizeToolResult(result);
          if(!result.error) rememberPreview(name, args, result);
          const ok = !result.error;
          emit('toolresult', { id, name, args, result, ok });
          state.messages.push({
            role: 'tool',
            toolCallId: id,
            name,
            content: toolContentForLLM(result)
          });
        }
      }
      if(!completed && alive()){
        emit('status', '完成');
        emit('error', '已达到最大工具调用轮数（' + MAX_ROUNDS + '），已停止。请简化需求后重试。');
      }
    }catch(err){
      if(isAbort(err)){
        if(alive()) emit('status', '已停止');
      }else if(alive()){
        emit('error', redact(errorMessage(err)));
        emit('status', '出错');
      }
    }finally{
      if(seq === runSeq){
        state.busy = false;
        state.controller = null;
        emit('done');
      }
    }
    return true;
  }

  function stop(){
    const wasBusy = state.busy || !!state.controller;
    cancelConsents();
    if(state.controller){
      try{ state.controller.abort(); }catch(_){}
    }
    state.busy = false;
    state.controller = null;
    if(wasBusy) emit('status', '已停止');
  }

  function reset(){
    runSeq++;
    cancelConsents();
    if(state.controller){
      try{ state.controller.abort(); }catch(_){}
    }
    state.busy = false;
    state.controller = null;
    state.messages = [];
    lastPreview = null;
    previews.clear();
    emit('reset');
  }

  function getState(){
    return {
      messages: state.messages.slice(),
      busy: state.busy,
      config: getConfig(),
      hasKey: hasKey(),
      keyLocked: state.keyLocked,
      proxyAvailable: state.proxyAvailable
    };
  }

  /* ---------------- 入口 ---------------- */
  function open(){
    if(!inited) init();
    try{
      if(typeof PWExtensions !== 'undefined' && typeof PWExtensions.isEnabled === 'function' &&
        !PWExtensions.isEnabled('ai-assistant')){
        toast('「AI 助手」已在设置里关闭');
        return;
      }
    }catch(_){}
    let exist = null;
    try{
      if(typeof S !== 'undefined' && Array.isArray(S.tabs)){
        exist = S.tabs.find(t => t.kind === 'agent') || null;
      }
    }catch(_){}
    if(exist){ activateTab(exist.id); return exist; }
    return newTab('agent', 'AI 助手');
  }

  function mount(t, host){
    if(window.PWAgentUI && typeof window.PWAgentUI.mount === 'function'){
      return window.PWAgentUI.mount(t, host);
    }
    toast('AI 助手界面还没有加载');
  }

  function openConfig(){
    if(window.PWAgentUI && typeof window.PWAgentUI.openConfig === 'function'){
      return window.PWAgentUI.openConfig();
    }
    toast('AI 助手界面还没有加载');
  }

  function settingsRowHTML(){
    if(window.PWAgentUI && typeof window.PWAgentUI.settingsRowHTML === 'function'){
      return window.PWAgentUI.settingsRowHTML();
    }
    const ico = typeof iconSVG === 'function' ? iconSVG('ai', 16) : '';
    return '<div class="opt" data-set="agent"><div class="oi">' + ico + '</div>' +
      '<div class="ot"><b>AI 助手</b><span>接入大模型 API key · 工具化纹理创作</span>' +
      '<i class="ost">配置模型 / 密钥 ›</i></div></div>';
  }

  function init(){
    if(inited) return;
    inited = true;
    config = sanitizeConfig(readConfigRaw());
    state.keyLocked = !apiKey && !!readKeyBlob();
    try{
      if(typeof PWExtensions !== 'undefined' && typeof PWExtensions.register === 'function'){
        PWExtensions.register({
          id:'ai-assistant',
          name:'AI 助手',
          kind:'tool',
          icon:'ai',
          version:'0.1.0',
          desc:'接入你的大模型 API key，用工具换色 / 出变种 / 画纹理 / 导出资源包',
          official:true,
          open:() => open()
        });
      }
    }catch(_){}
    detectProxy();
  }

  function getProviders(){
    return PROVIDERS.map(p => Object.assign({}, p));
  }

  window.PWAgent = {
    init,
    open,
    mount,
    openConfig,
    settingsRowHTML,
    getConfig,
    setConfig,
    setKey,
    unlock,
    clearKey,
    hasKey,
    run,
    stop,
    reset,
    registerTool,
    tools,
    toolsForLLM,
    on,
    getState,
    detectProxy,
    getProviders,
    getPreviewDataURL
  };
})();
