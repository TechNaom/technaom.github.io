# 3D views: a guide for page authors

The 3D background scene is loaded once by the site layout, so no page needs a script of its own. A section picks
how the scene looks behind it with one attribute. As the visitor scrolls, the section whose box contains the middle
line of the screen wins; when sections are nested, the innermost (shortest) one wins. Without WebGL, with the data
saver on or with JavaScript off, the page shows its normal dark design and these attributes do nothing.

## Views

| View | What it shows | Used for |
|---|---|---|
| `network` | The whole neural network, shifted right (`offset: 4`) so left-aligned text stays clear. | Page heroes. |
| `dial` | The teams on a 24-hour clock, seen from above (`dial: 1`, `offset: 4.5`). | The home dial stage; the workforce team cards (quiet). |
| `journey` | One post's path as an arc of steps in front of the network (`journey: 1`, `offset: 5.5`). | The home journey stage; the architecture diagrams (quiet). |
| `drift` | The network further back and fainter (`opacity: 0.7`). | Everything else, and any missing or unknown view name. |

On phones (under 900px wide) every view has no side offset, and the camera stands 1.6 times further back and looks
higher, so the network sits below the text (`viewFor` in `views.mjs`).

## Attributes

- `data-scene="<view>"`: the view for this section. Missing or unknown means `drift`.
- `data-scene-labels`: the section is a stage with labels. Put the labels in the section as an
  `<ol class="u3d-labels" data-for="dial|journey">` list, using `StageLabels.astro`: the copy check and screen
  readers read the list, and the scene shows copies of it next to the 3D points. In a `journey` stage this also
  shows the step arc and its pulse.
- `data-scene-quiet`: dense reading. The scene dims to 0.4 of the view's opacity.
- `data-scene-card`: on a stage's text card. Labels sit under the page content, so the scene hides any label that
  would fall behind a card.

## Example

```astro
<section data-scene="drift" data-scene-quiet class="wrap py-16">
  <h2>Lab notes</h2>
  <p>Long reading, with the scene dimmed behind it.</p>
</section>
```

## Adding a view

1. Add an entry to `VIEWS` in `src/lib/scene/views.mjs`: `camera`, `target`, and any of `offset`, `opacity`, `dial`
   and `journey`.
2. Add a row for it to the table above. `tests/unit/guide.test.mjs` fails until the table and the registry match.
3. Use it on a section with `data-scene="<name>"`, and add that section to `tests/screens.json` so the browser tests
   check it.
4. Run `node --test tests/unit/*.test.mjs`, then the browser tests with `npx playwright test`.

## Test hooks

`?u3d=test` keeps the scene still (no idle motion, no easing) so screenshots match on every run; `?u3d=debug` runs it
normally. Both expose a read-only state probe on `window.__u3d` (view, progress, quiet, opacity and more).
