/* ============================================================
   Clastar Bridge · Blockbench 伴生插件
   ------------------------------------------------------------
   安装：Blockbench → 文件 / 插件 → 从文件加载，选择本文件。
   作用：
   - 接收像素工坊发来的 .bbmodel 工程并打开
   - 把当前 Blockbench 工程、缩略图同步回像素工坊
   不修改 Blockbench 本体，不读取本地文件系统。
   ============================================================ */
(function(){
  const PLUGIN_ID = 'clastar-bridge';
  const DEFAULT_URL = 'https://lyingice.github.io/ClastarStudio/';
  const URL_KEY = 'clastar_bridge_url';
  let actions = [];
  let session = { source:null, origin:'', nonce:'', loadId:'' };
  let clastarWindow = null;

  function say(msg){
    try{ Blockbench.showQuickMessage(msg, 2600); }
    catch(_){ console.log('[Clastar Bridge]', msg); }
  }
  function allowedOrigin(origin){
    return origin === 'https://lyingice.github.io' ||
      /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin) ||
      origin === location.origin;
  }
  function targetWindow(){ return session.source || clastarWindow; }
  function targetOrigin(){ return session.origin || '*'; }
  function send(data){
    const win = targetWindow();
    if(!win) return false;
    try{
      win.postMessage(Object.assign({ __clastar:1, nonce:session.nonce }, data), targetOrigin());
      return true;
    }catch(err){
      say('发送到像素工坊失败：' + (err.message || err));
      return false;
    }
  }
  function validSession(event, data){
    if(!session.nonce || data.nonce !== session.nonce) return false;
    if(session.source && event.source !== session.source) return false;
    if(session.origin && event.origin !== session.origin) return false;
    return true;
  }

  function connect(){
    let saved = DEFAULT_URL;
    try{ saved = localStorage.getItem(URL_KEY) || DEFAULT_URL; }catch(_){}
    let dialog;
    dialog = new Dialog({
      id:'clastar_bridge_connect',
      title:'连接像素工坊',
      form: {
        url: { label:'像素工坊地址', type:'text', value:saved }
      },
      onConfirm(result){
        let url = String((result && result.url) || '').trim();
        if(!url){ say('请输入像素工坊地址'); return; }
        if(!/^https?:\/\//i.test(url)) url = 'https://' + url;
        try{ localStorage.setItem(URL_KEY, url); }catch(_){}
        dialog.hide();
        openSession(url);
      }
    });
    dialog.show();
  }
  function openSession(url){
    session = { source:null, origin:'', nonce:'', loadId:'' };
    try{
      clastarWindow = window.open(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'bb=1', 'clastar-bridge');
    }catch(_){ clastarWindow = null; }
    if(!clastarWindow){ say('弹窗被浏览器拦截，请允许弹窗后重试'); return; }
    say('已打开像素工坊，等待握手…');
  }

  function onMessage(event){
    const data = event.data;
    if(!data || typeof data !== 'object' || data.__clastar !== 1) return;

    if(data.type === 'clastar:hello'){
      if(!data.nonce) return;
      const fromOpenedWindow = !!clastarWindow && event.source === clastarWindow;
      if(!fromOpenedWindow && !allowedOrigin(event.origin)) return;
      const same = session.nonce === data.nonce && session.source === event.source;
      session.source = event.source;
      session.origin = event.origin || '';
      session.nonce = data.nonce;
      if(!same) session.loadId = '';
      send({ type:'bb:ready', name:'Clastar Bridge', version:'0.1.0' });
      if(!same) say('已连接像素工坊');
      return;
    }

    if(data.type === 'clastar:load'){
      if(!validSession(event, data)) return;
      loadProject(data);
    }
  }

  function loadProject(data){
    let project = data.project;
    if(typeof project === 'string'){
      try{ project = JSON.parse(project); }
      catch(_){ send({ type:'bb:error', message:'工程 JSON 解析失败' }); return; }
    }
    if(!project || typeof project !== 'object' || !project.meta){
      send({ type:'bb:error', message:'工程缺少 .bbmodel 元数据' });
      return;
    }
    const go = () => {
      try{
        Codecs.project.load(project, { path:(data.name || 'clastar_model') + '.bbmodel', no_file:true });
        if(Project) Project.saved = true;
        session.loadId = data.id || '';
        say('已载入：' + (data.name || Project.name || '模型'));
        send({ type:'bb:loaded', id:session.loadId });
      }catch(err){
        send({ type:'bb:error', message:'载入失败：' + (err.message || err) });
      }
    };
    if(Project && Project.saved === false){
      Blockbench.showMessageBox({
        title:'载入像素工坊模型',
        message:'当前 Blockbench 项目还有未保存修改，继续会覆盖当前项目。',
        buttons:['取消', '继续'],
        confirmIndex:1,
        cancelIndex:0
      }, index => { if(index === 1) go(); });
    }else{
      go();
    }
  }

  function syncToClastar(){
    if(!session.nonce || !targetWindow()){
      say('还没有连接像素工坊：先执行「连接像素工坊」');
      return;
    }
    if(!Project){
      say('Blockbench 里还没有打开项目');
      return;
    }
    let project;
    try{ project = Codecs.project.compile(Project); }
    catch(err){ send({ type:'bb:error', message:'编译工程失败：' + (err.message || err) }); return; }
    let thumbnail = null;
    try{
      Project.updateThumbnail();
      if(typeof Project.thumbnail === 'string' && Project.thumbnail.indexOf('data:image/') === 0) thumbnail = Project.thumbnail;
    }catch(_){}
    const ok = send({
      type:'bb:save',
      id:session.loadId || '',
      name:Project.name || 'model',
      project,
      thumbnail
    });
    if(ok) say('已同步回像素工坊');
  }

  function addActions(){
    const connectAction = new Action('clastar_bridge_connect', {
      name:'连接像素工坊',
      description:'打开像素工坊并建立模型同步会话',
      icon:'link',
      click:connect
    });
    const syncAction = new Action('clastar_bridge_sync', {
      name:'同步回像素工坊',
      description:'把当前工程和缩略图发回像素工坊模型库',
      icon:'save',
      click:syncToClastar
    });
    MenuBar.addAction(connectAction, 'tools');
    MenuBar.addAction(syncAction, 'tools');
    actions = [connectAction, syncAction];
  }

  Plugin.register(PLUGIN_ID, {
    title:'Clastar Bridge',
    author:'lying_ice',
    description:'像素工坊模型库 ↔ Blockbench 双向同步',
    icon:'icon-blockbench_file',
    version:'0.1.0',
    variant:'both',
    min_version:'4.12.0',
    await_loading:true,
    onload(){
      window.addEventListener('message', onMessage);
      addActions();
      say('Clastar Bridge 已加载');
    },
    onunload(){
      window.removeEventListener('message', onMessage);
      actions.forEach(a => { try{ a.delete(); }catch(_){} });
      actions = [];
    }
  });
})();
