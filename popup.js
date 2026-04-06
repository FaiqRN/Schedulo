'use strict';

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
