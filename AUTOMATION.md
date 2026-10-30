# Automatic photo updates for bigbeezarr.github.io

A scheduled task runs this runbook once a day. The goal: put the photos Mamadou has
newly edited and exported from Lightroom on his portfolio, curated with the same standard
as the rest of the site, then publish. Write the final report **in French**.

Branches of `bigbeezarr/bigbeezarr.github.io`:
- `main`: the published site (`index.html`, `img/f/NNN.webp`, `og.jpg`, `.nojekyll`). GitHub Pages serves it.
  `main` also holds the client gallery (`galerie/`, `admin/`, `worker/`, `.github/workflows/galerie.yml`). Never delete or overwrite those folders: `gh_build.py` only writes `index.html`, `og.jpg` and `img/`. `galerie/config.js` is written by the gallery deploy workflow; leave it as is.
- `source` (this branch): the pipeline (`build.py`, `src.html`, `meta.json`, `colors.json`,
  `hashes.json`, `auto.json`, `new/ids.json`, `gh_build.py`, `tools/`).

## 0. Preconditions

- The run needs Mamadou's Mac: the `mcp__remote-devices__*` tools (device_bash, device_stage_files).
  If they are missing or the Mac does not answer after one retry, stop and report
  « Mac non joignable, aucune mise à jour » (no commit).
- Connected folders on the Mac: `/Users/mamadou/Pictures/Lightroom Saved Photos` and
  `/Users/mamadou/Pictures/Photos enregistrées dans Lightroom`. In device_bash they are under `~/mnt/`.
- Helper scripts live on the Mac in `~/mnt/Lightroom Saved Photos/.bigbeezarr-site/tools/`
  (`scan_new.py`, `sheet.py`, `prep.py`). If missing, recreate them from `tools/vm/` of this branch.
- Never delete or modify Mamadou's photos. Only write inside `.bigbeezarr-site/`.

## 1. Find new photos (on the Mac)

```bash
cd "$HOME/mnt/Lightroom Saved Photos/.bigbeezarr-site/tools" && python3 scan_new.py
```

It compares every exported photo with `state/known.json` and writes `state/new.json`
(`new`: photos grouped by folder, `skipped`: private folders such as friends and family,
weddings, graduations, birthdays, souvenirs, graphics). If there are 0 new photos, stop:
no commit, report « Rien de nouveau ».

## 2. Decide where each folder goes

Paths look like `Lightroom Saved Photos/2026/MONTREAL/EVENTS/PARTYS/Afroteo April 10th/...`.
Year = the `20xx` segment. City: `DAKAR` → `"city": "sn", "place": "Dakar"`; `MONTREAL` → `"mtl"`, `"Montréal"`.
`FAVS - PERSONNAL - REELS/<year>/<name>` holds his favourites from an event: map it by name like the event
folder and prefer these photos.

Existing projects (match the folder name, case-insensitive):

| Folder contains | Project id (chapter) |
|---|---|
| AFROTEO | `afroteo` (soirees) |
| JELANI (not NAF) | `jelani` (soirees) |
| BASHMENT, BVSHMENT, LA BASE | `bashment` (soirees) |
| TOUT WHIPP | `whippin` (soirees) |
| LITTY, BEATS N BADDIES | `litty` (soirees) |
| GHETTO BASH | `ghetto` (soirees) |
| AFRO B | `afrob` (soirees) |
| MABINA | `mabina` (soirees) |
| LA FORGE, CS BASKETBALL, LF … FAVS | `laforge` (sport); year rubric is the season, e.g. `2025–2026` |
| RISEBALL | `riseball` (sport) |
| OC RUN, RUN NUMBA | `ocruns` (sport) |
| JEUX URBAINS | `jeux` (sport) |
| VJ, MAGGU | `vj` (scene) |
| CANABASSE | `canabasse` (scene) |
| ASHS | `ashs` (scene) |
| MAD FESTIVAL | `mad` (editorial) |
| Projets d'exposition/as salam… | `salam` (projets) |
| Projets d'exposition/bourrasque… | `bourrasque` (projets) |
| Projets d'exposition/mécanique… | `meca` (projets) |

Never add to `naf` (the Jelani New Africa Fashion lookbook is curated look by look).

No match → a new project in the chapter given by the folder category:
PARTYS / EVENTS → `soirees`; CONCERTS → `scene`; SPORT / SPORTS → `sport`;
FASHION / BRANDS / CREATIVE SHOOTS / COVERS / BTS → `editorial`;
`Projets d'exposition/<series>` → `projets` (the whole series, `"order": "fixed"`);
VIEWS → add to `rue` (entre-deux-villes). Title = the folder name cleaned of dates
(« JULY 26TH », « Jan 25 »), « FAVS », years and trailing numbers, keeping proper names as written.
Do not invent descriptions, organisers or credits: leave `sub` empty, or use one plain word
(« Concert ») when the category makes it certain.

When unsure whether a folder belongs on a public portfolio (client work, personal moments,
anything that looks private), skip it and list it in the report so Mamadou can decide.
Also skip screenshots, posters, downloaded images (names like « Épinglé sur … »), graphics and covers.

## 3. Curate (contact sheets)

For each folder kept, write its paths (from `state/new.json`) to a list file in the VM, then:

```bash
cd "$HOME/mnt/Lightroom Saved Photos/.bigbeezarr-site/tools"
python3 sheet.py <name> /path/to/list.txt 150 1600
```

Stage `…/.bigbeezarr-site/sheets/<name>.jpg` and `<name>.json` with device_stage_files and look at the sheet.
Pick by number:
- new edition or new project: 8 to 14 photos (about half for a folder under 16 photos);
- adding to an existing edition: at most 6;
- `projets` series: the whole series, in order.

His taste, stated by him: lots of colour, cinematic black and white, energy (dancing, crowds,
performers on stage, motion). Choose sharp, well exposed, varied frames (wide and close,
portrait and landscape), no near-duplicates, nothing unflattering.

Downscale the picks on the Mac, then stage them (at most 50 files per call):

```bash
python3 prep.py <group> /path/to/picks.txt     # writes .bigbeezarr-site/prep/<group>/<group>-NN.jpg + map.json
```

## 4. Add to the site (in the cloud container)

```bash
# attach the repo with push access first (add_repo bigbeezarr/bigbeezarr.github.io, access "push")
git clone https://github.com/bigbeezarr/bigbeezarr.github.io site
git -C site fetch origin source && git -C site worktree add ../src source
cd src
python3 tools/add_photos.py --img ../site/img/f --group auto-YYYYMMDD-<slug> /mnt/user-data/uploads/…/prep/<group>/*.jpg
```

`add_photos.py` prints the new ids and rejects near-duplicates of photos already on the site.
Then record where they go in `auto.json`:

```json
{
  "editions": [
    {"project": "afroteo", "year": "2026", "imgs": [439, 440]},
    {"project": "afroteo", "year": "2026", "label": "Vol. 2", "sub": {"fr": "Édition du 5 novembre", "en": "November 5th edition"}, "imgs": [441, 442]}
  ],
  "projects": [
    {"chapter": "scene", "project": {"id": "dlb", "title": "DLB", "city": "sn", "place": "Dakar", "year": "2025",
      "sub": {"fr": "Concert", "en": "Concert"}, "imgs": [443, 444, 445]}}
  ]
}
```

An edition entry with the same project, year and label as an existing rubric extends it;
otherwise it creates a new year rubric. Project ids are lowercase ASCII and unique.

Build, test, publish:

```bash
python3 build.py                                   # writes ./index.html; fails if an image is unused or duplicated
python3 gh_build.py --site ../site                 # wraps it into ../site/index.html and refreshes og.jpg
node tools/smoke.js "$(cd ../site && pwd)"   # must print no errors and no broken images
git add -A && git commit -m "Add photos: <summary>" -m "<trailers>" && git push origin source
cd ../site && git add -A && git commit -m "Add photos: <summary>" -m "<trailers>" && git push origin main
```

Commit trailers (end every commit message with them):

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <this run's session link>
```

## 5. Finish

- Only after both pushes succeeded, on the Mac: `python3 scan_new.py --mark-all`
  (records the new and skipped photos as known so the next run does not see them again).
- Do not update the claude.ai preview artifact: it is over its 511-file limit. GitHub Pages is the site.
- Report in French, short: projects and years updated with the number of photos, new projects,
  folders skipped and why, and the link https://bigbeezarr.github.io. GitHub Pages takes about a minute.
