'use strict';

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
