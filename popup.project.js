'use strict';

function projectTimelineCount(project){
  return Array.isArray(project.timelines) ? project.timelines.length : 0;
}

function projectTaskCount(project){
  let count=0;
  const timelines=Array.isArray(project.timelines) ? project.timelines : [];
  timelines.forEach(timeline=>{ count+=getTimelineTaskCount(timeline); });
  return count;
}

function projectStatsText(project){
  const timelineCount=projectTimelineCount(project);
  const taskCount=projectTaskCount(project);
  const timelineLabel=`${timelineCount} timeline${timelineCount===1?'':'s'}`;
  const taskLabel=`${taskCount} task${taskCount===1?'':'s'}`;
  return `${timelineLabel} • ${taskLabel}`;
}

function openProjectById(projectId){
  if(!setActiveProject(projectId)) return;
  saveBoard();
  renderProjectView();
  render();
  switchView('kanban');
}

function createProjectFromInput(){
  const input=document.getElementById('project-name-input');
  if(!input) return;

  const name=input.value.trim();
  if(!name){
    input.focus();
    return;
  }

  if(!board) board=normalizeBoardData(null);
  if(!Array.isArray(board.projects)) board.projects=[];

  const project=makeDefaultProject(name);
  board.projects.push(project);
  setActiveProject(project.id);

  input.value='';
  saveBoard();
  renderProjectView();
  render();
  switchView('kanban');
}

function renameProjectById(projectId){
  openProjectRename(projectId);
}

function deleteProjectById(projectId){
  const projects=getProjects();
  const idx=projects.findIndex(project=>project.id===projectId);
  if(idx===-1) return;

  const removingActive=activeProjectId===projectId;
  projects.splice(idx,1);

  if(!projects.length){
    activeProjectId=null;
    activeTimelineId=null;
    if(board) board.lastProjectId=null;
  } else if(removingActive){
    const fallback=projects[Math.max(0,idx-1)] || projects[0];
    setActiveProject(fallback.id);
  } else if(board && board.lastProjectId===projectId){
    board.lastProjectId=activeProjectId || projects[0].id;
  }

  saveBoard();
  renderProjectView();
  render();

  if(!projects.length){
    switchView('project');
    return;
  }

  if(removingActive && currentView!=='project'){
    switchView('kanban');
  }
}

function renderProjectList(){
  const list=document.getElementById('project-list');
  const count=document.getElementById('project-count');
  const empty=document.getElementById('project-empty');
  if(!list || !count || !empty) return;

  const projects=getProjects();
  list.innerHTML='';
  count.textContent=String(projects.length);
  empty.classList.toggle('active',!projects.length);

  projects.forEach(project=>{
    const row=document.createElement('div');
    row.className='project-row';
    if(activeProjectId===project.id) row.classList.add('active');

    const meta=document.createElement('div');
    meta.className='project-meta';

    const name=document.createElement('div');
    name.className='project-name';
    name.textContent=project.name;

    const stats=document.createElement('div');
    stats.className='project-stats';
    stats.textContent=projectStatsText(project);

    meta.appendChild(name);
    meta.appendChild(stats);

    const actions=document.createElement('div');
    actions.className='project-actions';

    const openBtn=document.createElement('button');
    openBtn.className='project-btn';
    openBtn.textContent='Open';
    openBtn.addEventListener('click',()=>openProjectById(project.id));

    const renameBtn=document.createElement('button');
    renameBtn.className='project-btn';
    renameBtn.textContent='Rename';
    renameBtn.addEventListener('click',()=>renameProjectById(project.id));

    const deleteBtn=document.createElement('button');
    deleteBtn.className='project-btn danger';
    deleteBtn.textContent='Delete';
    deleteBtn.addEventListener('click',()=>deleteProjectById(project.id));

    actions.appendChild(openBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(meta);
    row.appendChild(actions);
    list.appendChild(row);
  });
}

function renderProjectView(){
  renderProjectList();
}

(function wireProjectEvents(){
  const createBtn=document.getElementById('project-create-btn');
  if(createBtn) createBtn.addEventListener('click',createProjectFromInput);

  const nameInput=document.getElementById('project-name-input');
  if(nameInput){
    nameInput.addEventListener('keydown',e=>{
      if(e.key==='Enter') createProjectFromInput();
    });
  }
})();
