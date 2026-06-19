# Accessibility Recipes

The package renders accessible labels and can make notes or edit handles
focusable. Host apps still own the surrounding keyboard model and any external
annotation list.

## Static SVG

- Pass a layer `title` to `renderAnnotationsSvg`.
- Give important notes `noteTabIndex: 0` when they should be keyboard
  reachable.
- Use `editHandleTabIndex: 0` only when the host delegates keyboard actions for
  edit handles.
- Provide `note.ariaLabel` when the title/body alone is not enough.

## React

- Use `AnnotationLayer` with `noteTabIndex` for focusable notes.
- Use `editable` and edit callbacks to emit suggested anchor or placement
  patches.
- Keep persisted state in the host app, not the annotation package.
- Use `onQuality` and `onTargetAlignment` to surface generated-report issues in
  tests or authoring tools.

## External Note Lists

For dense reports, consider a host-owned list that mirrors annotation ids:

- list item points to `data-annotation-id`
- list focus moves to the annotation note
- annotation note focus updates the list selection
- screen-reader summary uses validation and layout-quality reports

The clean-consumer dogfood report enforces this pattern in
`npm run test:dogfood`: it renders an `External Note List`, uses roving focus on
host-owned buttons, supports keyboard activation, focuses the matching SVG note
on activation, updates the list selection when a note receives focus, and exposes a live
`screenReaderSummary` with validation, target-alignment, and layout-quality
counts.

```ts
const notes = Array.from(
  document.querySelectorAll<SVGGElement>('.pa-annotation__note[data-annotation-id]')
);
const buttons = notes.map((note, index) => {
  const id = note.dataset.annotationId!;
  const button = document.createElement('button');

  note.id = `annotation-note-${id}`;
  button.type = 'button';
  button.dataset.noteListId = id;
  button.setAttribute('aria-controls', note.id);
  button.setAttribute('aria-current', index === 0 ? 'true' : 'false');
  button.tabIndex = index === 0 ? 0 : -1;
  button.addEventListener('click', () => note.focus({ preventScroll: true }));

  return button;
});
```

Keep the roving focus state in the host list. The annotation package exposes
stable ids and focusable note groups, but it does not own the report's keyboard
model.

## Known Limits

The package does not implement roving focus, command palettes, persistence,
or workflow state. Those remain host-app responsibilities.
