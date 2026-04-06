'use strict';

/* KANBAN */
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
