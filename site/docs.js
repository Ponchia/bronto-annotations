const search = document.querySelector('#docs-filter');
const cards = [...document.querySelectorAll('[data-doc-card]')];
const groups = [...document.querySelectorAll('[data-doc-group]')];
const empty = document.querySelector('#docs-filter-empty');

function filterGuides() {
  const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let visible = 0;
  for (const card of cards) {
    const match = words.every((word) => card.dataset.search.includes(word));
    card.hidden = !match;
    if (match) visible++;
  }
  for (const group of groups) {
    group.hidden = ![...group.querySelectorAll('[data-doc-card]')].some((card) => !card.hidden);
  }
  if (empty) empty.classList.toggle('visible', visible === 0);
}

if (search) {
  search.addEventListener('input', filterGuides);
  // Browsers may restore a search field after back navigation.
  window.addEventListener('pageshow', filterGuides);
  filterGuides();
}
