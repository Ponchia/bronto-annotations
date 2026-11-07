const search = document.querySelector('#docs-filter');
const cards = [...document.querySelectorAll('[data-doc-card]')];
const groups = [...document.querySelectorAll('[data-doc-group]')];
const status = document.querySelector('#docs-filter-status');

function filterGuides() {
  const query = search.value.trim();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  let visible = 0;
  for (const card of cards) {
    const match = words.every((word) => card.dataset.search.includes(word));
    card.hidden = !match;
    if (match) visible++;
  }
  for (const group of groups) {
    group.hidden = ![...group.querySelectorAll('[data-doc-card]')].some((card) => !card.hidden);
  }
  if (status) {
    const message = !query
      ? `Showing all ${visible} guides.`
      : visible === 0
        ? `No guides match “${query}”. Try another title or topic, or clear the search.`
        : `${visible} ${visible === 1 ? 'guide matches' : 'guides match'} “${query}”.`;
    // Keep the live region mounted and change its text, including when two
    // different queries have the same result count. Never interpret query HTML.
    if (status.textContent !== message) status.textContent = message;
  }
}

if (search) {
  search.addEventListener('input', filterGuides);
  // Browsers may restore a search field after back navigation.
  window.addEventListener('pageshow', filterGuides);
  filterGuides();
}
