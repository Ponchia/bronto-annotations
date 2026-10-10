const search = document.querySelector('#docs-filter');
const cards = [...document.querySelectorAll('[data-doc-card]')];
const empty = document.querySelector('#docs-filter-empty');
if (search)
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    for (const card of cards) {
      const match = !query || card.dataset.search.includes(query);
      card.hidden = !match;
      if (match) visible++;
    }
    if (empty) empty.classList.toggle('visible', visible === 0);
  });
