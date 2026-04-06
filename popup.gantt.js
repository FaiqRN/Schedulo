'use strict';

/* GANTT */
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
      slots.push('W'+String(getISOWeek(d)).padStart(2,'0'));
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

function getZoomSlotWidth(){
  const zoom=ZOOM_LEVELS[zoomIdx];
  if(zoom==='Day') return 68;
  if(zoom==='Week') return 78;
  if(zoom==='Month') return 92;
  return 106; // Quarter
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

  const timelines=getActiveProjectTimelines();
  if(!timelines.length){
    hintEl.textContent='No timelines yet. Create one to start planning.';
    legendEl.innerHTML='';
    return;
  }

  const active=getActiveTimeline();

  const zoom=ZOOM_LEVELS[zoomIdx];
  const {start,totalDays}=buildTimeRange(timelines);
  const headers=buildHeaders(start,totalDays);
  const numCols=headers.length;
  const LABEL_W=180; // px
  const slotWidth=getZoomSlotWidth();

  /* today % */
  const todayPct=dateToPercent(today(),start,totalDays);

  /* grid template: label + time slots */
  const gridTpl=`${LABEL_W}px repeat(${numCols},${slotWidth}px)`;
  inner.style.minWidth=`${LABEL_W + numCols*slotWidth + 28}px`;
  inner.style.setProperty('--g-slot-width',`${slotWidth}px`);

  /* header row */
  const hdr=document.createElement('div');
  hdr.className='g-header';
  hdr.classList.add(`zoom-${zoom.toLowerCase()}`);
  hdr.style.gridTemplateColumns=gridTpl;
  hdr.innerHTML=`<div class="g-label-col">Task</div>`;
  headers.forEach(h=>{
    const d=document.createElement('div');
    d.className='g-time-col';
    d.textContent=h;
    d.title=h;
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
