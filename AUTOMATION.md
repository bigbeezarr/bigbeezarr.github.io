# Automatic photo updates for bigbeezarr.github.io

A scheduled task runs this runbook once a day. The goal: put the photos Mamadou has
newly edited and exported from Lightroom on his portfolio, curated with the same standard
as the rest of the site, then publish. Write the final report **in French**.

Branches of `bigbeezarr/bigbeezarr.github.io`:
- `main`: the published site (`index.html`, `img/f/NNN.webp`, `og.jpg`, `.nojekyll`). GitHub Pages serves it.
  `main` also holds the client gallery (`galerie/`, `admin/`, `worker/`, `.github/workflows/galerie.yml`). Never delete or overwrite those folders: `gh_build.py` only writes `index.html`, `og.jpg`, `img/` (with the phone and tablet copies `img/m` and `img/s`, made by `variants.py`), `robots.txt`, `sitemap.xml`, `_headers` and `.well-known/security.txt`. `galerie/config.js` is written by the gallery deploy workflow; leave it as is.
- `source` (this branch): the pipeline (`build.py`, `src.html`, `meta.json`, `colors.json`,
  `hashes.json`, `new/ids.json`, `gh_build.py`, `pages.py`, `variants.py`, `tools/`) and the **content**:
  `content/portfolio.json` (chapters, projects, editions, photo ids, alt texts), `content/home.json` (home page),
  `content/site.json` (contact details, settings), `content/legal/*.html`, `content/404.html`.
  Mamadou also edits these JSON files from his admin page (`/admin/` → Portfolio): each save is a commit on `source`.
- Publishing is automatic: every push to `source` that touches the content or the pipeline runs the
  workflow `.github/workflows/publier.yml`, which rebuilds the site and commits the result on `main`.
  You never build-and-push `main` by hand any more; you only add the new full-size photos there (step 4).

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
| CANABASSE (not NGOUNDIEU APPART) | `canabasse` (scene) |
| NGOUNDIEU, APPART | `appart` (scene): the Appart collective; 2025 = Ngoundieu's release party |
| BAL (Basketball Africa League) | `bal` (scene) |
| NOBLESSE | `noblesse` (editorial): 2026 `World Cup Edition` (Dakar), 2025 `Pop-up Store` (Montréal) |
| other brands (BRANDS/…) | `marques` (editorial), one rubric per brand and shoot (`"brand"` key) |
| ASHS | `ashs` (scene) |
| MAD FESTIVAL | `mad` (editorial) |
| Projets d'exposition/as salam… | `salam` (projets) |
| Projets d'exposition/bourrasque… | `bourrasque` (projets) |
| Projets d'exposition/mécanique… | `meca` (projets) |

Never add to `naf` (the Jelani New Africa Fashion lookbook is curated look by look).
Never add Goût d'Afrique or Abyma (removed at Mamadou's request). For Cenabou, only the `Behind The Scenes`
photos are his: never add its DETAILS or REEL photos.
Parties with several volumes get one rubric per volume or night (`"label"`: « Vol. N » as in the folder, or the
night's date), each with at least 10 photos; brand shoots too.

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
Then write where they go in an additions file, for example `/tmp/ajouts.json`:

```json
{
  "editions": [
    {"project": "afroteo", "year": "2026", "imgs": [439, 440]},
    {"project": "afroteo", "year": "2026", "label": "Vol. 2", "sub": {"fr": "Édition du 5 novembre", "en": "November 5th edition"}, "imgs": [441, 442]}
  ],
  "projects": [
    {"chapter": "scene", "project": {"id": "nouveau-projet", "title": "Nouveau projet", "city": "sn", "place": "Dakar", "year": "2025",
      "sub": {"fr": "Concert", "en": "Concert"}, "imgs": [443, 444, 445]}}
  ]
}
```

An edition entry with the same project, year and label as an existing rubric extends it;
otherwise it creates a new year rubric (brand shoots: add `"brand"`). Project ids are lowercase ASCII and unique:
`merge_auto.py` refuses an id that already exists (for example `dlb`) and any photo used twice.

Apply it to the content, check, then publish in this order (photos first, content second):

```bash
git pull --ff-only origin source                   # Mamadou may have saved from the admin page since the clone
python3 tools/merge_auto.py /tmp/ajouts.json       # writes content/portfolio.json (the file the admin page edits)
python3 build.py                                   # fails if an image is unused or duplicated
python3 gh_build.py --site ../site                 # local preview only, to run the smoke test
node tools/smoke.js "$(cd ../site && pwd)"         # must print no errors and no broken images
# 1) the new full-size photos on main (nothing else: the workflow regenerates the pages and the smaller copies)
cd ../site && git restore --staged . && git add img/f && git commit -m "Ajoute les photos : <summary>" -m "<trailers>" && git push origin main
git checkout -- . && git clean -fdq -e img/f        # drop the local preview build
# 2) the content and catalogue on source: this push starts « Publier le portfolio », which updates the site
cd ../src && git add -A && git commit -m "Ajoute les photos : <summary>" -m "<trailers>" && git push origin source
```

If the push to `source` is rejected because Mamadou saved from the admin page in the meantime:
`git pull --rebase origin source`, run `python3 build.py` again, then push. Never force-push.
Check the run (about two minutes): `gh run list --workflow publier.yml --branch source -L 1` must show `completed success`;
if `gh` is not signed in, `git -C ../site fetch -q origin main && git -C ../site log -1 --format=%s origin/main` must print
« Publication automatique du portfolio ». If the run failed, report its error (`gh run view --log-failed`) instead of
building `main` by hand.

Commit trailers (end every commit message with them):

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <this run's session link>
```

## 5. Finish

- Only after both pushes succeeded and the « Publier le portfolio » run succeeded, on the Mac: `python3 scan_new.py --mark-all`
  (records the new and skipped photos as known so the next run does not see them again).
- Do not update the claude.ai preview artifact: it is over its 511-file limit. GitHub Pages is the site.
- Report in French, short: projects and years updated with the number of photos, new projects,
  folders skipped and why, and the link https://bigbeezarr.github.io. The workflow plus GitHub Pages take about three minutes.
