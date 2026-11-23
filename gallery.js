let filter = '전체';
const input = document.querySelector('#search');
const container = document.querySelector('#games');
const classSelect = document.querySelector('#class-filter');
const weekSelect = document.querySelector('#week-filter');
const params = new URLSearchParams(location.search);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for (const classroom of ARCHIVE.classes) classSelect.add(new Option(`${classroom}반`, classroom));
for (const week of ARCHIVE.weeks) weekSelect.add(new Option(week.label, week.id));
classSelect.value = ARCHIVE.classes.includes(params.get('class')) ? params.get('class') : 'all';
weekSelect.value = ARCHIVE.weeks.some(w => String(w.id) === params.get('week')) ? params.get('week') : 'all';
document.querySelector('#total').textContent = GAMES.length;
function render() {
  const q = input.value.trim().toLocaleLowerCase();
  const cohort = GAMES.filter(g => (classSelect.value === 'all' || g.classroom === classSelect.value) && (weekSelect.value === 'all' || String(g.week) === weekSelect.value));
  const list = cohort.filter(g => (filter === '전체' || g.category === filter) && `${g.title} ${g.by} ${g.description}`.toLocaleLowerCase().includes(q));
  container.innerHTML = list.map(g => `<article class="card"><a class="cover" href="play.html?game=${encodeURIComponent(g.id)}" aria-label="${esc(g.title)} 실행"><img src="${esc(g.art)}" alt="${esc(g.title)} 실제 실행 첫 화면" loading="lazy" width="1280" height="800"><span class="chip">${esc(g.category)}</span></a><div class="card-body"><p class="cohort">${esc(g.classroom)}반 · ${g.week}주차</p><h3><a href="play.html?game=${encodeURIComponent(g.id)}">${esc(g.title)}</a></h3><p class="by">${esc(g.by)}</p><p class="description">${esc(g.description)}</p><p class="controls">${esc(g.controls)}</p><div class="card-bottom"><span class="versions">${g.versions.length > 1 ? g.versions.length + '개 버전' : '수업 활동 작품'}</span><a class="play" href="play.html?game=${encodeURIComponent(g.id)}" aria-label="${esc(g.title)} 플레이">플레이</a></div></div></article>`).join('');
  document.querySelector('#count').textContent = `${list.length}개의 게임`;
  const label = `${classSelect.value === 'all' ? '전체 반' : classSelect.value + '반'} · ${weekSelect.value === 'all' ? '전체 주차' : weekSelect.value + '주차'}`;
  document.querySelector('#archive-status').textContent = `${label} — ${cohort.length ? cohort.length + '개 작품 등록' : '결과물 등록 예정'}`;
  const empty = document.querySelector('#empty');
  empty.hidden = list.length !== 0;
  empty.textContent = cohort.length ? '검색 결과가 없습니다. 다른 검색어나 장르를 선택해 보세요.' : '이 반·주차의 결과물은 등록 예정입니다. 다른 반이나 주차를 선택해 보세요.';
}
function updateSelection() {
  const url = new URL(location.href);
  for (const [key, value] of [['class', classSelect.value], ['week', weekSelect.value]]) {
    if (value === 'all') url.searchParams.delete(key); else url.searchParams.set(key, value);
  }
  history.replaceState(null, '', url);
  render();
}
input.addEventListener('input', render);
classSelect.addEventListener('change', updateSelection);
weekSelect.addEventListener('change', updateSelection);
document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
  filter = b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(x => {
    const active = x === b;
    x.classList.toggle('active', active);
    x.setAttribute('aria-pressed', active);
  });
  render();
}));
render();
