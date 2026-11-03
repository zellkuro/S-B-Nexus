// Draws the Visual Scripting graphs from docs/unity-first-scene.md as PNG
// pictures styled like Unity's Script Graph window.
//
//   node tools/graph-diagrams/render.cjs            (all graphs)
//   node tools/graph-diagrams/render.cjs 6-4        (only ids starting "6-4")
//
// Graphs are described in graphs.cjs. Pictures go to docs/images/unity-graphs/.
// Needs Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`
// on your own machine).

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { graphs, legend } = require("./graphs.cjs");

const OUT = path.join(__dirname, "../../docs/images/unity-graphs");

// Port colours, roughly as Unity shows them.
const TYPE_COLOURS = {
    flow: "#e6e6e6",
    float: "#6bb4ec",
    int: "#4fd1c5",
    string: "#f0a35e",
    bool: "#ec6b7a",
    vector3: "#f5d65b",
    vector2: "#f5d65b",
    object: "#b392f0",
    any: "#c8c8c8"
};

// Small header icons: [background, symbol]. Approximations of Unity's icons.
const ICONS = {
    event: ["#3d7a2a", "⟳"],
    math: ["#2f6fa3", "±"],
    logic: ["#a3485a", "?"],
    variable: ["#6a4fa3", "x"],
    transform: ["#3a3a3a", "✣"],
    nav: ["#2f8a7a", "➤"],
    animator: ["#3a5fa3", "▶"],
    bs: ["#1f6fd1", "BS"],
    time: ["#2f6fa3", "◷"],
    random: ["#8a6a2f", "⚄"],
    physics: ["#2f8a4f", "◍"],
    object: ["#5a5a5a", "▣"],
    literal: ["#5a5a5a", "“”"],
    flowctl: ["#5a5a5a", "⇢"]
};

function html(graph) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #1b1b1b; font-family: Inter, "DejaVu Sans", sans-serif; }
    #canvas { position: relative; display: inline-block;
        background-color: #202020;
        background-image: linear-gradient(#262626 1px, transparent 1px), linear-gradient(90deg, #262626 1px, transparent 1px);
        background-size: 20px 20px; }
    .group { position: absolute; border: 1px solid #3a3a3a; background: rgba(255,255,255,0.025); border-radius: 4px; }
    .group .gtitle { position: absolute; left: 10px; top: 6px; color: #9a9a9a; font-size: 15px; font-weight: 600; }
    .node { position: absolute; background: #383838; border: 1px solid #141414; border-radius: 4px;
        min-width: 150px; width: max-content; box-shadow: 0 2px 6px rgba(0,0,0,0.5); color: #dcdcdc; }
    .node.event { border-top: 6px solid #82c63a; }
    .node.note { background: #6b5e2e; border-color: #3d3519; }
    .head { display: flex; align-items: center; gap: 8px; padding: 7px 10px 7px 8px; background: #3e3e3e;
        border-bottom: 1px solid #262626; border-radius: 3px 3px 0 0; }
    .icon { width: 26px; height: 26px; border-radius: 5px; display: flex; align-items: center; justify-content: center;
        color: #fff; font-size: 14px; font-weight: 700; flex: none; }
    .titles { display: flex; flex-direction: column; line-height: 1.15; }
    .top { font-size: 10.5px; color: #a8a8a8; }
    .title { font-size: 13.5px; color: #f2f2f2; white-space: nowrap; }
    .sub { font-size: 10.5px; color: #a8a8a8; }
    .body { display: flex; justify-content: space-between; gap: 18px; padding: 6px 0 7px; }
    .col { display: flex; flex-direction: column; gap: 4px; }
    .row { height: 22px; display: flex; align-items: center; gap: 6px; font-size: 12px; color: #cfcfcf; white-space: nowrap; }
    .ins .row { padding-left: 10px; }
    .outs .row { padding-right: 10px; justify-content: flex-end; }
    .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
    .dot.hollow { background: transparent !important; border: 1.5px solid; }
    .arrow { width: 0; height: 0; border-top: 6px solid transparent; border-bottom: 6px solid transparent;
        border-left: 10px solid #84d14a; flex: none; }
    .field { background: #2a2a2a; border: 1px solid #1a1a1a; border-radius: 3px; padding: 1px 6px; min-width: 34px;
        color: #e4e4e4; font-size: 11.5px; height: 18px; display: flex; align-items: center; gap: 6px; }
    .field.drop::after { content: "▾"; color: #aaa; margin-left: 4px; }
    .field.target::after { content: "◎"; color: #aaa; margin-left: auto; padding-left: 8px; }
    .check { width: 14px; height: 14px; background: #2a2a2a; border: 1px solid #1a1a1a; border-radius: 2px;
        color: #ddd; font-size: 11px; display: flex; align-items: center; justify-content: center; }
    .foot { height: 6px; background: #313131; border-top: 1px solid #2a2a2a; border-radius: 0 0 3px 3px; }
    .notebox { display: flex; align-items: center; gap: 4px; padding: 0 8px; }
    .notebox .arrow { border-left-color: #f3d36b; }
    .notetext { padding: 8px 10px; font-size: 12px; color: #f3e9c6; max-width: 260px; white-space: normal; line-height: 1.35; }
    svg { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
    </style></head><body><div id="canvas"><svg id="wires"></svg></div>
    <script>
    {
    const TYPE_COLOURS = ${JSON.stringify(TYPE_COLOURS)};
    const ICONS = ${JSON.stringify(ICONS)};
    const graph = ${JSON.stringify(graph)};
    ${clientScript.toString()}
    clientScript();
    }
    </script></body></html>`;
}

// Runs in the browser: builds nodes, lays out columns, draws wires.
function clientScript() {
    const canvas = document.getElementById("canvas");
    const svg = document.getElementById("wires");
    const connectedIn = new Set();
    for (const e of graph.edges) connectedIn.add(e.split(">")[1]);

    const el = (tag, cls, text) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    };
    const esc = (s) => String(s);

    function portDot(port, side, nodeId) {
        if (port.flow) {
            const a = el("div", "arrow");
            a.dataset.port = nodeId + "." + port.id;
            a.dataset.side = side;
            return a;
        }
        const d = el("div", "dot");
        const colour = TYPE_COLOURS[port.type || "any"];
        d.style.background = colour;
        d.style.borderColor = colour;
        if (side === "in" && !connectedIn.has(nodeId + "." + port.id)) d.classList.add("hollow");
        d.dataset.port = nodeId + "." + port.id;
        d.dataset.side = side;
        return d;
    }

    function inlineValue(port, nodeId, connected) {
        if (connected) return null;
        if (port.check !== undefined) return el("div", "check", port.check ? "✓" : "");
        if (port.target) return el("div", "field target", esc(port.value || "This"));
        if (port.value !== undefined) return el("div", "field", esc(port.value));
        return null;
    }

    const nodes = {};
    for (const spec of graph.nodes) {
        const node = el("div", "node" + (spec.kind === "event" ? " event" : "") + (spec.kind === "note" ? " note" : ""));
        node.id = "n-" + spec.id;
        if (spec.kind === "note") {
            const box = el("div", "notebox");
            if (spec.flowIn) box.appendChild(portDot({ id: "in", flow: true }, "in", spec.id));
            box.appendChild(el("div", "notetext", spec.text));
            if (spec.flowOut) box.appendChild(portDot({ id: "out", flow: true }, "out", spec.id));
            node.appendChild(box);
            canvas.appendChild(node);
            nodes[spec.id] = { spec, node };
            continue;
        }
        const head = el("div", "head");
        const [bg, sym] = ICONS[spec.icon || (spec.kind === "event" ? "event" : "flowctl")];
        const icon = el("div", "icon", sym);
        icon.style.background = bg;
        if (sym.length > 1) icon.style.fontSize = "10px";
        head.appendChild(icon);
        const titles = el("div", "titles");
        if (spec.top) titles.appendChild(el("div", "top", spec.top));
        titles.appendChild(el("div", "title", spec.title));
        if (spec.kind === "event") titles.appendChild(el("div", "sub", "Event"));
        head.appendChild(titles);
        node.appendChild(head);

        const body = el("div", "body");
        const ins = el("div", "col ins");
        const outs = el("div", "col outs");
        for (const p of spec.ins || []) {
            const row = el("div", "row");
            if (p.spacer) {
                // an empty row, to line ports up
            } else if (p.dropdown) {
                row.appendChild(el("div", "field drop", p.dropdown));
            } else {
                const key = spec.id + "." + p.id;
                row.appendChild(portDot(p, "in", spec.id));
                if (p.label) row.appendChild(el("span", "", p.label));
                const v = inlineValue(p, spec.id, connectedIn.has(key));
                if (v) row.appendChild(v);
            }
            ins.appendChild(row);
        }
        for (const p of spec.outs || []) {
            const row = el("div", "row");
            if (p.spacer) { outs.appendChild(row); continue; }
            if (p.value !== undefined) row.appendChild(el("div", "field", esc(p.value)));
            if (p.label) row.appendChild(el("span", "", p.label));
            row.appendChild(portDot(p, "out", spec.id));
            outs.appendChild(row);
        }
        body.appendChild(ins);
        body.appendChild(outs);
        node.appendChild(body);
        node.appendChild(el("div", "foot"));
        canvas.appendChild(node);
        nodes[spec.id] = { spec, node };
    }

    // Layout: columns left to right; nodes stack down each column unless given y.
    const PAD = 40, TOP = graph.title ? 64 : 40, COL_GAP = graph.colGap || 70, ROW_GAP = 26;
    const cols = {};
    for (const { spec, node } of Object.values(nodes)) {
        (cols[spec.col] = cols[spec.col] || []).push({ spec, node });
    }
    for (const list of Object.values(cols)) {
        list.sort((a, b) => (a.spec.isFlow === b.spec.isFlow ? a.spec.order - b.spec.order : a.spec.isFlow ? -1 : 1));
    }
    const colIds = Object.keys(cols).map(Number).sort((a, b) => a - b);
    // Column x positions from the widest node in each column.
    const colX = {};
    let x = PAD;
    for (const c of colIds) {
        colX[c] = x;
        const width = Math.max(...cols[c].map(({ spec, node }) => node.getBoundingClientRect().width + (spec.dx || 0)));
        x += width + COL_GAP;
    }
    let maxX = 0, maxY = 0;
    const place = ({ spec, node }, y) => {
        node.style.left = (colX[spec.col] + (spec.dx || 0)) + "px";
        node.style.top = y + "px";
        const r = node.getBoundingClientRect();
        maxX = Math.max(maxX, colX[spec.col] + (spec.dx || 0) + r.width);
        maxY = Math.max(maxY, y + r.height + ROW_GAP);
        return y + r.height + ROW_GAP;
    };
    // Flow nodes share a band along the top...
    let band = TOP;
    for (const c of colIds) {
        let y = TOP;
        for (const item of cols[c].filter((i) => i.spec.isFlow)) {
            if (item.spec.y !== undefined) y = TOP + item.spec.y;
            y = place(item, y);
        }
        band = Math.max(band, y);
    }
    // ...and value nodes start below it.
    for (const c of colIds) {
        let y = band;
        for (const item of cols[c].filter((i) => !i.spec.isFlow)) {
            if (item.spec.y !== undefined) y = TOP + item.spec.y;
            y = place(item, y);
        }
    }
    canvas.style.width = (maxX + PAD) + "px";
    canvas.style.height = (maxY + PAD - ROW_GAP) + "px";

    if (graph.title) {
        const g = el("div", "group");
        g.style.left = "16px";
        g.style.top = "16px";
        g.style.width = (maxX + PAD - 32) + "px";
        g.style.height = (maxY + PAD - ROW_GAP - 32) + "px";
        g.appendChild(el("div", "gtitle", graph.title));
        canvas.insertBefore(g, canvas.firstChild.nextSibling);
    }

    // Wires.
    svg.setAttribute("width", canvas.style.width);
    svg.setAttribute("height", canvas.style.height);
    const base = canvas.getBoundingClientRect();
    const point = (key, side) => {
        const p = canvas.querySelector('[data-port="' + key + '"][data-side="' + side + '"]');
        if (!p) throw new Error("No port " + key + " (" + side + ") in " + graph.id);
        const r = p.getBoundingClientRect();
        const nodeR = p.closest(".node").getBoundingClientRect();
        return {
            x: side === "out" ? nodeR.right - base.left + 1 : nodeR.left - base.left - 1,
            y: r.top + r.height / 2 - base.top,
            flow: p.classList.contains("arrow"),
            colour: p.style.background
        };
    };
    const NS = "http://www.w3.org/2000/svg";
    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML = '<marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">'
        + '<path d="M0,0 L8,4 L0,8 z" fill="#e6e6e6"/></marker>';
    svg.appendChild(defs);
    for (const e of graph.edges) {
        const [from, to] = e.split(">");
        const a = point(from, "out");
        const b = point(to, "in");
        const gap = b.x - a.x;
        const dx = gap > 0 ? Math.max(15, gap * 0.5) : Math.max(60, -gap * 0.5);
        const path = document.createElementNS(NS, "path");
        path.setAttribute("d", `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", a.flow ? "#e6e6e6" : a.colour);
        path.setAttribute("stroke-width", a.flow ? "2" : "2.2");
        if (a.flow) path.setAttribute("marker-end", "url(#ah)");
        svg.appendChild(path);
    }
    document.body.dataset.done = "1";
}

// Picks a column for every node that doesn't set one:
//  - nodes in the flow (green arrows) go left to right by longest path;
//  - value-only nodes sit one column left of the first node that uses them.
function layout(graph) {
    const byId = Object.fromEntries(graph.nodes.map((n, i) => [n.id, Object.assign(n, { order: i })]));
    const isFlow = (n) => n.kind === "event" || (n.kind === "note" && (n.flowIn || n.flowOut))
        || [...(n.ins || []), ...(n.outs || [])].some((p) => p.flow);
    for (const n of graph.nodes) n.isFlow = isFlow(n);
    const edges = graph.edges.map((e) => {
        const [a, b] = e.split(">");
        const from = byId[a.split(".")[0]], to = byId[b.split(".")[0]];
        if (!from || !to) throw new Error(graph.id + ": edge " + e + " names a missing node");
        return { from, to };
    });
    const col = {};
    const early = {};
    // Earliest column a value-only node can go in: right of everything feeding it.
    const earliest = (n) => {
        if (n.col !== undefined) return n.col;
        if (early[n.id] !== undefined) return early[n.id];
        const providers = edges.filter((e) => e.to === n).map((e) => e.from);
        early[n.id] = providers.length
            ? Math.max(...providers.map((p) => (p.isFlow ? flowCol(p) : earliest(p)) + 1)) : 0;
        return early[n.id];
    };
    const flowCol = (n, seen = new Set()) => {
        if (n.col !== undefined) return n.col;
        if (col[n.id] !== undefined) return col[n.id];
        if (seen.has(n.id)) throw new Error(graph.id + ": loop at " + n.id);
        seen.add(n.id);
        const needs = edges.filter((e) => e.to === n).map((e) =>
            (e.from.isFlow ? flowCol(e.from, seen) : earliest(e.from)) + 1);
        col[n.id] = needs.length ? Math.max(...needs) : 0;
        return col[n.id];
    };
    for (const n of graph.nodes) if (n.isFlow) flowCol(n);
    // Value-only nodes: as late as possible (just left of their first user), but not before they can be.
    const valueCol = (n) => {
        if (n.col !== undefined) return n.col;
        if (n.isFlow) return col[n.id];
        if (col[n.id] !== undefined) return col[n.id];
        const users = edges.filter((e) => e.from === n).map((e) => valueCol(e.to));
        col[n.id] = Math.max(earliest(n), users.length ? Math.min(...users) - 1 : 0);
        return col[n.id];
    };
    for (const n of graph.nodes) valueCol(n);
    const min = Math.min(...graph.nodes.map((n) => (n.col !== undefined ? n.col : col[n.id])));
    for (const n of graph.nodes) n.col = (n.col !== undefined ? n.col : col[n.id]) - min;
    return graph;
}

async function main() {
    const only = process.argv[2] || "";
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch();
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    const list = [legend, ...graphs].filter((g) => g.id.startsWith(only));
    for (const graph of list) {
        const errors = [];
        page.removeAllListeners("pageerror");
        page.on("pageerror", (e) => errors.push(e.message));
        await page.setContent(html(layout(graph)));
        if (errors.length) throw new Error(graph.id + ": " + errors.join("; "));
        await page.waitForSelector("body[data-done='1']", { timeout: 5000 }).catch(async () => {
            throw new Error("Graph " + graph.id + " failed to draw");
        });
        const file = path.join(OUT, graph.id + ".png");
        await page.locator("#canvas").screenshot({ path: file });
        console.log("wrote", path.relative(process.cwd(), file));
    }
    await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
