let filter = '전체';
const input = document.querySelector('#search');
const container = document.querySelector('#games');
const classSelect = document.querySelector('#class-filter');
const roundSelect = document.querySelector('#round-filter');
const params = new URLSearchParams(location.search);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roundLabel = id => ARCHIVE.rounds.find(r => r.id === Number(id))?.label || '전체 바이브 코딩';
for (const classroom of ARCHIVE.classes) classSelect.add(new Option(`${classroom}반`, classroom));
for (const round of ARCHIVE.rounds) roundSelect.add(new Option(round.label, round.id));
classSelect.value = ARCHIVE.classes.includes(params.get('class')) ? params.get('class') : 'all';
// Preserve links shared before the archive switched from week labels to coding rounds.
const requestedRound = params.get('round') || ({'1':'2','2':'3'}[params.get('week')]);
roundSelect.value = ARCHIVE.rounds.some(r => String(r.id) === requestedRound) ? requestedRound : 'all';
document.querySelector('#total').textContent = GAMES.length;
function renderCard(g) {
  const cohort = `<p class="cohort">${esc(g.classroom)}반 · ${roundLabel(g.round)}</p>`;
  if (g.external) {
    return `<article class="card external-card"><div class="card-body">${cohort}<h3>${esc(g.title)}</h3><p class="by">${esc(g.by)}</p><p class="description">작은 화면을 눌러 p5.js 원본을 새 창에서 열어 보세요.</p><div class="p5-previews">${g.versions.map(v => `<a class="p5-preview" href="${esc(v.path)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(g.title)} ${esc(v.label)} 새 창에서 실행">${v.preview ? `<img src="${esc(v.preview)}" alt="${esc(g.title)} ${esc(v.label)} 실제 실행 화면" loading="lazy" width="140" height="95">` : '<span class="preview-pending">실행 화면 없음</span>'}${esc(v.label)} ↗${v.available === false ? '<br><span class="link-state">실행 화면 로딩 확인 필요</span>' : ''}</a>`).join('')}</div></div></article>`;
  }
  const url = `play.html?game=${encodeURIComponent(g.id)}`;
  return `<article class="card"><a class="cover" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${esc(g.title)} 새 창에서 실행"><img src="${esc(g.art)}" alt="${esc(g.title)} 실제 실행 첫 화면" loading="lazy" width="1280" height="800"><span class="chip">${esc(g.category)}</span></a><div class="card-body">${cohort}<h3><a href="${url}" target="_blank" rel="noopener noreferrer">${esc(g.title)}</a></h3><p class="by">${esc(g.by)}${g.supplemented ? ` · ${esc(g.supplemented)}` : ''}</p><p class="description">${esc(g.description)}</p><p class="controls">${esc(g.controls)}</p><div class="card-bottom"><span class="versions">${g.versions.length > 1 ? g.versions.length + '개 버전' : '수업 활동 작품'}</span><a class="play" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${esc(g.title)} 새 창에서 플레이">플레이 ↗</a></div></div></article>`;
}
function render() {
  const q = input.value.trim().toLocaleLowerCase();
  const cohort = GAMES.filter(g => (classSelect.value === 'all' || g.classroom === classSelect.value) && (roundSelect.value === 'all' || String(g.round) === roundSelect.value));
  const list = cohort.filter(g => (filter === '전체' || g.category === filter) && `${g.title} ${g.by} ${g.description}`.toLocaleLowerCase().includes(q));
  container.innerHTML = list.map(renderCard).join('');
  document.querySelector('#count').textContent = `${list.length}개 작품 묶음`;
  const label = `${classSelect.value === 'all' ? '전체 반' : classSelect.value + '반'} · ${roundLabel(roundSelect.value)}`;
  document.querySelector('#archive-status').textContent = `${label} — ${cohort.length ? cohort.length + '개 작품 묶음 등록' : '결과물 등록 예정'}`;
  const empty = document.querySelector('#empty');
  empty.hidden = list.length !== 0;
  empty.textContent = cohort.length ? '검색 결과가 없습니다. 다른 검색어나 장르를 선택해 보세요.' : '이 반·바이브 코딩의 결과물은 등록 예정입니다. 다른 반이나 차수를 선택해 보세요.';
}
function updateSelection() {
  const url = new URL(location.href);
  url.searchParams.delete('week');
  for (const [key, value] of [['class', classSelect.value], ['round', roundSelect.value]]) {
    if (value === 'all') url.searchParams.delete(key); else url.searchParams.set(key, value);
  }
  history.replaceState(null, '', url);
  render();
}
input.addEventListener('input', render);
classSelect.addEventListener('change', updateSelection);
roundSelect.addEventListener('change', updateSelection);
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
