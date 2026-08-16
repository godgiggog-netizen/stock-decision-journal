import React from 'react';
import { createRoot } from 'react-dom/client';
import RadarAlerts from './RadarAlerts';

function mountRadar(){
  const nav=document.querySelector('.nav');
  const main=document.querySelector('.main');
  if(!nav||!main){setTimeout(mountRadar,150);return;}
  if(document.getElementById('radar-nav-button'))return;
  const button=document.createElement('button');
  button.id='radar-nav-button';
  button.textContent='Radar หุ้น';
  const signout=nav.querySelector('.signout');
  if(signout) nav.insertBefore(button,signout); else nav.appendChild(button);
  const host=document.createElement('div');host.id='radar-root';host.style.display='none';main.appendChild(host);createRoot(host).render(<RadarAlerts/>);
  const originalChildren=[...main.children].filter(el=>el!==host);
  const setRadar=active=>{originalChildren.forEach(el=>{el.style.display=active?'none':''});host.style.display=active?'block':'none';button.classList.toggle('active',active);[...nav.querySelectorAll('button')].filter(b=>b!==button).forEach(b=>{if(active)b.classList.remove('active')})};
  button.addEventListener('click',()=>setRadar(true));
  [...nav.querySelectorAll('button')].filter(b=>b!==button).forEach(b=>b.addEventListener('click',()=>setRadar(false)));
}
mountRadar();
