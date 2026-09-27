/* Shared behaviour: expand/collapse all, theme, bigger text, copy buttons, saved answers ([data-persist]),
   and "My notes": a button on every page that gathers everything typed on any page of the site and exports it. */
(function(){
  var root=document.documentElement, store=null;
  try{store=window.localStorage;store.getItem('aw-test');}catch(e){store=null;}
  function sget(k){try{return store?store.getItem(k):null;}catch(e){return null;}}
  function sset(k,v){try{if(store)store.setItem(k,v);}catch(e){}}
  function sdel(k){try{if(store)store.removeItem(k);}catch(e){}}
  var th=sget('aw-theme');if(th==='dark'||th==='light')root.setAttribute('data-theme',th);
  if(sget('aw-present')==='1')root.classList.add('present');
  function isDark(){var a=root.getAttribute('data-theme');if(a)return a==='dark';return window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches;}
  function copyText(txt,btn){
    var old=btn?btn.textContent:'';function ok(){if(!btn)return;btn.textContent='Copied';setTimeout(function(){btn.textContent=old;},1500);}
    function fallback(){var ta=document.createElement('textarea');ta.value=txt;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';
      document.body.appendChild(ta);ta.select();try{document.execCommand('copy');ok();}catch(e){if(btn)btn.textContent='Select and copy';}document.body.removeChild(ta);}
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok,fallback);}else{fallback();}
  }
  window.awCopy=copyText;
  document.addEventListener('click',function(e){
    var el=e.target.closest?e.target.closest('[data-expand-all],[data-collapse-all],[data-theme-toggle],[data-present-toggle],[data-copy]'):null;if(!el)return;
    if(el.hasAttribute('data-expand-all')){[].forEach.call(document.querySelectorAll('details.section'),function(d){d.open=true;});}
    else if(el.hasAttribute('data-collapse-all')){[].forEach.call(document.querySelectorAll('details.section'),function(d){d.open=false;});}
    else if(el.hasAttribute('data-theme-toggle')){var n=isDark()?'light':'dark';root.setAttribute('data-theme',n);sset('aw-theme',n);}
    else if(el.hasAttribute('data-present-toggle')){var on=root.classList.toggle('present');sset('aw-present',on?'1':'0');}
    else if(el.hasAttribute('data-copy')){var src=document.getElementById(el.getAttribute('data-copy'));if(src)copyText(src.value!==undefined&&src.tagName!=='PRE'?src.value:src.innerText,el);}
  });

  /* ---- saved answers ---- */
  var PAGES=['index.html','01-should-you-automate.html','02-idea-your-projects.html','03-tools-of-the-trade.html','04-live-demos.html','05-hands-on.html','06-share-and-close.html'];
  function clean(s){return (s||'').replace(/\s+/g,' ').trim();}
  function pageFile(){return location.pathname.split('/').pop()||'index.html';}
  function pageTitle(){var h=document.querySelector('main h1')||document.querySelector('h1');return clean(h?h.textContent:document.title);}
  function labelFor(el){
    if(el.getAttribute('data-export-label'))return el.getAttribute('data-export-label');
    var t='';if(el.id){var l=document.querySelector('label[for="'+el.id+'"]');if(l)t=l.textContent;}
    if(!t&&el.closest('label'))t=el.closest('label').textContent;
    if(!t)t=el.getAttribute('aria-label')||el.getAttribute('placeholder')||'';
    var sec=el.closest('details.section'),h=sec&&sec.querySelector('summary h2');
    return (h?clean(h.textContent)+' · ':'')+(clean(t)||el.getAttribute('data-persist'));
  }
  function recordMeta(el){sset('aw-meta:aw:'+el.getAttribute('data-persist'),JSON.stringify({label:labelFor(el),page:pageFile(),title:pageTitle(),type:el.type==='checkbox'?'checkbox':'text'}));}
  function bindPersist(scope){
    [].forEach.call((scope||document).querySelectorAll('[data-persist]'),function(el){
      if(el.__awBound)return;el.__awBound=true;var k='aw:'+el.getAttribute('data-persist');
      var v=sget(k);if(v!==null){if(el.type==='checkbox')el.checked=(v==='1');else el.value=v;if(v!==''&&v!=='0')recordMeta(el);}
      function save(){sset(k,el.type==='checkbox'?(el.checked?'1':'0'):el.value);recordMeta(el);updateCount();}
      el.addEventListener('input',save);el.addEventListener('change',save);
    });
  }
  window.awBindPersist=bindPersist;

  /* ---- My notes: collect, preview, export ---- */
  var STEPS=['identify','document','experiment','adjust'];
  function entries(){
    var out=[];if(!store)return out;
    for(var i=0;i<store.length;i++){
      var k=store.key(i);if(!k||k.indexOf('aw:')!==0)continue;var v=sget(k);var meta=null;
      try{meta=JSON.parse(sget('aw-meta:'+k)||'null');}catch(e){}
      var m=k.match(/^aw:idea:([^:]+):([a-z]+)$/);
      if(!meta)meta=m?{label:'IDEA: '+m[1]+' · '+m[2],page:'02-idea-your-projects.html',title:'Your projects through IDEA',type:'text'}:{label:k.slice(3),page:'',title:'Other notes',type:(v==='1'||v==='0')?'checkbox':'text'};
      if(meta.type==='checkbox'){if(v!=='1')continue;}else if(!v||!clean(v))continue;
      out.push({key:k,value:v,meta:meta,base:k.replace(/:(identify|document|experiment|adjust)$/,''),step:m?STEPS.indexOf(m[2]):-1});
    }
    out.sort(function(a,b){var pa=PAGES.indexOf(a.meta.page),pb=PAGES.indexOf(b.meta.page);if(pa<0)pa=99;if(pb<0)pb=99;
      return pa-pb||a.base.localeCompare(b.base,undefined,{numeric:true})||a.step-b.step;});
    return out;
  }
  function team(){return clean(sget('aw-team')||'');}
  function toMarkdown(){
    var es=entries(),L=['# Automating Without Overwhelming Yourself: my notes',''];
    if(team())L.push('**Table / names:** '+team(),'');
    L.push('Exported '+new Date().toLocaleString()+' from '+location.href.split('#')[0].replace(/[^/]*$/,''),'');
    var cur=null,inList=false;
    es.forEach(function(e){
      if(e.meta.title!==cur){if(inList){L.push('');inList=false;}cur=e.meta.title;L.push('## '+cur,'');}
      if(e.meta.type==='checkbox'){L.push('- [x] '+e.meta.label);inList=true;}
      else{if(inList){L.push('');inList=false;}L.push('### '+e.meta.label,'',e.value.replace(/\s+$/,''),'');}
    });
    if(!es.length)L.push('Nothing written yet.');
    return L.join('\n').replace(/\n{3,}/g,'\n\n')+'\n';
  }
  window.awNotesMarkdown=toMarkdown;
  function fileName(){var t=team().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');return 'automation-notes'+(t?'-'+t.slice(0,40):'')+'.md';}
  function download(){var blob=new Blob([toMarkdown()],{type:'text/markdown;charset=utf-8'}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=fileName();document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},800);}
  function printIt(){var w=window.open('','_blank');if(!w){alert('Your browser blocked the print window. Use Download instead.');return;}
    var esc=function(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;');};
    w.document.write('<!doctype html><title>My notes</title><pre style="white-space:pre-wrap;font:14px/1.5 -apple-system,Helvetica,Arial,sans-serif;max-width:780px;margin:24px auto">'+esc(toMarkdown())+'</pre>');
    w.document.close();w.focus();setTimeout(function(){w.print();},300);}
  var btn,panel,preview;
  function updateCount(){if(!btn)return;var n=entries().length;btn.querySelector('.aw-count').textContent=n;if(panel&&!panel.hidden)renderPreview();}
  function renderPreview(){
    preview.textContent='';var es=entries(),cur=null;
    if(!es.length){var p=document.createElement('p');p.className='muted';p.textContent='Nothing written yet. Type in any answer box on any page and it shows up here.';preview.appendChild(p);return;}
    es.forEach(function(e){
      if(e.meta.title!==cur){cur=e.meta.title;var h=document.createElement('h3');h.textContent=cur;preview.appendChild(h);}
      var d=document.createElement('div');d.className='item';var b=document.createElement('b');
      b.textContent=(e.meta.type==='checkbox'?'✓ ':'')+e.meta.label;d.appendChild(b);
      if(e.meta.type!=='checkbox'){var p2=document.createElement('p');p2.textContent=e.value;d.appendChild(p2);}
      preview.appendChild(d);
    });
  }
  function buildUI(){
    if(document.getElementById('aw-notes-btn'))return;
    btn=document.createElement('button');btn.type='button';btn.id='aw-notes-btn';btn.className='aw-notes-btn';
    btn.setAttribute('aria-controls','aw-notes-panel');btn.setAttribute('aria-expanded','false');
    btn.innerHTML='My notes <span class="aw-count">0</span>';
    panel=document.createElement('div');panel.id='aw-notes-panel';panel.className='aw-notes-panel';panel.hidden=true;
    panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','aw-notes-title');
    panel.innerHTML='<div class="aw-notes-head"><h2 id="aw-notes-title">My notes</h2><button type="button" class="aw-close" aria-label="Close my notes">Close</button></div>'+
      '<p class="muted">Everything you have typed on any page of this site. It is saved in this browser only, so download it before you leave.</p>'+
      '<label for="aw-team">Table and names</label><input id="aw-team" type="text" placeholder="Table 4: Ana, Ben, Chris">'+
      '<div class="aw-actions"><button type="button" class="btn btn-primary" data-aw="download">Download (.md)</button><button type="button" class="btn" data-aw="copy">Copy all</button><button type="button" class="btn" data-aw="print">Print or save as PDF</button></div>'+
      '<div class="aw-preview" aria-live="polite"></div>'+
      '<button type="button" class="aw-clear" data-aw="clear">Clear everything</button>';
    document.body.appendChild(panel);document.body.appendChild(btn);preview=panel.querySelector('.aw-preview');
    var tin=panel.querySelector('#aw-team');tin.value=sget('aw-team')||'';tin.addEventListener('input',function(){sset('aw-team',tin.value);});
    function open(o){panel.hidden=!o;btn.setAttribute('aria-expanded',o?'true':'false');if(o){renderPreview();panel.querySelector('.aw-close').focus();}else btn.focus();}
    btn.addEventListener('click',function(){open(panel.hidden);});
    panel.querySelector('.aw-close').addEventListener('click',function(){open(false);});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!panel.hidden)open(false);});
    panel.addEventListener('click',function(e){var a=e.target.closest('[data-aw]');if(!a)return;var act=a.getAttribute('data-aw');
      if(act==='download')download();else if(act==='copy')copyText(toMarkdown(),a);else if(act==='print')printIt();
      else if(act==='clear'&&confirm('Delete everything you have typed on every page of this site, in this browser?')){
        var ks=[];for(var i=0;i<store.length;i++){var k=store.key(i);if(k&&(k.indexOf('aw:')===0||k.indexOf('aw-meta:')===0))ks.push(k);}
        ks.forEach(sdel);sdel('aw-team');tin.value='';location.reload();}});
  }
  function init(){bindPersist();buildUI();updateCount();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.addEventListener('storage',updateCount);
})();
