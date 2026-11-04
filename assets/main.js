const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#main-nav');
function closeMenu() {
  toggle?.setAttribute('aria-expanded', 'false');
  nav?.classList.remove('is-open');
}
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('is-open', open);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    toggle.focus();
  }
});
document.addEventListener('click', e => {
  if (!e.target.closest('.site-header')) closeMenu();
});
nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
const filters = document.querySelectorAll('[data-filter]');
const projects = document.querySelectorAll('[data-project]');
filters.forEach(button => button.addEventListener('click', () => {
  filters.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  let visible = 0;
  projects.forEach(project => {
    project.hidden = button.dataset.filter !== 'all' && !project.dataset.group.split(' ').includes(button.dataset.filter);
    if (!project.hidden) visible++;
  });
  document.querySelectorAll('[data-area-section]').forEach(section => { section.hidden = !Array.from(section.querySelectorAll('[data-project]')).some(item => !item.hidden); });
  const status = document.querySelector('#filter-status');
  if (status) status.textContent = status.dataset.kind === 'publications' ? `${visible} ${visible === 1 ? 'publication' : 'publications'} shown` : `${visible} research ${visible === 1 ? 'area' : 'areas'} shown`;
}));
