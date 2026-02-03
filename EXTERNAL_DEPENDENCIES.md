# External Dependencies Inventory

Complete inventory of all external dependencies found in `src/public/index.html`

## Summary

**Total External Dependencies:** 4

All dependencies are loaded via CDN script tags in the `<head>` section.

---

## 1. Chart.js

### Library Information
- **Name:** Chart.js
- **Version:** 4.4.1
- **CDN URL:** `https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js`
- **CDN Provider:** jsDelivr
- **License:** MIT (typical for Chart.js)

### Usage in Code

#### Functions/Methods Used:
- `Chart` (constructor)
- `Chart.prototype.destroy()`

#### Usage Locations:

1. **`loadDashboard()` function** (Line ~12258)
   - Checks for Chart.js availability: `typeof Chart === 'undefined'`
   - Waits for Chart.js to load before proceeding

2. **`renderQuestionsChart()` function** (Line ~12370)
   - Creates a doughnut chart instance: `new Chart(ctx, {...})`
   - Destroys existing chart: `questionsChart.destroy()`
   - Chart type: `'doughnut'`
   - Used for displaying questions by priority (Critical, High, Medium, Resolved)

3. **`renderRisksChart()` function** (Line ~12409)
   - Creates a bar chart instance: `new Chart(ctx, {...})`
   - Destroys existing chart: `risksChart.destroy()`
   - Chart type: `'bar'`
   - Used for displaying risks by impact (High, Medium, Low)

#### Chart Instances:
- `questionsChart` - Global variable for questions priority chart
- `risksChart` - Global variable for risks impact chart

---

## 2. html2pdf.js

### Library Information
- **Name:** html2pdf.js
- **Version:** 0.10.1
- **CDN URL:** `https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js`
- **CDN Provider:** cdnjs.cloudflare.com
- **License:** MIT

### Usage in Code

#### Functions/Methods Used:
- `html2pdf()` (main function)
- `html2pdf().set(options)`
- `html2pdf().from(element)`
- `html2pdf().save()`

#### Usage Locations:

1. **`exportToPDF()` function** (Line ~13869)
   - Exports Source of Truth content to PDF
   - Configuration options used:
     - `margin: [10, 10, 10, 10]`
     - `filename: 'Source_of_Truth_' + date + '.pdf'`
     - `image: { type: 'jpeg', quality: 0.98 }`
     - `html2canvas: { scale: 2, useCORS: true }`
     - `jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }`
   - Usage pattern: `html2pdf().set(opt).from(pdfContent).save()`

#### Dependencies:
- Uses html2canvas (bundled with html2pdf.js)
- Uses jsPDF (bundled with html2pdf.js)

---

## 3. vis-network

### Library Information
- **Name:** vis-network
- **Version:** Not specified (latest from unpkg)
- **CDN URL:** `https://unpkg.com/vis-network/standalone/umd/vis-network.min.js`
- **CDN Provider:** unpkg.com
- **License:** Apache-2.0 / MIT (dual license)

### Usage in Code

#### Classes/Constructors Used:
- `vis.Network`
- `vis.DataSet`

#### Methods Used:
- `new vis.Network(container, data, options)` - Creates network visualization
- `new vis.DataSet(array)` - Creates data set for nodes/edges
- `network.destroy()` - Destroys network instance
- `network.on(event, callback)` - Event listener registration
- `network.fit(options)` - Fits network view
- `network.selectNodes(nodeIds, highlight)` - Selects nodes
- `dataset.get(id)` - Gets item from dataset

#### Usage Locations:

1. **`renderGraphVisualization()` function** (Line ~11165)
   - Creates graph database visualization
   - Uses: `new vis.DataSet(visNodes)` for nodes
   - Uses: `new vis.DataSet(visEdges)` for edges
   - Creates: `graphDbNetwork = new vis.Network(container, data, options)`
   - Destroys existing: `graphDbNetwork.destroy()`
   - Network instance stored in: `graphDbNetwork` (global variable)

2. **`loadOrgChart()` function** (Line ~17442)
   - Creates organizational chart visualization
   - Uses: `new vis.DataSet(uniqueNodes.map(...))` for nodes
   - Uses: `new vis.DataSet(uniqueEdges.map(...))` for edges
   - Creates: `orgChartNetwork = new vis.Network(container, { nodes, edges }, options)`
   - Destroys existing: `orgChartNetwork.destroy()`
   - Event handlers:
     - `orgChartNetwork.on('click', ...)` - Handles node clicks
     - `orgChartNetwork.on('doubleClick', ...)` - Handles double-clicks
   - Network instance stored in: `orgChartNetwork` (global variable)

3. **`fitOrgChart()` function** (Line ~17623)
   - Fits org chart view: `orgChartNetwork.fit({ animation: true })`

4. **`filterOrgChartByTeam()` function** (Line ~17760)
   - Selects nodes: `orgChartNetwork.selectNodes(teamNodes, true)`
   - Fits view: `orgChartNetwork.fit({ nodes: teamNodes, animation: true })`

#### Network Instances:
- `graphDbNetwork` - Global variable for graph database visualization
- `orgChartNetwork` - Global variable for organizational chart visualization

#### Network Options Used:
- Node styling (font, border, color, shape)
- Edge styling (font, arrows, width, dashes, color, smooth)
- Physics configuration (forceAtlas2Based, hierarchical layout)
- Interaction settings (hover, tooltipDelay)

---

## 4. marked

### Library Information
- **Name:** marked
- **Version:** Not specified (latest from jsDelivr)
- **CDN URL:** `https://cdn.jsdelivr.net/npm/marked/marked.min.js`
- **CDN Provider:** jsDelivr
- **License:** MIT

### Usage in Code

#### Functions/Methods Used:
- `marked.parse(markdown)` - Parses markdown to HTML
- `marked.setOptions(options)` - Sets parsing options

#### Usage Locations:

1. **`renderSummary()` function** (Line ~12615)
   - Parses summary markdown: `html = marked.parse(html)`
   - Checks for availability: `typeof marked !== 'undefined'`

2. **`renderMarkdownContent()` function** (Line ~12627)
   - Sets markdown options: `marked.setOptions({ gfm: true, breaks: true, tables: true })`
   - Parses markdown: `html = marked.parse(md)`
   - Checks for availability: `typeof marked !== 'undefined'`

3. **`sendSOTMessage()` function** (Line ~12920)
   - Parses AI response markdown: `marked.parse(result.response)`
   - Checks for availability: `typeof marked !== 'undefined'`

4. **`generateWeeklyReport()` function** (Line ~18130)
   - Parses report markdown: `marked.parse(data.report)`
   - Checks for availability: `marked` (truthy check)

5. **`printWeeklyReport()` function** (Line ~18209)
   - Parses report markdown: `marked.parse(window.weeklyReportMarkdown)`
   - Checks for availability: `marked` (truthy check)

#### Markdown Options Configured:
- `gfm: true` - GitHub Flavored Markdown enabled
- `breaks: true` - Line breaks converted to `<br>`
- `tables: true` - Table support enabled

---

## Dependency Loading Order

Scripts are loaded in the following order (as they appear in the HTML):

1. Chart.js (Line 7)
2. html2pdf.js (Line 8)
3. vis-network (Line 9)
4. marked (Line 10)

All scripts are loaded synchronously in the `<head>` section before the page content.

---

## Notes

### Version Pinning
- **Chart.js:** ✅ Pinned to version 4.4.1
- **html2pdf.js:** ✅ Pinned to version 0.10.1
- **vis-network:** ⚠️ Not pinned (uses latest from unpkg)
- **marked:** ⚠️ Not pinned (uses latest from jsDelivr)

### Availability Checks
The code includes defensive checks for library availability:
- Chart.js: `typeof Chart === 'undefined'`
- marked: `typeof marked !== 'undefined'` or `marked` (truthy check)

### Global Variables
The following global variables store library instances:
- `questionsChart` - Chart.js instance
- `risksChart` - Chart.js instance
- `graphDbNetwork` - vis.Network instance
- `orgChartNetwork` - vis.Network instance

---

## Recommendations

1. **Pin Versions:** Consider pinning versions for `vis-network` and `marked` to ensure consistent behavior across deployments.

2. **Error Handling:** The code includes some availability checks, but could benefit from more comprehensive error handling when libraries fail to load.

3. **Bundle Size:** Consider using a bundler (webpack, rollup, etc.) to bundle these dependencies if optimizing for production.

4. **CDN Fallbacks:** Consider adding fallback CDN sources or local copies for critical dependencies.

---

*Generated: 2026-01-31*
*Source File: `src/public/index.html`*
