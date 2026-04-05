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
  timelines:[
    {
      id:'tl-1',
      name:'Main Timeline',
      start:today(-7),
      due:today(21),
      columns:[
        {id:'col-1',name:'To Do',     dotColor:'#F7C948',cards:[
          {id:'c-1',title:'Market research', desc:'',label:'blue',  start:today(-5),  due:today(3)},
          {id:'c-2',title:'Write brief',     desc:'',label:'purple',start:today(-2),  due:today(5)},
        ]},
        {id:'col-2',name:'In Progress',dotColor:'#4ECDC4',cards:[
          {id:'c-3',title:'Design popup UI', desc:'Figma wireframes',label:'teal',start:today(-1),due:today(6)},
        ]},
        {id:'col-3',name:'Review',    dotColor:'#74B3F0',cards:[]},
        {id:'col-4',name:'Done',      dotColor:'#72C472',cards:[]},
      ]
    }
  ]
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

function normalizeBoardData(raw){
  if(raw && Array.isArray(raw.timelines) && raw.timelines.length){
    return {
      timelines: raw.timelines.map((tl,idx)=>{
        const columns=normalizeColumns(tl.columns);
        const range=getTimelineDateRange(columns);
        return {
          id:tl.id||('tl-'+uid()),
          name:tl.name||`Timeline ${idx+1}`,
          start:tl.start||range.start,
          due:tl.due||range.due,
          columns
        };
      })
    };
  }

  const legacyCols=normalizeColumns(raw && raw.columns);
  const range=getTimelineDateRange(legacyCols);
  return {
    timelines:[{
      id:'tl-'+uid(),
      name:'Main Timeline',
      start:range.start,
      due:range.due,
      columns:legacyCols
    }]
  };
}

function findTimeline(id){
  if(!board || !Array.isArray(board.timelines)) return null;
  return board.timelines.find(tl=>tl.id===id) || null;
}

function getActiveTimeline(){
  if(!board || !Array.isArray(board.timelines) || !board.timelines.length) return null;
  let timeline=findTimeline(activeTimelineId);
  if(!timeline){
    activeTimelineId=board.timelines[0].id;
    timeline=board.timelines[0];
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
  if(!sel || !board || !Array.isArray(board.timelines)) return;
  const active=getActiveTimeline();
  sel.innerHTML='';
  board.timelines.forEach(tl=>{
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
  return `Schedulo-${safeFileToken(tag)}-${dateStamp}-${timeStamp}.xls`;
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

  if(currentView==='gantt'){
    const timelines=(board && Array.isArray(board.timelines)) ? board.timelines : [];
    if(!timelines.length){
      alert('No timelines to export yet.');
      return;
    }
    const html=buildGanttExportHtml(timelines);
    triggerExcelDownload(html,excelFilename('gantt-timeline'));
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
  triggerExcelDownload(html,excelFilename(timeline.name));
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

/*  View switching  */
function switchView(v){
  currentView=v;
  document.getElementById('view-kanban').classList.toggle('active',v==='kanban');
  document.getElementById('view-gantt').classList.toggle('active',v==='gantt');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  document.getElementById('add-btn-label').textContent = v==='kanban' ? 'Add list' : 'Add timeline';
  if(v==='gantt') renderGantt();
}

document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
document.getElementById('timeline-select').addEventListener('change',e=>{
  activeTimelineId=e.target.value;
  render();
});
const btnAddTimeline = document.getElementById('btn-add-timeline');
if(btnAddTimeline) btnAddTimeline.addEventListener('click',addTimeline);
document.getElementById('btn-edit-timeline').addEventListener('click',openTimelineSettings);
document.getElementById('btn-export').addEventListener('click',exportBoardToExcel);
document.getElementById('btn-add-col').addEventListener('click',()=>{
  if(currentView==='kanban') addColumn();
  else addTimeline();
});
bindWheelScroll(document.getElementById('board'));
bindWheelScroll(document.getElementById('gantt-wrap'));

/* KANBAN*/
function renderKanban(){
  const boardEl=document.getElementById('board');
  boardEl.innerHTML='';
  const columns=getColumns();
  if(!columns.length) return;

  columns.forEach((col,ci)=>{
    const colEl=document.createElement('div');
    colEl.className='column'; colEl.dataset.colId=col.id;
    colEl.innerHTML=`
      <div class="col-header">
        <div class="col-title-wrap">
          <span class="col-dot" style="background:${col.dotColor||COL_DOTS[ci%COL_DOTS.length]}"></span>
          <span class="col-name" title="Rename">${esc(col.name)}</span>
          <span class="col-count">${col.cards.length}</span>
        </div>
        <button class="col-menu-btn" data-col="${col.id}">
          <svg width="13" height="3" viewBox="0 0 13 3" fill="none">
            <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor"/>
            <circle cx="6.5" cy="1.5" r="1.5" fill="currentColor"/>
            <circle cx="11.5" cy="1.5" r="1.5" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <div class="cards-list" data-col="${col.id}"></div>
      <button class="btn-add-card" data-col="${col.id}">
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M4.5 1v7M1 4.5h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Add card
      </button>`;

    const list=colEl.querySelector('.cards-list');
    if(!col.cards.length){
      list.innerHTML='<div class="empty-col">No cards yet</div>';
    } else {
      col.cards.forEach(card=>list.appendChild(makeCardEl(card)));
    }

    boardEl.appendChild(colEl);

    colEl.querySelector('.col-name').addEventListener('click',()=>openRename(col.id));
    colEl.querySelector('.col-menu-btn').addEventListener('click',e=>{
      e.stopPropagation(); toggleColMenu(col.id,e.currentTarget);
    });
    colEl.querySelector('.btn-add-card').addEventListener('click',()=>openModal(col.id,null));
    list.addEventListener('dragover',onDragOver);
    list.addEventListener('drop',e=>onDrop(e,col.id));
    list.addEventListener('dragleave',onDragLeave);
  });
}

function makeCardEl(card){
  const el=document.createElement('div');
  el.className='card'; el.draggable=true; el.dataset.cardId=card.id;
  const bar=card.label&&card.label!=='none'
    ?`<div class="card-label-bar" style="background:${LABEL_COLORS[card.label]}"></div>`:'';
  const desc=card.desc?`<div class="card-desc">${esc(card.desc)}</div>`:'';
  const cls=dueClass(card.due);
  const dueHtml=card.due?`<span class="card-due ${cls}">${fmtDate(card.due)}</span>`:'<span></span>';
  el.innerHTML=`${bar}
    <div class="card-title">${esc(card.title)}</div>${desc}
    <div class="card-footer">${dueHtml}
      <div class="card-actions">
        <button class="card-btn" data-action="edit" title="Edit">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M6.5 1.5l2 2-5.5 5.5H1.5v-2L7 1.5z"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button class="card-btn del" data-action="delete" title="Delete">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>`;
  el.addEventListener('dragstart',e=>onDragStart(e,card.id));
  el.addEventListener('dragend',onDragEnd);
  el.querySelector('[data-action="edit"]').addEventListener('click',e=>{
    e.stopPropagation();
    openModal(el.closest('.cards-list').dataset.col, card.id);
  });
  el.querySelector('[data-action="delete"]').addEventListener('click',e=>{
    e.stopPropagation(); deleteCard(card.id);
  });
  return el;
}

/* Column menu */
function toggleColMenu(colId,anchor){
  closeMenu();
  const rect=anchor.getBoundingClientRect();
  const menu=document.createElement('div'); menu.className='col-menu';
  menu.style.top=(rect.bottom+3)+'px';
  menu.style.left=Math.max(4,rect.left-80)+'px';
  menu.innerHTML=`
    <button class="col-menu-item" data-a="rename">Rename list</button>
    <button class="col-menu-item" data-a="clear">Clear cards</button>
    <button class="col-menu-item danger" data-a="delete">Delete list</button>`;
  menu.querySelector('[data-a="rename"]').addEventListener('click',()=>{closeMenu();openRename(colId);});
  menu.querySelector('[data-a="clear"]').addEventListener('click',()=>{closeMenu();clearColumn(colId);});
  menu.querySelector('[data-a="delete"]').addEventListener('click',()=>{closeMenu();deleteColumn(colId);});
  document.body.appendChild(menu); activeMenu=menu;
}
function closeMenu(){ if(activeMenu){activeMenu.remove();activeMenu=null;} }

/* CRUD */
function cloneColumnStructure(columns){
  const src=Array.isArray(columns) && columns.length ? columns : makeDefaultColumns();
  return src.map((col,idx)=>({
    id:'col-'+uid(),
    name:col.name||`List ${idx+1}`,
    dotColor:col.dotColor||COL_DOTS[idx%COL_DOTS.length],
    cards:[]
  }));
}

function addTimeline(){
  if(!board) return;
  if(!Array.isArray(board.timelines)) board.timelines=[];
  const active=getActiveTimeline();
  const start=active ? addDays(active.due||active.start,1) : today(-7);
  const timeline={
    id:'tl-'+uid(),
    name:`Timeline ${board.timelines.length+1}`,
    start,
    due:addDays(start,14),
    columns:cloneColumnStructure(active && active.columns)
  };
  board.timelines.push(timeline);
  activeTimelineId=timeline.id;
  saveBoard();
  render();
  openTimelineSettings();
}

function addColumn(){
  const columns=getColumns();
  const col={id:'col-'+uid(),name:'New List',dotColor:COL_DOTS[columns.length%COL_DOTS.length],cards:[]};
  columns.push(col); saveBoard(); renderKanban(); openRename(col.id);
}
function deleteColumn(id){
  const timeline=getActiveTimeline();
  if(!timeline) return;
  timeline.columns=timeline.columns.filter(c=>c.id!==id);
  saveBoard(); render();
}
function clearColumn(id){ const c=findCol(id); if(c){c.cards=[];saveBoard();render();} }
function deleteCard(id){
  getColumns().forEach(c=>{c.cards=c.cards.filter(x=>x.id!==id)});
  saveBoard(); render();
}

/* Drag */
function onDragStart(e,id){
  dragCardId=id;
  const {col}=findCard(id); dragSrcCol=col.id;
  setTimeout(()=>{const el=document.querySelector(`[data-card-id="${id}"]`);if(el)el.classList.add('dragging');},0);
}
function onDragEnd(){
  document.querySelectorAll('.card.dragging').forEach(el=>el.classList.remove('dragging'));
  document.querySelectorAll('.col-drop-active').forEach(el=>el.classList.remove('col-drop-active'));
  removePlaceholder(); dragCardId=null; dragSrcCol=null;
}
function onDragOver(e){
  e.preventDefault();
  const list=e.currentTarget;
  list.closest('.column').classList.add('col-drop-active');
  const after=getDragAfter(list,e.clientY);
  removePlaceholder();
  placeholder=document.createElement('div'); placeholder.className='card-placeholder';
  if(!after) list.appendChild(placeholder); else list.insertBefore(placeholder,after);
}
function onDragLeave(e){
  if(!e.currentTarget.contains(e.relatedTarget)){
    e.currentTarget.closest('.column').classList.remove('col-drop-active');
    removePlaceholder();
  }
}
function onDrop(e,targetColId){
  e.preventDefault(); if(!dragCardId) return;
  const list=e.currentTarget;
  const after=getDragAfter(list,e.clientY);
  const src=findCol(dragSrcCol); const tgt=findCol(targetColId);
  const idx=src.cards.findIndex(c=>c.id===dragCardId);
  if(idx===-1) return;
  const [card]=src.cards.splice(idx,1);
  let ins=tgt.cards.length;
  if(after){const ai=tgt.cards.findIndex(c=>c.id===after.dataset.cardId);if(ai!==-1)ins=ai;}
  tgt.cards.splice(ins,0,card);
  saveBoard(); render();
}
function getDragAfter(container,y){
  const els=[...container.querySelectorAll('.card:not(.dragging):not(.card-placeholder)')];
  return els.reduce((cl,ch)=>{
    const box=ch.getBoundingClientRect(), off=y-box.top-box.height/2;
    return off<0&&off>cl.offset?{offset:off,element:ch}:cl;
  },{offset:Number.NEGATIVE_INFINITY}).element;
}
function removePlaceholder(){ if(placeholder){placeholder.remove();placeholder=null;} }

/* GANTT*/
/*  Collect all cards that have dates, grouped by column  */
function allCardsWithDates(columns){
  const items=[];
  columns.forEach(col=>{
    col.cards.forEach(card=>{
      items.push({...card, colId:col.id, colName:col.name, colDot:col.dotColor});
    });
  });
  return items;
}

/* Build time range based on zoom level */
function buildTimeRange(timelines){
  const zoom=ZOOM_LEVELS[zoomIdx];
  const starts=[];
  const ends=[];

  timelines.forEach(tl=>{
    if(tl.start) starts.push(tl.start);
    if(tl.due) ends.push(tl.due);
  });

  starts.sort();
  ends.sort();

  let start=new Date(starts[0] || today(-7));
  let end=new Date(ends[ends.length-1] || today(21));
  start.setHours(0,0,0,0);
  end.setHours(0,0,0,0);

  if(end<=start){
    end=new Date(start);
    end.setDate(end.getDate()+14);
  }

  if(zoom==='Day'){
    start.setDate(start.getDate()-1);
    end.setDate(end.getDate()+1);
  } else if(zoom==='Week'){
    start.setDate(start.getDate()-7);
    end.setDate(end.getDate()+7);
  } else if(zoom==='Month'){
    start.setDate(1);
    end.setMonth(end.getMonth()+1,0);
  } else { // Quarter
    start.setMonth(Math.floor(start.getMonth()/3)*3,1);
    end.setMonth(Math.floor(end.getMonth()/3)*3+3,0);
  }
  return {start,end,totalDays:Math.max(1,Math.round((end-start)/86400000))};
}

/* Convert date string to % offset within range */
function dateToPercent(dateStr,start,totalDays){
  if(!dateStr) return null;
  const d=new Date(dateStr);
  const offset=(d-start)/86400000;
  return Math.max(0,Math.min(100,(offset/totalDays)*100));
}

function buildHeaders(start,totalDays){
  const zoom=ZOOM_LEVELS[zoomIdx];
  const slots=[];
  const cur=new Date(start);

  if(zoom==='Day'){
    for(let i=0;i<totalDays;i++){
      slots.push(cur.toLocaleDateString('en-GB',{day:'numeric',month:'short'}));
      cur.setDate(cur.getDate()+1);
    }
  } else if(zoom==='Week'){
    let d=new Date(start);
    while(d<=new Date(start.getTime()+totalDays*86400000)){
      slots.push('W'+getISOWeek(d));
      d.setDate(d.getDate()+7);
    }
  } else if(zoom==='Month'){
    let d=new Date(start);
    while(d.getTime()<start.getTime()+totalDays*86400000){
      slots.push(d.toLocaleDateString('en-GB',{month:'short',year:'2-digit'}));
      d.setMonth(d.getMonth()+1);
    }
  } else {
    let d=new Date(start);
    while(d.getTime()<start.getTime()+totalDays*86400000){
      slots.push('Q'+(Math.floor(d.getMonth()/3)+1)+' '+d.getFullYear().toString().slice(2));
      d.setMonth(d.getMonth()+3);
    }
  }
  return slots;
}

function getISOWeek(d){
  const date=new Date(d.getTime());
  date.setHours(0,0,0,0);
  date.setDate(date.getDate()+3-(date.getDay()+6)%7);
  const week1=new Date(date.getFullYear(),0,4);
  return 1+Math.round(((date.getTime()-week1.getTime())/86400000-3+(week1.getDay()+6)%7)/7);
}

function renderGantt(){
  const inner=document.getElementById('gantt-inner');
  const hintEl=document.getElementById('gantt-hint');
  const legendEl=document.getElementById('gantt-legend');
  inner.innerHTML='';

  const timelines=(board && Array.isArray(board.timelines)) ? board.timelines : [];
  if(!timelines.length){
    hintEl.textContent='No timelines yet. Create one to start planning.';
    legendEl.innerHTML='';
    return;
  }

  const active=getActiveTimeline();

  const {start,totalDays}=buildTimeRange(timelines);
  const headers=buildHeaders(start,totalDays);
  const numCols=headers.length;
  const LABEL_W=180; // px

  /* today % */
  const todayPct=dateToPercent(today(),start,totalDays);

  /* grid template: label + time slots */
  const gridTpl=`${LABEL_W}px repeat(${numCols},1fr)`;

  /* header row */
  const hdr=document.createElement('div');
  hdr.className='g-header'; hdr.style.gridTemplateColumns=gridTpl;
  hdr.innerHTML=`<div class="g-label-col">Task</div>`;
  headers.forEach(h=>{
    const d=document.createElement('div'); d.className='g-time-col'; d.textContent=h;
    hdr.appendChild(d);
  });
  inner.appendChild(hdr);

  /* legend */
  legendEl.innerHTML='';
  const totalLegend=document.createElement('div');
  totalLegend.className='legend-item';
  totalLegend.innerHTML=`<span class="legend-dot" style="background:${COL_DOTS[0]}"></span>${timelines.length} timelines`;
  legendEl.appendChild(totalLegend);

  if(active){
    const activeLegend=document.createElement('div');
    activeLegend.className='legend-item';
    activeLegend.innerHTML=`<span class="legend-dot" style="background:${COL_DOTS[2]}"></span>Active: ${esc(active.name)}`;
    legendEl.appendChild(activeLegend);
  }

  hintEl.textContent='Click a timeline bar to open its tasks in Kanban view.';

  const ordered=[...timelines].sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  ordered.forEach((timeline,idx)=>{
    const row=document.createElement('div');
    row.className='g-row';
    row.style.gridTemplateColumns=gridTpl;

    const taskCount=getTimelineTaskCount(timeline);
    const labelText=`${timeline.name} (${taskCount} task${taskCount===1?'':'s'})`;

    const lbl=document.createElement('div');
    lbl.className='g-task-label';
    lbl.textContent=labelText;
    lbl.title=`${timeline.name}: ${fmtDate(timeline.start)} → ${fmtDate(timeline.due)}`;

    const openTimeline=()=>{
      activeTimelineId=timeline.id;
      switchView('kanban');
      render();
    };

    lbl.addEventListener('click',openTimeline);
    row.appendChild(lbl);

    const barsCell=document.createElement('div');
    barsCell.className='g-bars';
    barsCell.style.gridColumn='2 / -1';

    if(todayPct!==null){
      const tl=document.createElement('div');
      tl.className='g-today';
      tl.style.left=todayPct+'%';
      barsCell.appendChild(tl);
    }

    const startPct=dateToPercent(timeline.start,start,totalDays);
    const duePct=dateToPercent(timeline.due,start,totalDays);
    if(startPct!==null && duePct!==null){
      const bar=document.createElement('div');
      bar.className='g-bar';
      const color=COL_DOTS[idx%COL_DOTS.length];
      const left=Math.min(startPct,duePct);
      const width=Math.max(Math.abs(duePct-startPct),1.5);

      bar.style.left=left+'%';
      bar.style.width=width+'%';
      bar.style.background=color+'33';
      bar.style.border=`1px solid ${color}88`;
      bar.style.color=color;
      bar.title=`${timeline.name}: ${fmtDate(timeline.start)} → ${fmtDate(timeline.due)}`;

      if(active && active.id===timeline.id){
        bar.style.boxShadow='0 0 0 1px rgba(247,201,72,.95),0 0 0 2px rgba(247,201,72,.3)';
      }

      const span=document.createElement('span');
      span.textContent=`${timeline.name} • ${fmtDate(timeline.start)} → ${fmtDate(timeline.due)}`;
      span.style.cssText='overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;font-size:9px;';
      bar.appendChild(span);
      bar.addEventListener('click',openTimeline);
      barsCell.appendChild(bar);
    }

    row.appendChild(barsCell);
    inner.appendChild(row);
  });
}

/* Zoom controls */
document.getElementById('zoom-in').addEventListener('click',()=>{
  if(zoomIdx<ZOOM_LEVELS.length-1){ zoomIdx++; updateZoomLabel(); renderGantt(); }
});
document.getElementById('zoom-out').addEventListener('click',()=>{
  if(zoomIdx>0){ zoomIdx--; updateZoomLabel(); renderGantt(); }
});
function updateZoomLabel(){ document.getElementById('zoom-label').textContent=ZOOM_LEVELS[zoomIdx]; }

/* SHARED MODAL — card add/edit */
function openModal(colId,cardId){
  modalColId=colId; modalCardId=cardId;
  const ti=document.getElementById('card-title-input');
  const di=document.getElementById('card-desc-input');
  const si=document.getElementById('card-start-input');
  const ui=document.getElementById('card-due-input');
  document.getElementById('modal-heading').textContent=cardId?'Edit card':'New card';

  if(cardId){
    const {card}=findCard(cardId);
    ti.value=card.title; di.value=card.desc||'';
    si.value=card.start||''; ui.value=card.due||'';
    selectedColor=card.label||'none';
  } else {
    ti.value=''; di.value=''; si.value=''; ui.value='';
    selectedColor='none';
  }
  setCardDateBounds();
  updateSwatches();
  document.getElementById('modal-overlay').classList.remove('hidden');
  ti.focus();
}
function closeModal(){ document.getElementById('modal-overlay').classList.add('hidden'); }

function saveCard(){
  const title=document.getElementById('card-title-input').value.trim();
  if(!title){ document.getElementById('card-title-input').focus(); return; }
  const desc =document.getElementById('card-desc-input').value.trim();
  const start=document.getElementById('card-start-input').value;
  const due  =document.getElementById('card-due-input').value;
  const si=document.getElementById('card-start-input');
  const ui=document.getElementById('card-due-input');
  const label=selectedColor==='none'?'':selectedColor;

  const timeline=getActiveTimeline();
  const taskCheck=validateTaskDatesInTimeline(start,due,timeline);
  if(!taskCheck.ok){
    alert(taskCheck.message);
    if(taskCheck.field==='start') si.focus();
    if(taskCheck.field==='due') ui.focus();
    return;
  }

  if(modalCardId){
    const {card}=findCard(modalCardId);
    Object.assign(card,{title,desc,start,due,label});
  } else {
    const col=findCol(modalColId);
    if(col) col.cards.push({id:'c-'+uid(),title,desc,start,due,label});
  }
  saveBoard(); render(); closeModal();
}

function updateSwatches(){
  document.querySelectorAll('.swatch').forEach(sw=>
    sw.classList.toggle('active',sw.dataset.color===selectedColor)
  );
}

document.getElementById('label-swatches').addEventListener('click',e=>{
  const sw=e.target.closest('.swatch'); if(!sw) return;
  selectedColor=sw.dataset.color; updateSwatches();
});
document.getElementById('modal-close').addEventListener('click',closeModal);
document.getElementById('modal-cancel').addEventListener('click',closeModal);
document.getElementById('modal-save').addEventListener('click',saveCard);
document.getElementById('modal-overlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
document.getElementById('card-title-input').addEventListener('keydown',e=>{
  if(e.key==='Enter') saveCard(); if(e.key==='Escape') closeModal();
});

/* Timeline settings */
const DELETE_MODE_PERMANENT='__delete__';
const CREATE_COLUMN_VALUE='__create__';

function getTimelineTaskCount(timeline){
  let count=0;
  timeline.columns.forEach(col=>{ count+=col.cards.length; });
  return count;
}

function getTimelineTasks(timeline){
  const tasks=[];
  timeline.columns.forEach(col=>{
    col.cards.forEach(card=>tasks.push({col,card}));
  });
  return tasks;
}

function normalizeNameKey(s){
  return String(s||'').trim().toLowerCase();
}

function updateTimelineDeleteHelp(){
  const sel=document.getElementById('timeline-delete-target');
  const help=document.getElementById('timeline-delete-help');
  if(!sel || !help) return;

  const sourceTimeline=getActiveTimeline();

  if(sel.value===DELETE_MODE_PERMANENT || !sel.value){
    help.textContent='Delete tasks permanently.';
    renderTimelineMoveMapping(null,null);
    return;
  }

  const target=findTimeline(sel.value);
  if(!target){
    help.textContent='Move all tasks to selected timeline before deleting.';
    renderTimelineMoveMapping(null,null);
    return;
  }
  help.textContent=`Move all tasks to "${target.name}" before deleting this timeline.`;
  renderTimelineMoveMapping(sourceTimeline,target);
}

function createMappingOption(value,label){
  const opt=document.createElement('option');
  opt.value=value;
  opt.textContent=label;
  return opt;
}

function getDefaultMappedColumnId(sourceCol,targetTimeline){
  const sourceKey=normalizeNameKey(sourceCol.name);
  const matched=targetTimeline.columns.find(
    col=>normalizeNameKey(col.name)===sourceKey
  );
  return matched ? matched.id : CREATE_COLUMN_VALUE;
}

function renderTimelineMoveMapping(sourceTimeline,targetTimeline){
  const mapWrap=document.getElementById('timeline-map-wrap');
  const mapList=document.getElementById('timeline-map-list');
  if(!mapWrap || !mapList) return;

  mapList.innerHTML='';
  if(!sourceTimeline || !targetTimeline){
    mapWrap.classList.remove('active');
    return;
  }

  mapWrap.classList.add('active');

  sourceTimeline.columns.forEach(sourceCol=>{
    const row=document.createElement('div');
    row.className='tl-map-row';

    const sourceLabel=document.createElement('span');
    sourceLabel.className='tl-map-source';
    sourceLabel.textContent=sourceCol.name;

    const select=document.createElement('select');
    select.className='m-input tl-map-select';
    select.dataset.sourceColId=sourceCol.id;

    targetTimeline.columns.forEach(targetCol=>{
      select.appendChild(createMappingOption(targetCol.id,targetCol.name));
    });
    select.appendChild(
      createMappingOption(
        CREATE_COLUMN_VALUE,
        `Create list "${sourceCol.name}"`
      )
    );

    select.value=getDefaultMappedColumnId(sourceCol,targetTimeline);
    row.appendChild(sourceLabel);
    row.appendChild(select);
    mapList.appendChild(row);
  });
}

function syncTimelineDeleteTargetOptions(sourceTimelineId){
  const sel=document.getElementById('timeline-delete-target');
  if(!sel || !board || !Array.isArray(board.timelines)) return;

  sel.innerHTML='';
  const permanent=document.createElement('option');
  permanent.value=DELETE_MODE_PERMANENT;
  permanent.textContent='Delete tasks permanently';
  sel.appendChild(permanent);

  board.timelines
    .filter(tl=>tl.id!==sourceTimelineId)
    .forEach(tl=>{
      const opt=document.createElement('option');
      opt.value=tl.id;
      opt.textContent=`Move tasks to: ${timelineLabel(tl)}`;
      sel.appendChild(opt);
    });

  sel.value=DELETE_MODE_PERMANENT;
  sel.disabled=sel.options.length<=1;
  updateTimelineDeleteHelp();
}

function openTimelineSettings(){
  const timeline=getActiveTimeline();
  if(!timeline){
    alert('No active timeline found.');
    return;
  }
  const nameInput=document.getElementById('timeline-name-input');
  const startInput=document.getElementById('timeline-start-input');
  const dueInput=document.getElementById('timeline-due-input');

  nameInput.value=timeline.name||'';
  startInput.value=timeline.start||'';
  dueInput.value=timeline.due||'';
  startInput.max=timeline.due||'';
  dueInput.min=timeline.start||'';
  updateTimelineDeleteButton();
  syncTimelineDeleteTargetOptions(timeline.id);

  document.getElementById('timeline-overlay').classList.remove('hidden');
  nameInput.focus();
  nameInput.select();
}
function closeTimelineSettings(){
  document.getElementById('timeline-overlay').classList.add('hidden');
}
function findOutOfRangeTasks(timeline,start,due){
  const issues=[];
  timeline.columns.forEach(col=>{
    col.cards.forEach(card=>{
      const badStart=card.start && !isDateWithinRange(card.start,start,due);
      const badDue=card.due && !isDateWithinRange(card.due,start,due);
      if(badStart || badDue) issues.push({col,card,badStart,badDue});
    });
  });
  return issues;
}
function updateTimelineDeleteButton(){
  const deleteBtn=document.getElementById('timeline-delete');
  if(!deleteBtn || !board || !Array.isArray(board.timelines)) return;
  const canDelete=board.timelines.length>1;
  deleteBtn.disabled=!canDelete;
  deleteBtn.title=canDelete
    ? 'Delete active timeline'
    : 'At least one timeline is required';
}

function findMoveValidationIssues(sourceTimeline,targetTimeline){
  const issues=[];
  getTimelineTasks(sourceTimeline).forEach(item=>{
    const check=validateTaskDatesInTimeline(
      item.card.start||'',
      item.card.due||'',
      targetTimeline
    );
    if(!check.ok) issues.push({col:item.col,card:item.card});
  });
  return issues;
}

function collectColumnMoveMap(sourceTimeline,targetTimeline){
  const map={};
  const selects=[...document.querySelectorAll('.tl-map-select')];

  if(selects.length){
    selects.forEach(select=>{
      map[select.dataset.sourceColId]=select.value||CREATE_COLUMN_VALUE;
    });
    return map;
  }

  sourceTimeline.columns.forEach(sourceCol=>{
    map[sourceCol.id]=getDefaultMappedColumnId(sourceCol,targetTimeline);
  });
  return map;
}

function ensureTargetColumnForMove(targetTimeline,sourceCol,mappedTargetId){
  if(mappedTargetId && mappedTargetId!==CREATE_COLUMN_VALUE){
    const existing=targetTimeline.columns.find(col=>col.id===mappedTargetId);
    if(existing) return existing;
  }

  const created={
    id:'col-'+uid(),
    name:sourceCol.name,
    dotColor:sourceCol.dotColor||COL_DOTS[targetTimeline.columns.length%COL_DOTS.length],
    cards:[]
  };
  targetTimeline.columns.push(created);
  return created;
}

function moveTimelineTasks(sourceTimeline,targetTimeline,columnMap){
  sourceTimeline.columns.forEach(sourceCol=>{
    const mappedTargetId=columnMap[sourceCol.id];
    const targetCol=ensureTargetColumnForMove(
      targetTimeline,
      sourceCol,
      mappedTargetId
    );
    sourceCol.cards.forEach(card=>targetCol.cards.push(card));
  });
}

function removeTimelineById(timelineId){
  const idx=board.timelines.findIndex(t=>t.id===timelineId);
  if(idx===-1) return false;

  board.timelines.splice(idx,1);
  const fallback=board.timelines[Math.max(0,idx-1)] || board.timelines[0] || null;
  activeTimelineId=fallback ? fallback.id : null;
  return true;
}

function deleteActiveTimeline(){
  if(!board || !Array.isArray(board.timelines)) return;
  if(board.timelines.length<=1){
    alert('At least one timeline must remain.');
    return;
  }

  const timeline=getActiveTimeline();
  if(!timeline) return;

  const moveSel=document.getElementById('timeline-delete-target');
  const moveTargetId=moveSel ? moveSel.value : DELETE_MODE_PERMANENT;
  const taskCount=getTimelineTaskCount(timeline);

  if(moveTargetId===DELETE_MODE_PERMANENT){
    const message=taskCount
      ? `Delete timeline "${timeline.name}" and permanently delete ${taskCount} task(s)?`
      : `Delete timeline "${timeline.name}"?`;
    if(!confirm(message)) return;
  } else {
    const target=findTimeline(moveTargetId);
    if(!target || target.id===timeline.id){
      alert('Please choose a valid target timeline for moving tasks.');
      return;
    }

    const issues=findMoveValidationIssues(timeline,target);
    if(issues.length){
      const preview=issues
        .slice(0,3)
        .map(x=>`${x.card.title} (${x.col.name})`)
        .join('\n');
      const suffix=issues.length>3 ? `\n+${issues.length-3} more task(s).` : '';
      const issueMsg=`Cannot move tasks to "${target.name}". ${issues.length} task(s) `
        + `are outside target timeline range:\n${preview}${suffix}`;
      alert(
        issueMsg
      );
      return;
    }

    const moveMessage=taskCount
      ? `Move ${taskCount} task(s) from "${timeline.name}" to "${target.name}" and delete this timeline?`
      : `Delete timeline "${timeline.name}"?`;
    if(!confirm(moveMessage)) return;

    if(taskCount){
      const moveMap=collectColumnMoveMap(timeline,target);
      moveTimelineTasks(timeline,target,moveMap);
    }
  }

  if(!removeTimelineById(timeline.id)) return;
  saveBoard();
  closeTimelineSettings();
  render();
}
function saveTimelineSettings(){
  const timeline=getActiveTimeline();
  if(!timeline) return;

  const nameInput=document.getElementById('timeline-name-input');
  const startInput=document.getElementById('timeline-start-input');
  const dueInput=document.getElementById('timeline-due-input');

  const name=nameInput.value.trim();
  const start=startInput.value;
  const due=dueInput.value;

  if(!name){ nameInput.focus(); return; }
  if(!start || !due){
    alert('Timeline start and due date are required.');
    if(!start) startInput.focus(); else dueInput.focus();
    return;
  }
  if(due<start){
    alert('Timeline due date cannot be earlier than start date.');
    dueInput.focus();
    return;
  }

  const issues=findOutOfRangeTasks(timeline,start,due);
  if(issues.length){
    const preview=issues.slice(0,3).map(x=>`${x.card.title} (${x.col.name})`).join('\n');
    const suffix=issues.length>3 ? `\n+${issues.length-3} more task(s).` : '';
    alert(`Cannot save timeline. ${issues.length} task(s) are outside the new range:\n${preview}${suffix}`);
    return;
  }

  timeline.name=name;
  timeline.start=start;
  timeline.due=due;
  saveBoard();
  render();
  closeTimelineSettings();
}

document.getElementById('timeline-close').addEventListener('click',closeTimelineSettings);
document.getElementById('timeline-delete').addEventListener('click',deleteActiveTimeline);
document.getElementById('timeline-delete-target').addEventListener('change',updateTimelineDeleteHelp);
document.getElementById('timeline-cancel').addEventListener('click',closeTimelineSettings);
document.getElementById('timeline-save').addEventListener('click',saveTimelineSettings);
document.getElementById('timeline-overlay').addEventListener('click',e=>{
  if(e.target===e.currentTarget) closeTimelineSettings();
});
document.getElementById('timeline-name-input').addEventListener('keydown',e=>{
  if(e.key==='Enter') saveTimelineSettings();
  if(e.key==='Escape') closeTimelineSettings();
});
document.getElementById('timeline-start-input').addEventListener('change',e=>{
  document.getElementById('timeline-due-input').min=e.target.value||'';
});
document.getElementById('timeline-due-input').addEventListener('change',e=>{
  document.getElementById('timeline-start-input').max=e.target.value||'';
});
document.getElementById('timeline-due-input').addEventListener('keydown',e=>{
  if(e.key==='Enter') saveTimelineSettings();
  if(e.key==='Escape') closeTimelineSettings();
});

/* Rename column */
function openRename(colId){
  renameColId=colId;
  const input=document.getElementById('rename-input');
  input.value=findCol(colId).name;
  document.getElementById('rename-overlay').classList.remove('hidden');
  input.focus(); input.select();
}
function closeRename(){ document.getElementById('rename-overlay').classList.add('hidden'); }
function saveRename(){
  const name=document.getElementById('rename-input').value.trim();
  if(!name) return;
  const col=findCol(renameColId); if(col){col.name=name; saveBoard(); render();}
  closeRename();
}
document.getElementById('rename-close').addEventListener('click',closeRename);
document.getElementById('rename-cancel').addEventListener('click',closeRename);
document.getElementById('rename-save').addEventListener('click',saveRename);
document.getElementById('rename-overlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeRename();});
document.getElementById('rename-input').addEventListener('keydown',e=>{
  if(e.key==='Enter') saveRename(); if(e.key==='Escape') closeRename();
});

document.addEventListener('click',e=>{
  if(activeMenu&&!activeMenu.contains(e.target)) closeMenu();
});

/*  Master render  */
function render(){
  syncTimelineSelect();
  renderKanban();
  if(currentView==='gantt') renderGantt();
}

/*  Boot  */
loadBoard().then(data=>{
  board=normalizeBoardData(data);
  activeTimelineId=getInitialActiveTimelineId(board.timelines)
    || board.timelines[0]?.id
    || null;
  saveBoard();
  render();
  updateZoomLabel();
});