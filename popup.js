'use strict';

/*  View switching  */
function switchView(v){
  const hasProject=Boolean(getActiveProject());
  const nextView=(v!=='project' && !hasProject) ? 'project' : v;
  currentView=nextView;

  document.getElementById('view-project').classList.toggle('active',nextView==='project');
  document.getElementById('view-kanban').classList.toggle('active',nextView==='kanban');
  document.getElementById('view-gantt').classList.toggle('active',nextView==='gantt');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===nextView));

  document.body.classList.toggle('project-mode',nextView==='project');
  document.getElementById('add-btn-label').textContent = nextView==='kanban' ? 'Add list' : 'Add timeline';

  const controlsDisabled=nextView==='project' || !hasProject;
  const timelineSelect=document.getElementById('timeline-select');
  timelineSelect.disabled=controlsDisabled || !getActiveProjectTimelines().length;
  document.getElementById('btn-edit-timeline').disabled=controlsDisabled;
  document.getElementById('btn-export').disabled=controlsDisabled;
  document.getElementById('btn-add-col').disabled=controlsDisabled;

  if(nextView==='project'){
    renderProjectView();
    return;
  }
  if(nextView==='gantt') renderGantt();
}

document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
document.getElementById('timeline-select').addEventListener('change',e=>{
  if(!e.target.value) return;
  activeTimelineId=e.target.value;
  saveBoard();
  render();
});

const btnAddTimeline = document.getElementById('btn-add-timeline');
if(btnAddTimeline) btnAddTimeline.addEventListener('click',addTimeline);

document.getElementById('btn-edit-timeline').addEventListener('click',()=>{
  if(!getActiveProject()){
    switchView('project');
    return;
  }
  openTimelineSettings();
});

document.getElementById('btn-export').addEventListener('click',()=>{
  if(!getActiveProject()){
    switchView('project');
    return;
  }
  exportBoardToExcel();
});
document.getElementById('btn-add-col').addEventListener('click',()=>{
  if(!getActiveProject()){
    switchView('project');
    return;
  }
  if(currentView==='kanban') addColumn();
  if(currentView==='gantt') addTimeline();
});

bindWheelScroll(document.getElementById('board'));
bindWheelScroll(document.getElementById('gantt-wrap'));

document.addEventListener('click',e=>{
  if(activeMenu&&!activeMenu.contains(e.target)) closeMenu();
});

/*  Master render  */
function render(){
  renderProjectView();
  if(!getActiveProject()){
    syncTimelineSelect();
    document.getElementById('board').innerHTML='';
    document.getElementById('gantt-inner').innerHTML='';
    return;
  }

  syncTimelineSelect();
  renderKanban();
  if(currentView==='gantt') renderGantt();
}

/*  Boot  */
loadBoard().then(data=>{
  board=normalizeBoardData(data);

  const projects=getProjects();
  if(projects.length){
    if(!setActiveProject(board.lastProjectId || projects[0].id)){
      setActiveProject(projects[0].id);
    }
    currentView='kanban';
  } else {
    activeProjectId=null;
    activeTimelineId=null;
    currentView='project';
  }

  saveBoard();
  render();
  switchView(currentView);
  updateZoomLabel();
});
