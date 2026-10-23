# Demo Report Generator

A browser app that builds a ready-to-import SAS Viya package (`.json`) for a SAS Visual Analytics report made of
data-driven content (DDC) objects: KPI cards, bar/column/line charts, donuts, heatmaps, tables and filters, all in
one custom theme with your logo.

No server or install: open `index.html` in Chrome or Edge. Your data stays on your computer.

A **Report Assistant** (Claude, by Anthropic) designs the report from a project brief and builds any visual you
describe in the chat. See [Report Assistant](#report-assistant).

## How to use

1. **Report**: name, header line, data-source note, **project brief** (what the report is for; the assistant designs
   from it), logo, colour theme (4 dark, 2 light), accent colour.
2. **SAS environment**: Viya server URL, CAS server / caslib / table, the parent folder and its id, and the names of
   the report folder, assets folder and job. Set your own Viya server URL; the default folder is `/Development`.
3. **Data**: drop a CSV, either
   - a **data sample** (header + rows, e.g. exported from the CAS table), or
   - a **schema** with the columns `name,type` and optionally `label,role,format,values`
     (see `samples/schema_example.csv`; `values` such as `Dubai|Sharjah` make the preview realistic).

   Check each column's use (category / measure / date / ID / ignore), labels, aggregation and number format.
   Add **extra measures**: distinct counts, or conditional counts such as *AST Result = Resistant*. A
   conditional count next to the row count makes % views possible (% resistant = Resistant / AST results).
4. **Pages & charts**: set the number of pages, then add filters and charts per page, or press **Suggest**.
   Anything left empty is filled with suggestions: empty pages get suggested content, and the wand button fills a chart's
   missing settings. **Design with AI** builds every page from the brief; the spark button on a chart, or
   **Custom visual: describe it**, asks the assistant for a change in your own words.
5. **Preview & export**: the preview is the real DDC fed with your rows, aggregated like VA does. Clicking
   bars, pills and slices filters the other objects. Then **Download SAS package** and import it
   (SAS Environment Manager > Content > Import). When asked about existing objects, choose *replace*.

**Save project** downloads a `.report-project.json` you can open later to edit and re-export. Object ids are kept,
so re-importing an edited report replaces the earlier import instead of creating a copy.

## Report Assistant

Open it from **Report Assistant** in the top bar, the **Ask AI** button (bottom right) or the card under the steps.
It works on every step and edits the same report as the forms, so every change shows up at once.

- **Design from the brief**: step 1 or step 4 > *Design with AI*. It picks the pages, filters, KPI cards and visuals
  for the questions in the brief, using your columns.
- **Ask for any visual**: "a heatmap of fraud score by facility and speciality on page 2", "make the top-doctors chart
  show the top 15", "add a % of long leaves KPI". When a visual type does not exist here (scatter, map, gauge...), it
  says so and builds the closest one (e.g. a gauge becomes a KPI card with a %).
- **Undo**: every answer that changed the report has *Undo these changes*.

**Setup**: open the assistant settings (gear icon) and choose how to reach Claude:

- **Anthropic API**: an API key from console.anthropic.com. Sent only to `api.anthropic.com`.
- **Microsoft Foundry**: Claude deployed in your Azure resource. Enter the resource name (e.g. `my-resource-eastus2`,
  or the endpoint URL `https://<resource>.services.ai.azure.com/anthropic/`), Key 1 or Key 2 from *Keys and Endpoint*
  in the Azure portal, and the model deployment name (default `claude-opus-5-5`). Sent only to that resource.

Both can be saved; the selected one is used. Keys are kept in this browser only (local storage, or for the session if
*Remember* is off). Anyone using this computer's browser profile can read them, so use keys you can revoke.

**What is sent**: the brief, the report settings and pages, the column names, labels and types and, when ticked in
the settings, up to 12 sample values per category column. Data rows are never sent.

**Model**: Claude Opus 5.5 (`claude-opus-5-5`) with adaptive thinking, through the official Anthropic SDK
and its Microsoft Foundry client (`js/vendor/anthropic-sdk.js`). On the Anthropic API, a request Opus declines is
retried on Anthropic's recommended fallback model (`fallbacks: "default"`); on Foundry that would need a second Claude
deployment, so a declined request is shown as declined. Each message costs tokens; designing a full report is the
largest request (about 45 seconds).

## What the package contains

| Object | Path |
|---|---|
| Report (BIRD 4.44 XML, compressed) | `<parent>/<report folder>` |
| Job with the DDC page as its form | `<parent>/<report folder>/<assets>/<job>` |
| Folders | parent (existing, by id), report folder, assets folder |

Every object in the report calls `/SASJobExecution/?_program=<job path>&visual=...`; the URL parameters pick the
visual and its options (see the comment at the top of `ddc/ddc_template.html`).

## Requirements on the SAS side

- The CAS table is loaded, with the column names of your CSV.
- Date columns are numeric SAS **date** or **datetime** columns (set the matching type in step 3); VA groups them
  with formats such as `MONYY7.` / `DTMONYY7.`.
- Viewers need read access to the assets folder (the job).

## Files

| Path | What it is |
|---|---|
| `index.html`, `css/`, `js/app.js` | the app |
| `js/data.js` | CSV reading, column detection, preview aggregation |
| `js/suggest.js` | chart types, suggestions, page layout |
| `js/build.js` | report XML and transfer package |
| `js/preview.js` | live preview |
| `js/ai.js` | Report Assistant: chat drawer, agent loop, the tools it uses to edit the report |
| `js/vendor/anthropic-sdk.js` | the Anthropic TypeScript SDK and its Foundry client, bundled for the browser (do not edit) |
| `ddc/ddc_template.html` | the data-driven content page (one file for every visual) |
| `js/ddc_template.js` | generated from the template; do not edit |
| `tools/build_template.py` | rebuilds `js/ddc_template.js` after editing the template |
| `samples/` | example inputs (the AMR sample is synthetic) |

### Editing the DDC template

After changing `ddc/ddc_template.html`, run `python tools/build_template.py`. The build stops if the file contains a dollar
sign (the SAS job server deletes text between two dollar signs) and escapes non-ASCII characters, which the job
server can corrupt.

### Updating the Anthropic SDK bundle

In an empty folder outside the app: `npm install @anthropic-ai/sdk @anthropic-ai/foundry-sdk esbuild`, create `entry.mjs` with
`import Anthropic from '@anthropic-ai/sdk'; import AnthropicFoundry from '@anthropic-ai/foundry-sdk'; window.Anthropic = Anthropic; window.AnthropicFoundry = AnthropicFoundry;`, then
`npx esbuild entry.mjs --bundle --format=iife --platform=browser --target=es2020 --minify --outfile=<app>/js/vendor/anthropic-sdk.js`.
