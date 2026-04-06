'use strict';

/*  Constants  */
const LABEL_COLORS = {
  yellow:'#F7C948', teal:'#4ECDC4', coral:'#FF6B6B',
  blue:'#74B3F0',   purple:'#B78CF7', green:'#72C472'
};
const COL_DOTS = ['#F7C948','#4ECDC4','#FF6B6B','#74B3F0','#B78CF7','#72C472','#e8896a'];

const ZOOM_LEVELS = ['Day','Week','Month','Quarter'];
let zoomIdx = 1; // default: Week

/*  Default data  */
function today(offset=0){
  const d=new Date(); d.setDate(d.getDate()+offset);
  return d.toISOString().slice(0,10);
}
const DEFAULT_DATA = {
  projects:[],
  lastProjectId:null
};

/*  State  */
let board = null;
let currentView = 'kanban';
let modalColId  = null;
let modalCardId = null;
let selectedColor = 'none';
let dragCardId  = null;
let dragSrcCol  = null;
let activeMenu  = null;
let renameColId = null;
let placeholder = null;
let activeProjectId = null;
let activeTimelineId = null;

/*  Storage  */
function loadBoard(){
  return new Promise(r=>chrome.storage.local.get('Schedulo_board2',res=>
    r(res.Schedulo_board2 || JSON.parse(JSON.stringify(DEFAULT_DATA)))
  ));
}
function saveBoard(){ chrome.storage.local.set({Schedulo_board2:board}); }

function makeDefaultColumns(){
  return [
    {id:'col-'+uid(),name:'To Do',dotColor:'#F7C948',cards:[]},
    {id:'col-'+uid(),name:'In Progress',dotColor:'#4ECDC4',cards:[]},
    {id:'col-'+uid(),name:'Review',dotColor:'#74B3F0',cards:[]},
    {id:'col-'+uid(),name:'Done',dotColor:'#72C472',cards:[]},
  ];
}

function makeDefaultTimeline(name='Main Timeline'){
  const columns=makeDefaultColumns();
  const range=getTimelineDateRange(columns);
  return {
    id:'tl-'+uid(),
    name,
    start:range.start,
    due:range.due,
    columns
  };
}

function makeDefaultProject(name='New Project'){
  const cleanName=String(name||'').trim()||'New Project';
  return {
    id:'prj-'+uid(),
    name:cleanName,
    timelines:[makeDefaultTimeline()]
  };
}

function normalizeColumns(columns){
  const src = Array.isArray(columns) && columns.length ? columns : makeDefaultColumns();
  return src.map((col,idx)=>({
    id:col.id||('col-'+uid()),
    name:col.name||`List ${idx+1}`,
    dotColor:col.dotColor||COL_DOTS[idx%COL_DOTS.length],
    cards:Array.isArray(col.cards)
      ? col.cards.map(card=>({
          id:card.id||('c-'+uid()),
          title:card.title||'Untitled task',
          desc:card.desc||'',
          label:card.label||'',
          start:card.start||'',
          due:card.due||''
        }))
      : []
  }));
}

function getTimelineDateRange(columns){
  const dates=[];
  columns.forEach(col=>col.cards.forEach(card=>{
    if(card.start) dates.push(card.start);
    if(card.due) dates.push(card.due);
  }));
  dates.sort();
  return {
    start: dates[0] || today(-7),
    due: dates[dates.length-1] || today(21)
  };
}

function normalizeTimeline(rawTimeline,idx){
  const columns=normalizeColumns(rawTimeline && rawTimeline.columns);
  const range=getTimelineDateRange(columns);
  return {
    id:(rawTimeline && rawTimeline.id) || ('tl-'+uid()),
    name:(rawTimeline && rawTimeline.name) || `Timeline ${idx+1}`,
    start:(rawTimeline && rawTimeline.start) || range.start,
    due:(rawTimeline && rawTimeline.due) || range.due,
    columns
  };
}

function normalizeTimelines(timelines){
  const src=Array.isArray(timelines) ? timelines : [];
  if(!src.length) return [makeDefaultTimeline()];
  return src.map((timeline,idx)=>normalizeTimeline(timeline,idx));
}

function normalizeProject(rawProject,idx){
  return {
    id:(rawProject && rawProject.id) || ('prj-'+uid()),
    name:(rawProject && rawProject.name) || `Project ${idx+1}`,
    timelines:normalizeTimelines(rawProject && rawProject.timelines)
  };
}

function normalizeBoardData(raw){
  if(raw && Array.isArray(raw.projects)){
    const projects=raw.projects.map((project,idx)=>normalizeProject(project,idx));
    const fallbackId=projects[0] ? projects[0].id : null;
    const lastProjectId=projects.some(project=>project.id===raw.lastProjectId)
      ? raw.lastProjectId
      : fallbackId;
    return {projects,lastProjectId};
  }

  if(raw && Array.isArray(raw.timelines) && raw.timelines.length){
    const migratedProject={
      id:'prj-'+uid(),
      name:'Main Project',
      timelines:raw.timelines.map((timeline,idx)=>normalizeTimeline(timeline,idx))
    };
    return {
      projects:[migratedProject],
      lastProjectId:migratedProject.id
    };
  }

  const hasLegacyColumns=Boolean(raw && Array.isArray(raw.columns) && raw.columns.length);
  if(hasLegacyColumns){
    const legacyCols=normalizeColumns(raw.columns);
    const range=getTimelineDateRange(legacyCols);
    const migratedProject={
      id:'prj-'+uid(),
      name:'Main Project',
      timelines:[{
        id:'tl-'+uid(),
        name:'Main Timeline',
        start:range.start,
        due:range.due,
        columns:legacyCols
      }]
    };
    return {
      projects:[migratedProject],
      lastProjectId:migratedProject.id
    };
  }

  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function getProjects(){
  return board && Array.isArray(board.projects) ? board.projects : [];
}

function findProject(id){
  if(!id) return null;
  return getProjects().find(project=>project.id===id) || null;
}

function setActiveProject(projectId){
  const project=findProject(projectId);
  if(!project) return false;

  activeProjectId=project.id;
  if(board) board.lastProjectId=project.id;
  activeTimelineId=getInitialActiveTimelineId(project.timelines)
    || project.timelines[0]?.id
    || null;
  return true;
}

function getActiveProject(){
  const projects=getProjects();
  if(!projects.length){
    activeProjectId=null;
    activeTimelineId=null;
    return null;
  }

  let project=findProject(activeProjectId || (board && board.lastProjectId));
  if(!project) project=projects[0];

  activeProjectId=project.id;
  if(board) board.lastProjectId=project.id;

  const timelines=Array.isArray(project.timelines) ? project.timelines : [];
  if(!timelines.some(timeline=>timeline.id===activeTimelineId)){
    activeTimelineId=getInitialActiveTimelineId(timelines)
      || timelines[0]?.id
      || null;
  }
  return project;
}

function getActiveProjectTimelines(){
  const project=getActiveProject();
  if(!project || !Array.isArray(project.timelines)) return [];
  return project.timelines;
}

function findTimeline(id){
  const timelines=getActiveProjectTimelines();
  return timelines.find(timeline=>timeline.id===id) || null;
}

function getActiveTimeline(){
  const timelines=getActiveProjectTimelines();
  if(!timelines.length) return null;

  let timeline=findTimeline(activeTimelineId);
  if(!timeline){
    activeTimelineId=getInitialActiveTimelineId(timelines)
      || timelines[0]?.id
      || null;
    timeline=findTimeline(activeTimelineId) || timelines[0];
  }
  return timeline;
}

function getInitialActiveTimelineId(timelines){
  if(!Array.isArray(timelines) || !timelines.length) return null;

  const current=today();
  const inRange=timelines.find(
    tl=>tl.start && tl.due && tl.start<=current && tl.due>=current
  );
  if(inRange) return inRange.id;

  const upcoming=[...timelines]
    .filter(tl=>tl.start && tl.start>=current)
    .sort((a,b)=>a.start.localeCompare(b.start))[0];
  if(upcoming) return upcoming.id;

  return timelines[0].id;
}

function getColumns(){
  const timeline=getActiveTimeline();
  return timeline ? timeline.columns : [];
}

function addDays(dateStr,offset){
  const d=new Date(dateStr||today());
  d.setDate(d.getDate()+offset);
  return d.toISOString().slice(0,10);
}

function timelineLabel(timeline){
  return `${timeline.name} (${fmtDate(timeline.start)} - ${fmtDate(timeline.due)})`;
}

function syncTimelineSelect(){
  const sel=document.getElementById('timeline-select');
  if(!sel) return;

  const timelines=getActiveProjectTimelines();
  if(!timelines.length){
    sel.innerHTML='';
    const opt=document.createElement('option');
    opt.value='';
    opt.textContent='No timeline';
    sel.appendChild(opt);
    sel.disabled=true;
    return;
  }

  sel.disabled=false;
  const active=getActiveTimeline();
  sel.innerHTML='';
  timelines.forEach(tl=>{
    const opt=document.createElement('option');
    opt.value=tl.id;
    opt.textContent=timelineLabel(tl);
    sel.appendChild(opt);
  });
  if(active) sel.value=active.id;
}

/*  Helpers  */
function uid(){ return Math.random().toString(36).slice(2,8)+Date.now().toString(36); }
function esc(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
function safeFileToken(s){
  return String(s||'board')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')||'board';
}
function excelFilename(tag='board'){
  const d=new Date();
  const p=n=>String(n).padStart(2,'0');
  const dateStamp=`${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`;
  const timeStamp=`${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `${safeFileToken(tag)}-${dateStamp}-${timeStamp}.xls`;
}
function cellHtml(s){ return esc(String(s||'')).replace(/\n/g,'<br>'); }
function exportCardDateText(card){
  const start=card.start ? fmtDate(card.start) : '';
  const due=card.due ? fmtDate(card.due) : '';
  if(start&&due) return `${start} - ${due}`;
  return due||start;
}
function toYmd(dateObj){
  const y=dateObj.getFullYear();
  const m=String(dateObj.getMonth()+1).padStart(2,'0');
  const d=String(dateObj.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function triggerExcelDownload(html,filename){
  const blob=new Blob(['\ufeff',html],{type:'application/vnd.ms-excel;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function buildKanbanExportHtml(timeline){
  const boardCols=timeline.columns.map((col,ci)=>{
    const colColor=col.dotColor||COL_DOTS[ci%COL_DOTS.length]||'#666';
    const cards=col.cards.length
      ? col.cards.map(card=>{
          const barColor=card.label&&LABEL_COLORS[card.label] ? LABEL_COLORS[card.label] : '';
          const labelBar=barColor
            ? `<div class="k-card-label" style="background:${barColor};"></div>`
            : '';
          const desc=card.desc ? `<div class="k-card-desc">${cellHtml(card.desc)}</div>` : '';
          const dateText=exportCardDateText(card);
          const dueCls=card.due ? dueClass(card.due) : '';
          const dueHtml=dateText
            ? `<div class="k-card-due ${dueCls}">${cellHtml(dateText)}</div>`
            : '';
          return `<tr>
            <td class="k-card-wrap">
              ${labelBar}
              <div class="k-card-title">${cellHtml(card.title)}</div>
              ${desc}
              ${dueHtml}
            </td>
          </tr>`;
        }).join('')
      : '<tr><td class="k-empty">No cards yet</td></tr>';

    return `<td class="k-col-cell">
      <table class="k-col" cellspacing="0" cellpadding="0" role="presentation">
        <tr>
          <td class="k-col-head">
            <span class="k-col-dot" style="background:${colColor};"></span>
            <span>${cellHtml(col.name)}</span>
            <span class="k-col-count">${col.cards.length}</span>
          </td>
        </tr>
        <tr>
          <td class="k-col-body">
            <table class="k-cards" cellspacing="0" cellpadding="0" role="presentation">${cards}</table>
          </td>
        </tr>
      </table>
    </td>`;
  }).join('');

  return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      body{margin:0;padding:16px;background:#fff;font-family:Segoe UI,Arial,sans-serif;color:#121212}
      .k-title{font-size:16px;font-weight:700;margin:0 0 6px 0}
      .k-sub{font-size:11px;color:#5d5d5d;margin:0 0 14px 0}
      .k-board{border-collapse:separate;border-spacing:12px 0}
      .k-col-cell{vertical-align:top;width:220px}
      .k-col{width:220px;background:#fff;border:1px solid #d5d5d5;border-radius:12px}
      .k-col-head{padding:9px 10px;font-size:11px;font-weight:600;border-bottom:1px solid #e4e4e4;white-space:nowrap;background:#f8f8f8}
      .k-col-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}
      .k-col-count{float:right;background:#ececec;color:#454545;border-radius:999px;
        padding:1px 7px;font-size:10px;font-weight:500}
      .k-col-body{padding:7px}
      .k-cards{width:100%;border-collapse:separate;border-spacing:0 6px}
      .k-card-wrap{background:#fff;border:1px solid #dddddd;border-radius:9px;padding:8px}
      .k-card-label{height:3px;border-radius:999px;margin-bottom:6px}
      .k-card-title{font-size:11px;font-weight:600;color:#1f1f1f;line-height:1.35}
      .k-card-desc{font-size:10px;color:#666;line-height:1.45;margin-top:4px}
      .k-card-due{display:inline-block;margin-top:6px;font-size:9px;color:#555;
        background:#efefef;border-radius:3px;padding:2px 5px}
      .k-card-due.overdue{color:#c53030;background:#fdecec}
      .k-card-due.soon{color:#8a6700;background:#fff4cf}
      .k-empty{font-size:10px;color:#777;padding:8px;text-align:center}
    </style>
  </head>
  <body>
    <p class="k-title">${cellHtml(timeline.name)} - Schedulo Board Export</p>
    <p class="k-sub">
      Timeline ${cellHtml(fmtDate(timeline.start))} - ${cellHtml(fmtDate(timeline.due))}
      | Generated ${cellHtml(new Date().toLocaleString('en-GB'))}
    </p>
    <table class="k-board" role="presentation"><tr>${boardCols}</tr></table>
  </body>
  </html>`;
}

function buildGanttExportHtml(timelines){
  const ordered=[...timelines].sort((a,b)=>String(a.start||'').localeCompare(String(b.start||'')));
  const starts=ordered.map(tl=>tl.start).filter(Boolean).sort();
  const ends=ordered.map(tl=>tl.due).filter(Boolean).sort();

  let rangeStart=starts.length ? new Date(starts[0]) : new Date(today(-7));
  let rangeEnd=ends.length ? new Date(ends[ends.length-1]) : new Date(today(21));
  rangeStart.setHours(0,0,0,0);
  rangeEnd.setHours(0,0,0,0);

  if(rangeEnd<rangeStart){
    rangeEnd=new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate()+28);
  }

  const startIsoDay=(rangeStart.getDay()+6)%7;
  const endIsoDay=(rangeEnd.getDay()+6)%7;
  rangeStart.setDate(rangeStart.getDate()-startIsoDay);
  rangeEnd.setDate(rangeEnd.getDate()+(6-endIsoDay));

  const weeks=[];
  for(let cur=new Date(rangeStart);cur<=rangeEnd;cur.setDate(cur.getDate()+7)){
    const weekStart=new Date(cur);
    const weekEnd=new Date(cur);
    weekEnd.setDate(weekEnd.getDate()+6);
    weeks.push({
      start:weekStart,
      end:weekEnd,
      monthLabel:weekStart.toLocaleDateString('en-GB',{month:'short',year:'numeric'}),
      weekLabel:'W'+String(getISOWeek(weekStart)).padStart(2,'0')
    });
  }

  const monthGroups=[];
  weeks.forEach(week=>{
    const last=monthGroups[monthGroups.length-1];
    if(last && last.label===week.monthLabel){
      last.span+=1;
      return;
    }
    monthGroups.push({label:week.monthLabel,span:1});
  });

  const monthRow=monthGroups
    .map(group=>`<th class="g-month" colspan="${group.span}">${cellHtml(group.label)}</th>`)
    .join('');
  const weekRow=weeks
    .map(week=>`<th class="g-week">${cellHtml(week.weekLabel)}</th>`)
    .join('');

  const rows=ordered.map((timeline,idx)=>{
    const color=COL_DOTS[idx%COL_DOTS.length];
    const start=timeline.start||'';
    const due=timeline.due||'';

    const cells=weeks.map(week=>{
      const weekStart=toYmd(week.start);
      const weekEnd=toYmd(week.end);
      const inRange=start && due && start<=weekEnd && due>=weekStart;
      if(inRange){
        return `<td class="g-cell g-bar-cell" style="background:${color};border-color:${color};"></td>`;
      }
      return '<td class="g-cell"></td>';
    }).join('');

    return `<tr>
      <td class="g-name">${cellHtml(timeline.name)}</td>
      ${cells}
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      body{margin:0;padding:16px;background:#fff;font-family:Segoe UI,Arial,sans-serif;color:#111}
      .g-title{font-size:16px;font-weight:700;margin:0 0 6px 0}
      .g-sub{font-size:11px;color:#5d5d5d;margin:0 0 12px 0}
      .g-table{border-collapse:collapse;table-layout:fixed}
      .g-head-name{min-width:220px;text-align:left;padding:6px 8px;border:1px solid #cfcfcf;background:#f5f5f5;font-size:11px}
      .g-month{min-width:28px;text-align:center;padding:4px 2px;border:1px solid #cfcfcf;background:#f5f5f5;font-size:10px}
      .g-week{text-align:center;padding:4px 2px;border:1px solid #dfdfdf;background:#fafafa;font-size:10px;color:#444}
      .g-name{padding:6px 8px;border:1px solid #dfdfdf;font-size:11px;white-space:nowrap}
      .g-cell{width:28px;height:18px;border:1px solid #efefef;background:#fff}
      .g-bar-cell{border-color:transparent}
    </style>
  </head>
  <body>
    <p class="g-title">Schedulo Gantt Export</p>
    <p class="g-sub">Generated ${cellHtml(new Date().toLocaleString('en-GB'))}</p>
    <table class="g-table" cellspacing="0" cellpadding="0" role="presentation">
      <tr>
        <th class="g-head-name" rowspan="2">Timeline</th>
        ${monthRow}
      </tr>
      <tr>${weekRow}</tr>
      ${rows}
    </table>
  </body>
  </html>`;
}

function exportBoardToExcel(){
  if(!board){
    loadBoard().then(data=>{ board=normalizeBoardData(data); exportBoardToExcel(); });
    return;
  }

  const activeProject=getActiveProject();
  const projectFileTag=activeProject && activeProject.name
    ? activeProject.name
    : 'project';

  if(currentView==='gantt'){
    const timelines=getActiveProjectTimelines();
    if(!timelines.length){
      alert('No timelines to export yet.');
      return;
    }
    const html=buildGanttExportHtml(timelines);
    triggerExcelDownload(html,excelFilename(projectFileTag));
    return;
  }

  const timeline=getActiveTimeline();
  if(!timeline){
    alert('No timeline to export yet.');
    return;
  }
  if(!timeline.columns.length){
    alert('No lists to export yet.');
    return;
  }

  const html=buildKanbanExportHtml(timeline);
  triggerExcelDownload(html,excelFilename(projectFileTag));
}
function findCol(id){ return getColumns().find(c=>c.id===id); }
function findCard(id){
  for(const col of getColumns()){
    const card=col.cards.find(c=>c.id===id);
    if(card) return {col,card};
  }
  return null;
}
function dueClass(due){
  if(!due) return '';
  const today=new Date(); today.setHours(0,0,0,0);
  const d=new Date(due);
  if(d<today) return 'overdue';
  return ((d-today)/86400000)<=2 ? 'soon' : '';
}
function fmtDate(s){
  if(!s) return '';
  const d=new Date(s);
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}
function isDateWithinRange(dateStr,start,end){
  if(!dateStr) return true;
  return dateStr>=start && dateStr<=end;
}
function validateTaskDatesInTimeline(taskStart,taskDue,timeline){
  if(taskStart && taskDue && taskDue<taskStart){
    return {ok:false,message:'Due date cannot be earlier than start date.',field:'due'};
  }
  if(!timeline) return {ok:true};

  if(taskStart && !isDateWithinRange(taskStart,timeline.start,timeline.due)){
    return {
      ok:false,
      message:`Start date must be within timeline (${fmtDate(timeline.start)} - ${fmtDate(timeline.due)}).`,
      field:'start'
    };
  }
  if(taskDue && !isDateWithinRange(taskDue,timeline.start,timeline.due)){
    return {
      ok:false,
      message:`Due date must be within timeline (${fmtDate(timeline.start)} - ${fmtDate(timeline.due)}).`,
      field:'due'
    };
  }
  return {ok:true};
}
function setCardDateBounds(){
  const timeline=getActiveTimeline();
  const si=document.getElementById('card-start-input');
  const ui=document.getElementById('card-due-input');
  if(!si || !ui) return;

  if(timeline && timeline.start && timeline.due){
    si.min=timeline.start; si.max=timeline.due;
    ui.min=timeline.start; ui.max=timeline.due;
    return;
  }
  si.removeAttribute('min'); si.removeAttribute('max');
  ui.removeAttribute('min'); ui.removeAttribute('max');
}

function bindWheelScroll(el){
  if(!el) return;

  el.addEventListener('wheel',e=>{
    if(e.ctrlKey) return;

    const canScrollX=el.scrollWidth>el.clientWidth;
    if(!canScrollX) return;

    const canScrollY=el.scrollHeight>el.clientHeight+1;
    const horizontalIntent=e.shiftKey || Math.abs(e.deltaX)>Math.abs(e.deltaY);

    if(canScrollY && !horizontalIntent) return;

    const delta=horizontalIntent
      ? (e.deltaX || e.deltaY)
      : e.deltaY;

    if(!delta) return;

    const before=el.scrollLeft;
    el.scrollLeft+=delta;
    if(el.scrollLeft!==before) e.preventDefault();
  },{passive:false});
}

function showAppDialog(options){
  const {
    title='Schedulo',
    message='',
    confirmText='OK',
    cancelText='',
    danger=false
  }=options||{};

  return new Promise(resolve=>{
    const overlay=document.createElement('div');
    overlay.className='modal-overlay app-dialog-overlay';

    const modal=document.createElement('div');
    modal.className='modal app-dialog';
    const msgHtml=esc(String(message||'')).replace(/\n/g,'<br>');
    modal.innerHTML=`
      <div class="modal-header">
        <span class="modal-title app-dialog-title">${esc(String(title||'Schedulo'))}</span>
      </div>
      <div class="app-dialog-message">${msgHtml}</div>
      <div class="modal-actions app-dialog-actions"></div>
    `;

    const actions=modal.querySelector('.app-dialog-actions');
    let settled=false;

    const cleanup=()=>{
      document.removeEventListener('keydown',onKeyDown);
      overlay.remove();
    };

    const finish=result=>{
      if(settled) return;
      settled=true;
      cleanup();
      resolve(result);
    };

    const onKeyDown=e=>{
      if(e.key==='Escape'){
        e.preventDefault();
        finish(cancelText ? false : true);
      }
      if(e.key==='Enter'){
        e.preventDefault();
        finish(true);
      }
    };

    if(cancelText){
      const cancelBtn=document.createElement('button');
      cancelBtn.className='btn-ghost';
      cancelBtn.textContent=cancelText;
      cancelBtn.addEventListener('click',()=>finish(false));
      actions.appendChild(cancelBtn);
    }

    const okBtn=document.createElement('button');
    okBtn.className=`btn-accent${danger?' app-btn-danger':''}`;
    okBtn.textContent=confirmText;
    okBtn.addEventListener('click',()=>finish(true));
    actions.appendChild(okBtn);

    overlay.addEventListener('click',e=>{
      if(e.target===overlay){
        finish(cancelText ? false : true);
      }
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.addEventListener('keydown',onKeyDown);
    okBtn.focus();
  });
}

function showAppAlert(message,title='Schedulo'){
  return showAppDialog({
    title,
    message,
    confirmText:'OK'
  });
}

function showAppConfirm(message,options={}){
  return showAppDialog({
    title:options.title||'Schedulo',
    message,
    confirmText:options.confirmText||'OK',
    cancelText:options.cancelText||'Cancel',
    danger:Boolean(options.danger)
  });
}
