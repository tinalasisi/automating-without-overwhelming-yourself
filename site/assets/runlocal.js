/* "Run it on your laptop": turns the folder, tool and computer a student picks into exact terminal
   commands and a prompt to paste. Used on the demos page (data-mode="demo") and the hands-on page (data-mode="build"). */
(function(){
  var REPO='https://github.com/tinalasisi/automating-without-overwhelming-yourself';
  var RAW='https://raw.githubusercontent.com/tinalasisi/automating-without-overwhelming-yourself/main/site/';
  var P=["Look in demo1-intake. form_zell_application_responses.csv is 16 responses exported from a law clinic's intake Google Form. It's the original, so don't edit it.\n\nThe smallest useful step: every application gets a status, so nobody gets lost.\n\nWrite a short Python script, triage.py, that writes pipeline.csv with every row plus three new columns: status, review_reason, and flag.\n- status is \"new\" by default.\n- Change it to \"needs review\" and give the reason if: the same email address already applied in an earlier row; the business description is blank; the applicant says they are not a student; or they ask for help with a patent (this clinic doesn't do patents).\n- If the free text mentions a date or says \"urgent\", copy that phrase into flag. Don't act on it.\n\nBefore you run anything, explain the script in plain English. Then run it and show me only the rows that need review or have a flag.", "Now add a summary column: for rows with status \"new\" only, one line naming the business and the legal help it needs. Don't change any status.", "Look in demo2-catalog. shared_drive_dump.csv lists 25 files from an old shared drive: name, date modified, folder, size, and the first line of each file. Work only from this listing. Don't open, move, or delete anything.\n\nThe smallest useful step: a catalog someone could actually search.\n\nBuild catalog.csv with one row per file and these columns: topic (a few words), version_group (files that are versions of the same document share a group name), keep (yes for the one version worth keeping in each group), duplicate_of (for exact copies), pii (yes if the name or first line suggests student IDs or other personal information), and junk (system files).\n\nUse code for the exact checks: duplicates, junk files, PII keywords. Use your own judgment only for topic and version_group, and tell me which columns came from which. Then list the files a person should look at before anything gets indexed, and why.", "Look in demo3-one-table. Two offices keep spreadsheets about the same gift funds: funds_development.csv and funds_finance.csv. Both are originals, so don't edit them. The account number is the shared key, but the two offices write it differently.\n\nThe smallest useful step: one table, one row per fund.\n\nWrite merge.py to build funds_combined.csv by joining the two sheets on the account number after cleaning up the format. Explain the matching rule in plain English before you run it. Then show me three lists: funds that appear in only one sheet; duplicate rows; and funds whose last stewardship letter is more than 12 months before today, 2026-09-27, or missing.\n\nI don't think any of this needs AI. Tell me if you disagree."]; /* verbatim from demos/PROMPTS.md: demo 1, demo 1 second beat, demo 2, demo 3 */
  var DEMOS={
    '1':{name:'Demo 1 · Intake → triage',folder:'demo1-intake',prompt:0,extra:1,file:'form_zell_application_responses.csv'},
    '2':{name:'Demo 2 · Pile → catalog',folder:'demo2-catalog',prompt:2,file:'shared_drive_dump.csv'},
    '3':{name:'Demo 3 · Many sheets → one table',folder:'demo3-one-table',prompt:3,file:'funds_development.csv'}};
  var PROJ={
    zell:{name:'Zell Entrepreneurship Clinic',files:'form_zell_application_responses.csv',unit:'Every application gets a status, so nobody gets lost.',output:'pipeline.csv',columns:'status, review_reason, flag',
      rules:'status is "new" by default\nThe same email address already applied in an earlier row: needs review\nThe business description is blank: needs review\nThe applicant says they are not a student: needs review\nThey ask for help with a patent (the clinic does not do patents): needs review\nThe free text mentions a date or says "urgent": copy that phrase into flag, and do not act on it',judgment:''},
    mta:{name:'Innovation Partnerships MTA',files:'form_mta_screening_responses.csv',unit:'Every request is marked eligible for the standard agreement, not eligible, or needs review.',output:'screened.csv',columns:'eligibility, reason',
      rules:'Eligible only if: the other party is Academic / non-profit or Government; commercial use is No; there is no patent or invention report; the material is not human-derived; it is not hazardous or export-controlled; and no publication review or rights are requested\nAny answer of "Not sure" or "?": needs review, never assume No\nA missing date: needs review\nThe same PI, material and date twice: keep one record and flag the duplicate',judgment:''},
    dining:{name:'Michigan Dining sustainability',files:'form_dining_sustainability_responses.csv',unit:'Every response gets a draft next step for Kenzie to review.',output:'next_steps.csv',columns:'next_step_draft, review_reason',
      rules:'An answer that mentions a second pillar: needs review\nNo goal given: still suggest a next step from the pillar and what they do now\nAlready at best practice: the next step is to share the practice, not to do more',judgment:'next_step_draft'},
    ovpr:{name:'OVPR limited submissions',files:'requests_inbox.csv',unit:'Every limited-submission request becomes a row with the funder, both deadlines, and the question.',output:'limited_submissions.csv',columns:'funder, internal_deadline, funder_deadline, question, superseded_by, review_reason',
      rules:'Only include messages about limited submissions\nThe funder deadline and the internal deadline go in separate columns; never mix them up\nA later message about the same funder supersedes the earlier one: fill superseded_by\nNo clear deadline: needs review',judgment:'funder, deadlines and question, read from the message text'},
    oakland:{name:'Oakland County records / FOIA',files:'requests_inbox.csv',unit:'Every FOIA request becomes a row: requester, scope, date range, and whether it repeats an earlier one.',output:'foia_requests.csv',columns:'requester, scope, date_range, duplicate_of, review_reason',
      rules:'Only include FOIA requests\nExactly the same text as an earlier request: fill duplicate_of with that id\nNo date range given: needs review',judgment:'requester, scope and date_range, read from the message text'},
    cai:{name:'CAI AI Enablement',files:'requests_inbox.csv',unit:'Every incoming request gets a category and a next action, so nothing sits unrouted.',output:'routed_requests.csv',columns:'category, ask, deadline, next_action, review_reason',
      rules:'One message asking for two things: needs review\nA deadline that appears only in quoted text: flag it, do not trust it\nAn FYI with no ask: category FYI, next_action none\nThe same sender and ask as an earlier message: merge them',judgment:'category and ask'},
    ginsberg:{name:'Ginsberg Center archive',files:'shared_drive_dump.csv',unit:'A catalog of the old drive with duplicates, versions and personal information flagged.',output:'catalog.csv',columns:'topic, version_group, keep, duplicate_of, pii, junk',
      rules:'Work only from the listing; do not open, move or delete any file\nThe same name, or the same size and first line: fill duplicate_of\nthumbs.db and files starting with ~$: junk\nA name or first line that suggests student IDs or a roster: pii = yes (delete, never index)\nIn each version group, keep = yes for the newest or the one marked FINAL',judgment:'topic and version_group'},
    fja:{name:'FJA staff AI portal',files:'terrible_notes.txt',unit:'Three messy notes become named, tagged prompts with an owner.',output:'prompt_library.csv',columns:'title, tags, owner, rewritten_note, review_reason',
      rules:'Pick the three notes most useful to school staff\nExpand every abbreviation\nAny note with personal or student information: needs review, and leave it out',judgment:'title, tags and the rewrite'},
    marsal:{name:'Marsal gift funds',files:'funds_development.csv, funds_finance.csv',unit:'One table, one row per fund.',output:'funds_combined.csv',columns:'account, fund_name, balance, last_letter, in_sheets, alert',
      rules:'Join the two sheets on the account number after cleaning it (keep digits only)\nList funds that appear in only one sheet\nFlag duplicate rows\nLast stewardship letter more than 12 months before today, or missing: alert',judgment:''},
    wbb:{name:"Women's Basketball",files:'',unit:'One intake sheet keyed on player, instead of three entries.',output:'players.csv',columns:'player, in_sheets, conflicts',
      rules:'Match players on name and graduation year after cleaning spacing and capitalization\nThe same player with different details in two sheets: conflicts, needs review\nA player in only one sheet: list them',judgment:'',
      hint:'There is no ready-made file for your project. First ask U-M GPT for two small fake sheets that share a player column (the prompt is in the recipe, Step 2), save them into your work folder, and put their names in "Data files".'},
    facdev:{name:'Michigan Medicine Faculty Development',files:'form_faculty_interest_responses.csv',unit:'Every faculty member gets the topics to target, leaving out what they already attended.',output:'targets.csv',columns:'topics_to_offer, review_reason',
      rules:'Split "Topics you want" into separate topics\nRemove topics they already attended a workshop on\nNo interests listed: needs review; do not match on rank alone\nNothing left in their first interest: fall back to their second',judgment:''},
    own:{name:'Something else',files:'',unit:'',output:'results.csv',columns:'status, review_reason',rules:'',judgment:''}};
  var ORDER=['zell','mta','dining','ovpr','oakland','cai','ginsberg','fja','marsal','wbb','facdev','own'];
  var DEFAULT_PATH='~/automating-without-overwhelming-yourself';

  function h(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function base(p){p=(p||'').trim().replace(/^["']+|["']+$/g,'').replace(/[\\\/]+$/,'');return p||null;}
  var NAME='automating-without-overwhelming-yourself';
  function goRepo(os,root){
    if(root)return 'cd '+q(os,root);
    return os==='win'
      ?'$r = Get-ChildItem $HOME -Directory -Recurse -Depth 3 -Filter '+NAME+' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($r) { Set-Location $r.FullName; Get-Location } else { "Not found. Clone the repo first." }'
      :'R=$(find ~ -maxdepth 4 \\( -path ~/Library -o -path ~/.Trash \\) -prune -o -type d -name '+NAME+' -print 2>/dev/null | head -1); if [ -n "$R" ]; then cd "$R" && pwd; else echo "Not found. Clone the repo first."; fi';
  }
  function rel(os){return [].slice.call(arguments,1).join(os==='win'?'\\':'/');}
  function goStep(os,root){return step('Go to your copy of the repo.',block('Terminal',goRepo(os,root))+(root?'':'<p class="rl-hint">This finds the folder you cloned, wherever it is, and moves you into it. It prints the folder it found. If it says “Not found”, run <code>git clone '+REPO+'.git</code> first, then run this again. Two copies? It picks the first one; paste the right path in step 1 instead.</p>'))+step('Get the latest version.',block('Terminal','git pull'));}
  function join(os){var sep=os==='win'?'\\':'/';return [].slice.call(arguments,1).join(sep);}
  function q(os,p){if(os!=='win'&&p.indexOf('~/')===0)return '~/"'+p.slice(2)+'"';return '"'+p+'"';}
  function and(os){return os==='win'?'; ':' && ';}
  function files(s){return (s||'').split(/\s*(?:,|\+|\n)\s*/).map(function(x){return x.trim();}).filter(Boolean);}
  var uid=0;
  function block(label,text,lang){uid++;var id='rl-'+uid;return '<div class="prompt"><div class="prompt-head"><span>'+h(label)+'</span><button type="button" data-copy="'+id+'">Copy</button></div><pre id="'+id+'">'+h(text)+'</pre></div>';}
  function sel(id,key,label,opts){return '<div><label for="'+id+'">'+h(label)+'</label><select id="'+id+'" data-persist="'+key+'" data-export-label="'+h(label)+'">'+opts.map(function(o){return '<option value="'+o[0]+'">'+h(o[1])+'</option>';}).join('')+'</select></div>';}
  function common(m){
    return '<div class="rl-grid">'+
      '<div class="rl-wide"><label for="'+m+'-path">1. Where is your copy of the repo? (optional)</label><input type="text" id="'+m+'-path" data-persist="local:path" data-export-label="Where the repo is on my laptop" placeholder="Leave empty: the first command finds it for you">'+
      '<p class="rl-hint">Already cloned it? Leave this empty. The first command below finds your copy wherever you put it. If you know the path, paste it here instead. To see it, go into the folder in your terminal and type <code>pwd</code> (Mac) or <code>Get-Location</code> (Windows).</p></div>'+
      sel(m+'-os','local:os','2. Your computer',[['mac','Mac or Linux (Terminal)'],['win','Windows (PowerShell)']])+
      sel(m+'-tool','local:tool','3. Your AI tool',[['claude','Claude Code'],['codex','Codex'],['gpt','No agent installed: U-M GPT']])+
      '</div>';
  }
  function tips(){
    return '<details class="reveal"><summary>How to write a good prompt</summary><ul>'+
      '<li><b>Say what it is for.</b> The smallest useful step, in one sentence.</li>'+
      '<li><b>Name the input and the output.</b> Which file it reads, which file it writes, which columns.</li>'+
      '<li><b>Put exact checks in code.</b> Say where it may use its own judgment, and ask it to tell you which is which.</li>'+
      '<li><b>Ask for “needs review”, not guesses.</b> A row that doesn\'t fit the rules gets a reason, not a made-up answer.</li>'+
      '<li><b>Ask for the plan first.</b> “Explain it in plain English before you run anything.” Then actually read it.</li>'+
      '<li><b>Change one thing at a time.</b> Ask for one fix, rerun, look again.</li></ul></details>';
  }
  var FOLLOW=['Explain the loop in plain English. Where would I add a new field?',
    'Row __ should be "needs review", not "new". Add a rule for it and run it again.',
    'What does this script need permission to do? Does it touch anything outside this folder?',
    'Show me the three rows you are least sure about, and why.',
    'Write a short README next to the script: what it does, the rules it uses, and who should maintain it.'];
  function followups(){return '<ul class="rl-follow">'+FOLLOW.map(function(f){return '<li>'+block('Follow-up',f)+'</li>';}).join('')+'</ul>';}
  function step(title,body){return '<li><b>'+title+'</b>'+body+'</li>';}
  function openTerm(os){return os==='win'?'<p>Press the Windows key, type <b>PowerShell</b>, press Enter.</p>':'<p>Press <kbd>Cmd</kbd>+<kbd>Space</kbd>, type <b>Terminal</b>, press Enter.</p>';}
  function startAgent(os,tool,dir){var cmd=tool==='codex'?'codex':'claude';return block('Terminal','cd '+dir+and(os)+cmd);}
  function agentNotes(tool){
    return tool==='codex'
      ?'<p>Codex reads <code>AGENTS.md</code> first: the house rules. Depending on its approval mode, it asks before running commands. Approve each one after you read what it wants to do.</p>'
      :'<p>The first time, Claude Code asks whether you trust this folder: choose <b>Yes</b>. It reads <code>CLAUDE.md</code> first: the house rules. When it asks to create a file or run a command, read the request, then choose <b>Yes</b>. If it never asks, it is in automatic mode.</p>';
  }
  function renderDemo(box){
    var m='rld';
    box.innerHTML=common(m)+'<div class="rl-grid">'+sel(m+'-which','local:demo','4. Which demo?',[['1',DEMOS['1'].name],['2',DEMOS['2'].name],['3',DEMOS['3'].name]])+'</div><div class="rl-out" aria-live="polite"></div>';
    if(window.awBindPersist)window.awBindPersist(box);
    function draw(){
      uid=0;var os=box.querySelector('#'+m+'-os').value,tool=box.querySelector('#'+m+'-tool').value,d=DEMOS[box.querySelector('#'+m+'-which').value]||DEMOS['1'];
      var root=base(box.querySelector('#'+m+'-path').value),demos=rel(os,'site','demos'),folder=rel(os,'site','demos',d.folder),py=os==='win'?'python':'python3';
      var s='<ol class="steps rl-steps">'+step('Open a terminal.',openTerm(os))+goStep(os,root);
      if(tool==='gpt'){
        s+=step('Open the demo data.','<p><a href="'+RAW+'demos/'+d.folder+'/'+d.file+'" target="_blank" rel="noopener">'+h(d.file)+'</a> (opens as plain text). Select all and copy it.</p>')+
          step('In U-M GPT, paste the prompt, then the data.',block('Prompt for U-M GPT',P[d.prompt]+'\n\nWrite the complete Python script and explain it in plain English. Here is the file:'))+
          step('Save and run the script it writes.','<p>Save the script with a text editor into <code>'+h(folder)+'</code> inside your copy, for example as <code>script.py</code>, then:</p>'+block('Terminal','cd '+folder+and(os)+py+' script.py'));
      }else{
        s+=step('Start '+(tool==='codex'?'Codex':'Claude Code')+' in the demos folder.',startAgent(os,tool,demos)+agentNotes(tool))+
          step('Paste this prompt and press Enter.',block('Prompt · '+d.name,P[d.prompt]));
        if(d.extra!=null)s+=step('Optional second beat: the AI part.',block('Prompt',P[d.extra]));
      }
      s+=step('Look at what it made.','<p>Ask it: <i>“Show me the first rows of the file you made.”</i> Or quit (<code>/exit</code> in Claude Code, <kbd>Ctrl</kbd>+<kbd>C</kbd> in Codex) and open the folder:</p>'+block('Terminal',tool==='gpt'?(os==='win'?'ii .':'open .'):(os==='win'?'ii ':'open ')+d.folder)+'<p>Compare it with “Reveal: what it should find” further down this page. To run it again from scratch, delete the new files it created and keep the original data.</p>')+'</ol>'+tips();
      box.querySelector('.rl-out').innerHTML=s;
    }
    box.addEventListener('input',draw);box.addEventListener('change',draw);draw();
  }
  function renderBuild(box){
    var m='rlb';
    var opts=ORDER.map(function(k){return [k,PROJ[k].name];});
    box.innerHTML=common(m)+
      '<div class="rl-grid">'+sel(m+'-proj','build:project','4. Your project',opts)+'<div><label for="'+m+'-files">Data files</label><input type="text" id="'+m+'-files" data-persist="build:files" data-export-label="Data files" placeholder="form_zell_application_responses.csv"></div></div>'+
      '<p class="rl-hint rl-proj-hint"></p>'+
      '<p class="rl-hint">Picking a project fills in a starting point from its planted problems. Edit anything: this is your prompt.</p>'+
      '<div class="rl-grid"><div class="rl-wide"><label for="'+m+'-unit">5. Your smallest useful step, in one sentence</label><textarea id="'+m+'-unit" rows="2" data-persist="build:unit" data-export-label="Smallest useful step"></textarea></div>'+
      '<div><label for="'+m+'-output">Output file</label><input type="text" id="'+m+'-output" data-persist="build:output" data-export-label="Output file"></div>'+
      '<div><label for="'+m+'-columns">New columns</label><input type="text" id="'+m+'-columns" data-persist="build:columns" data-export-label="New columns"></div>'+
      '<div class="rl-wide"><label for="'+m+'-rules">Rules, one per line</label><textarea id="'+m+'-rules" rows="5" data-persist="build:rules" data-export-label="Rules"></textarea></div>'+
      '<div class="rl-wide"><label for="'+m+'-judgment">Where it may use its own judgment (optional)</label><input type="text" id="'+m+'-judgment" data-persist="build:judgment" data-export-label="Where judgment is allowed" placeholder="Leave empty to keep every check in code"></div></div>'+
      '<div class="rl-out" aria-live="polite"></div>';
    if(window.awBindPersist)window.awBindPersist(box);
    var F=function(id){return box.querySelector('#'+m+'-'+id);};
    function fill(k){var d=PROJ[k]||PROJ.own;F('files').value=d.files;F('unit').value=d.unit;F('output').value=d.output;F('columns').value=d.columns;F('rules').value=d.rules;F('judgment').value=d.judgment;
      ['files','unit','output','columns','rules','judgment'].forEach(function(id){F(id).dispatchEvent(new Event('input',{bubbles:true}));});}
    F('proj').addEventListener('change',function(){fill(F('proj').value);});
    if(!F('unit').value&&!F('rules').value)fill(F('proj').value);
    function prompt(){
      var fs=files(F('files').value),many=fs.length>1,txt=fs.length&&!/\.csv$/i.test(fs[0]);
      var L=[];
      L.push((fs.length?'Look at '+fs.join(' and ')+' in this folder. '+(many?'They are the originals, so don\'t edit them.':'It\'s the original, so don\'t edit it.'):'Look at the data files in this folder. They are the originals, so don\'t edit them.')+' Everything here is dummy data.','');
      if(F('unit').value.trim())L.push('The smallest useful step: '+F('unit').value.trim(),'');
      var cols=F('columns').value.trim(),out=F('output').value.trim()||'results.csv';
      L.push('Write a short Python script that creates '+out+(cols?(txt?' with these columns: ':' with every original row plus these new columns: ')+cols:'')+'.');
      var rules=F('rules').value.split('\n').map(function(r){return r.trim();}).filter(Boolean);
      if(rules.length){L.push('Rules, in code:');rules.forEach(function(r){L.push('- '+r);});}
      L.push('If a row doesn\'t fit the rules, mark it "needs review" and give the reason. Don\'t guess.');
      var j=F('judgment').value.trim();
      L.push(j?'Use your own judgment only for '+j+', and tell me which columns came from judgment.':'Put every check in code. Don\'t use your own judgment unless I ask.');
      L.push('','Before you run anything, explain the script in plain English. Then run it and show me only the rows that need review.');
      return L.join('\n');
    }
    function draw(){
      uid=100;var os=F('os').value,tool=F('tool').value,root=base(F('path').value),work='my-work',py=os==='win'?'python':'python3';
      var d=PROJ[F('proj').value]||PROJ.own;box.querySelector('.rl-proj-hint').textContent=d.hint||'';
      var fs=files(F('files').value),srcs=fs.map(function(f){return rel(os,'site','data',f);}),rules=[rel(os,'site','demos','CLAUDE.md'),rel(os,'site','demos','AGENTS.md')];
      var all=srcs.concat(rules),copy=os==='win'
        ?'New-Item -ItemType Directory -Force my-work | Out-Null; Copy-Item '+all.join(', ')+' -Destination my-work'
        :'mkdir -p my-work && cp '+all.join(' ')+' my-work/';
      var s='<ol class="steps rl-steps">'+step('Open a terminal.',openTerm(os))+goStep(os,root)+
        step('Make your own work folder, with your data and the house rules.',block('Terminal',copy)+'<p class="rl-hint">This copies your data file'+(fs.length>1?'s':'')+' and the house rules into <code>my-work</code> inside your copy of the repo. The originals stay untouched.</p>');
      if(tool==='gpt'){
        s+=step('Open your data.','<p>'+(fs.length?fs.map(function(f){return '<a href="'+RAW+'data/'+h(f)+'" target="_blank" rel="noopener">'+h(f)+'</a>';}).join(', '):'Your data file')+' (opens as plain text). Select all and copy it.</p>')+
          step('In U-M GPT, paste your prompt, then the data.',block('Your prompt for U-M GPT',prompt()+'\n\nWrite the complete Python script and explain it in plain English. Here is the data:'))+
          step('Save and run the script it writes.','<p>Save it with a text editor in <code>my-work</code> inside your copy, for example as <code>script.py</code>, then:</p>'+block('Terminal','cd my-work'+and(os)+py+' script.py'));
      }else{
        s+=step('Start '+(tool==='codex'?'Codex':'Claude Code')+' in your work folder.',startAgent(os,tool,work)+agentNotes(tool))+
          step('Paste your prompt and press Enter.',block('Your prompt',prompt()));
      }
      s+=step('When it hits a planted problem, decide: a rule, or manual review?','<p>Then tell it, one change at a time. Useful follow-ups:</p>'+followups())+
        step('Record it.','<p>Put your prompt and what it hit in the build log on this page. The <b>My notes</b> button saves everything, including this prompt.</p>')+'</ol>'+tips();
      box.querySelector('.rl-out').innerHTML=s;
    }
    box.addEventListener('input',draw);box.addEventListener('change',draw);draw();
  }
  function init(){[].forEach.call(document.querySelectorAll('.runlocal'),function(b){if(b.getAttribute('data-mode')==='build')renderBuild(b);else renderDemo(b);});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
