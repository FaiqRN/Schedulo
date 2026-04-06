'use strict';

/* Timeline settings */
const DELETE_MODE_PERMANENT='__delete__';
const CREATE_COLUMN_VALUE='__create__';
const MOVE_ALL_CARDS_VALUE='__all_cards__';
const MOVE_NO_CARDS_VALUE='__no_cards__';

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

function cardCountLabel(count){
  return `${count} card${count===1?'':'s'}`;
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
  help.textContent=`Move selected card(s) to "${target.name}" before deleting this timeline.`;
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

function createCardOptionLabel(card){
  const due=card.due ? ` - due ${fmtDate(card.due)}` : '';
  return `${card.title}${due}`;
}

function wireCardPickerBehavior(picker){
  const allInput=picker.querySelector('.tl-opt-all');
  const noneInput=picker.querySelector('.tl-opt-none');
  const cardInputs=[...picker.querySelectorAll('.tl-opt-card')];
  if(!allInput || !noneInput) return;

  const hasCheckedCard=()=>cardInputs.some(input=>input.checked);

  const setMode=mode=>{
    if(mode==='all'){
      allInput.checked=true;
      noneInput.checked=false;
      cardInputs.forEach(input=>{ input.checked=false; });
      return;
    }
    if(mode==='none'){
      allInput.checked=false;
      noneInput.checked=true;
      cardInputs.forEach(input=>{ input.checked=false; });
      return;
    }
    allInput.checked=false;
    noneInput.checked=false;
  };

  allInput.addEventListener('change',()=>{
    if(allInput.checked){
      setMode('all');
      return;
    }
    if(!noneInput.checked && !hasCheckedCard()) setMode('none');
  });

  noneInput.addEventListener('change',()=>{
    if(noneInput.checked){
      setMode('none');
      return;
    }
    if(!allInput.checked && !hasCheckedCard()) setMode('all');
  });

  cardInputs.forEach(input=>input.addEventListener('change',()=>{
    if(hasCheckedCard()){
      setMode('cards');
      return;
    }
    if(allInput.checked){
      setMode('all');
      return;
    }
    if(noneInput.checked){
      setMode('none');
      return;
    }
    setMode('none');
  }));

  if(allInput.checked){
    setMode('all');
    return;
  }
  if(noneInput.checked){
    setMode('none');
    return;
  }
  if(hasCheckedCard()){
    setMode('cards');
    return;
  }
  setMode('all');
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
    sourceLabel.textContent=`${sourceCol.name} (${cardCountLabel(sourceCol.cards.length)})`;

    const picker=document.createElement('div');
    picker.className='tl-card-picker';
    picker.dataset.sourceColId=sourceCol.id;

    const allLabel=document.createElement('label');
    allLabel.className='tl-card-opt is-all';
    const allInput=document.createElement('input');
    allInput.type='checkbox';
    allInput.className='tl-opt-all';
    allInput.value=MOVE_ALL_CARDS_VALUE;
    allInput.checked=true;
    const allText=document.createElement('span');
    allText.textContent=`All cards in list (${cardCountLabel(sourceCol.cards.length)})`;
    allLabel.appendChild(allInput);
    allLabel.appendChild(allText);
    picker.appendChild(allLabel);

    const noneLabel=document.createElement('label');
    noneLabel.className='tl-card-opt is-none';
    const noneInput=document.createElement('input');
    noneInput.type='checkbox';
    noneInput.className='tl-opt-none';
    noneInput.value=MOVE_NO_CARDS_VALUE;
    const noneText=document.createElement('span');
    noneText.textContent='No cards from this list (delete all)';
    noneLabel.appendChild(noneInput);
    noneLabel.appendChild(noneText);
    picker.appendChild(noneLabel);

    sourceCol.cards.forEach(card=>{
      const cardLabel=document.createElement('label');
      cardLabel.className='tl-card-opt';
      const cardInput=document.createElement('input');
      cardInput.type='checkbox';
      cardInput.className='tl-opt-card';
      cardInput.value=card.id;
      const cardText=document.createElement('span');
      cardText.textContent=createCardOptionLabel(card);
      cardLabel.appendChild(cardInput);
      cardLabel.appendChild(cardText);
      picker.appendChild(cardLabel);
    });

    if(!sourceCol.cards.length){
      allInput.disabled=true;
      allInput.checked=false;
      noneInput.checked=true;
      noneInput.disabled=true;
      const empty=document.createElement('div');
      empty.className='tl-card-empty';
      empty.textContent='(No cards in this list)';
      picker.appendChild(empty);
    } else {
      wireCardPickerBehavior(picker);
    }

    row.appendChild(sourceLabel);
    row.appendChild(picker);
    mapList.appendChild(row);
  });
}

function syncTimelineDeleteTargetOptions(sourceTimelineId){
  const sel=document.getElementById('timeline-delete-target');
  if(!sel) return;

  const timelines=getActiveProjectTimelines();
  if(!timelines.length) return;

  sel.innerHTML='';
  const permanent=document.createElement('option');
  permanent.value=DELETE_MODE_PERMANENT;
  permanent.textContent='Delete tasks permanently';
  sel.appendChild(permanent);

  timelines
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
    showAppAlert('No active timeline found.','Timeline Settings');
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
  if(!deleteBtn) return;
  const canDelete=getActiveProjectTimelines().length>1;
  deleteBtn.disabled=!canDelete;
  deleteBtn.title=canDelete
    ? 'Delete active timeline'
    : 'At least one timeline is required';
}

function shouldMoveCardBySelection(sourceColId,cardId,cardSelections){
  if(!cardSelections) return true;
  const selection=cardSelections[sourceColId];
  if(selection && selection.none) return false;
  if(!selection || selection.all) return true;
  return selection.cardIds.has(cardId);
}

function getTimelineTaskDateRange(timeline,cardSelections){
  let minDate='';
  let maxDate='';

  getTimelineTasks(timeline).forEach(item=>{
    if(!shouldMoveCardBySelection(item.col.id,item.card.id,cardSelections)) return;

    const start=item.card.start||'';
    const due=item.card.due||'';

    if(start){
      if(!minDate || start<minDate) minDate=start;
      if(!maxDate || start>maxDate) maxDate=start;
    }
    if(due){
      if(!minDate || due<minDate) minDate=due;
      if(!maxDate || due>maxDate) maxDate=due;
    }
  });

  return {minDate,maxDate};
}

function getTargetRangeAfterMove(sourceTimeline,targetTimeline,cardSelections){
  const incoming=getTimelineTaskDateRange(sourceTimeline,cardSelections);

  if(!incoming.minDate && !incoming.maxDate){
    return {
      start:targetTimeline.start||'',
      due:targetTimeline.due||'',
      changed:false
    };
  }

  const startCandidates=[targetTimeline.start,incoming.minDate]
    .filter(Boolean)
    .sort();
  const dueCandidates=[targetTimeline.due,incoming.maxDate]
    .filter(Boolean)
    .sort();

  const start=startCandidates[0] || targetTimeline.start || incoming.minDate || '';
  const due=dueCandidates[dueCandidates.length-1] || targetTimeline.due || incoming.maxDate || '';

  return {
    start,
    due,
    changed:start!==targetTimeline.start || due!==targetTimeline.due
  };
}

function collectCardMoveSelections(sourceTimeline){
  const selections={};
  const pickers=[...document.querySelectorAll('.tl-card-picker')];

  if(pickers.length){
    pickers.forEach(picker=>{
      const sourceColId=picker.dataset.sourceColId;
      const allInput=picker.querySelector('.tl-opt-all');
      const noneInput=picker.querySelector('.tl-opt-none');
      const checkedCardIds=[
        ...picker.querySelectorAll('.tl-opt-card:checked')
      ].map(input=>input.value);
      const hasCardOptions=picker.querySelector('.tl-opt-card')!==null;
      const noneSelected=Boolean(
        noneInput
        && noneInput.checked
        && (hasCardOptions || noneInput.disabled)
      );
      let allSelected=Boolean(
        !noneSelected
        && allInput
        && allInput.checked
      );

      if(!allSelected && !noneSelected && !checkedCardIds.length){
        allSelected=true;
      }

      selections[sourceColId]={
        all:allSelected,
        none:noneSelected,
        cardIds:new Set((allSelected || noneSelected) ? [] : checkedCardIds)
      };
    });
    return selections;
  }

  sourceTimeline.columns.forEach(sourceCol=>{
    selections[sourceCol.id]={all:true,none:false,cardIds:new Set()};
  });
  return selections;
}

function countSelectedCardsForMove(sourceTimeline,cardSelections){
  let selectedCount=0;
  sourceTimeline.columns.forEach(sourceCol=>{
    sourceCol.cards.forEach(card=>{
      if(shouldMoveCardBySelection(sourceCol.id,card.id,cardSelections)){
        selectedCount+=1;
      }
    });
  });
  return selectedCount;
}

function collectColumnMoveMap(sourceTimeline,targetTimeline){
  const map={};
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

function moveTimelineTasks(sourceTimeline,targetTimeline,columnMap,cardSelections){
  sourceTimeline.columns.forEach(sourceCol=>{
    const cardsToMove=sourceCol.cards.filter(card=>
      shouldMoveCardBySelection(sourceCol.id,card.id,cardSelections)
    );
    if(!cardsToMove.length) return;

    const mappedTargetId=columnMap[sourceCol.id];
    const targetCol=ensureTargetColumnForMove(
      targetTimeline,
      sourceCol,
      mappedTargetId
    );
    cardsToMove.forEach(card=>targetCol.cards.push(card));
  });
}

function removeTimelineById(timelineId){
  const project=getActiveProject();
  if(!project || !Array.isArray(project.timelines)) return false;

  const idx=project.timelines.findIndex(t=>t.id===timelineId);
  if(idx===-1) return false;

  project.timelines.splice(idx,1);
  const fallback=project.timelines[Math.max(0,idx-1)] || project.timelines[0] || null;
  activeTimelineId=fallback ? fallback.id : null;
  return true;
}

async function deleteActiveTimeline(){
  const timelines=getActiveProjectTimelines();
  if(!timelines.length) return;

  if(timelines.length<=1){
    await showAppAlert('At least one timeline must remain.','Delete Timeline');
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
    const confirmed=await showAppConfirm(message,{
      title:'Delete Timeline',
      confirmText:'Delete',
      cancelText:'Cancel',
      danger:true
    });
    if(!confirmed) return;
  } else {
    const target=findTimeline(moveTargetId);
    if(!target || target.id===timeline.id){
      await showAppAlert('Please choose a valid target timeline for moving tasks.','Delete Timeline');
      return;
    }

    const cardSelections=collectCardMoveSelections(timeline);
    const selectedMoveCount=countSelectedCardsForMove(timeline,cardSelections);
    const droppedCount=Math.max(0,taskCount-selectedMoveCount);
    const targetRangeAfterMove=getTargetRangeAfterMove(timeline,target,cardSelections);

    const moveMessage=selectedMoveCount
      ? `Move ${selectedMoveCount} task(s) from "${timeline.name}" to "${target.name}" and delete this timeline?`
      : `Delete timeline "${timeline.name}" without moving any tasks?`;

    const detailLines=[];
    if(selectedMoveCount && targetRangeAfterMove.changed){
      detailLines.push(
        `Target timeline range will be updated to ${fmtDate(targetRangeAfterMove.start)} - ${fmtDate(targetRangeAfterMove.due)} so moved tasks remain valid.`
      );
    }
    if(droppedCount>0){
      detailLines.push(`${droppedCount} unselected task(s) will be deleted permanently.`);
    }

    const detail=detailLines.length ? `\n\n${detailLines.join('\n')}` : '';
    const confirmed=await showAppConfirm(moveMessage+detail,{
      title:'Delete Timeline',
      confirmText:'Move & Delete',
      cancelText:'Cancel',
      danger:true
    });
    if(!confirmed) return;

    if(selectedMoveCount){
      if(targetRangeAfterMove.changed){
        target.start=targetRangeAfterMove.start;
        target.due=targetRangeAfterMove.due;
        if(target.start && target.due && target.due<target.start){
          target.due=target.start;
        }
      }
      const moveMap=collectColumnMoveMap(timeline,target);
      moveTimelineTasks(timeline,target,moveMap,cardSelections);
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
    showAppAlert('Timeline start and due date are required.','Timeline Settings');
    if(!start) startInput.focus(); else dueInput.focus();
    return;
  }
  if(due<start){
    showAppAlert('Timeline due date cannot be earlier than start date.','Timeline Settings');
    dueInput.focus();
    return;
  }

  const issues=findOutOfRangeTasks(timeline,start,due);
  if(issues.length){
    const preview=issues.slice(0,3).map(x=>`${x.card.title} (${x.col.name})`).join('\n');
    const suffix=issues.length>3 ? `\n+${issues.length-3} more task(s).` : '';
    showAppAlert(
      `Cannot save timeline. ${issues.length} task(s) are outside the new range:\n${preview}${suffix}`,
      'Timeline Settings'
    );
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
