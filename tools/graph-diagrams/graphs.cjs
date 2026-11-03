// The Visual Scripting graphs from docs/unity-first-scene.md, as data.
// render.cjs draws each one as docs/images/unity-graphs/<id>.png.
//
// Keep these in step with the guide's text: node names, port names and
// values must match what the guide tells you to add.

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const flowIn = { id: "in", flow: true };
const flowOut = (id = "out", label) => ({ id, flow: true, label });
const spacer = { spacer: true };
const value = (id, label, type, val) => ({ id, label, type, value: val });
const target = (id = "target") => ({ id, target: true, type: "object" });

const event = (id, title, ins = [], outs = [flowOut()], extra = {}) =>
    ({ id, kind: "event", title, ins, outs, ...extra });

// Object variable nodes: kind dropdown, name, and the GameObject that holds the variable (This).
const getVar = (id, name, type = "float") => ({
    id, title: "Get Variable", icon: "variable",
    ins: [{ dropdown: "Object" }, value("name", "", "string", name), target("obj")],
    outs: [spacer, { id: "out", type }]
});

const setVar = (id, name, type = "float") => ({
    id, title: "Set Variable", icon: "variable",
    ins: [flowIn, { dropdown: "Object" }, value("name", "", "string", name), target("obj"), value("value", "Value", type)],
    outs: [flowOut()]
});

const literal = (id, type, val) => ({
    id, title: { string: "String", float: "Float", bool: "Boolean" }[type], icon: "literal",
    outs: [{ id: "out", type, value: val }]
});

// A node for a Unity member, e.g. member("x", "Transform", "Set Local Scale", ...)
const member = (id, top, title, ins, outs, icon) => ({ id, top, title, ins, outs, icon });

// Flow member: flow in/out plus inputs.
const action = (id, top, title, ins, icon) =>
    member(id, top, title, [flowIn, ...ins], [flowOut()], icon);

const ifNode = (id) => ({
    id, title: "If", icon: "logic",
    ins: [flowIn, value("cond", "Condition", "bool")],
    outs: [flowOut("t", "True"), flowOut("f", "False")]
});

const compare = (id, title, symbol, a, b, type = "float") => ({
    id, title, icon: "logic",
    ins: [value("a", "A", type, a), value("b", "B", type, b)],
    outs: [{ id: "out", label: "A " + symbol + " B", type: "bool" }]
});

const math = (id, title, symbol, a, b, type = "float") => ({
    id, title, icon: "math",
    ins: [value("a", "A", type, a), value("b", "B", type, b)],
    outs: [{ id: "out", label: "A " + symbol + " B", type }]
});

const customEvent = (id, name) =>
    event(id, "Custom Event", [target(), value("name", "", "string", name)], [flowOut()]);

const triggerCustom = (id, name) =>
    action(id, null, "Trigger Custom Event", [target(), value("name", "", "string", name)], "flowctl");

const onGlobal = (id, name, args = 0) => event(id, "On Global Event",
    [value("name", "Name", "string", name)],
    [flowOut(), ...Array.from({ length: args }, (_, i) => ({ id: "arg" + i, label: "argument_" + i, type: "any" }))],
    { icon: "bs" });

const triggerGlobal = (id, name, args = 0) => action(id, null, "Trigger Global Event",
    [value("name", "Name", "string", name), ...Array.from({ length: args }, (_, i) => value("arg" + i, "argument_" + i, "any"))],
    "bs");

const note = (id, text, { flowIn: fi = false, flowOut: fo = false } = {}) =>
    ({ id, kind: "note", text, flowIn: fi, flowOut: fo });

const getTime = (id) => member(id, "Time", "Get Time", [], [{ id: "out", type: "float" }], "time");
const getPosition = (id) => member(id, "Transform", "Get Position", [target()], [{ id: "out", type: "vector3" }], "transform");
const distance = (id) => member(id, "Vector 3", "Distance",
    [value("a", "A", "vector3"), value("b", "B", "vector3")], [{ id: "out", type: "float" }], "math");
const v3create = (id, x, y, z) => member(id, "Vector 3", "Create",
    [value("x", "X", "float", x), value("y", "Y", "float", y), value("z", "Z", "float", z)],
    [{ id: "out", type: "vector3" }], "math");
const setDestination = (id) => action(id, "Nav Mesh Agent", "Set Destination",
    [target(), value("dest", "Target", "vector3")], "nav");
const setSpeed = (id) => action(id, "Nav Mesh Agent", "Set Speed", [target(), value("value", "Speed", "float")], "nav");
const resetPath = (id) => action(id, "Nav Mesh Agent", "Reset Path", [target()], "nav");
const setTrigger = (id, name) => action(id, "Animator", "Set Trigger",
    [target(), value("name", "Name", "string", name)], "animator");
const setActive = (id, on) => action(id, "Game Object", "Set Active",
    [target(), { id: "value", label: "Value", type: "bool", check: on }], "object");
const setColliderEnabled = (id, on) => action(id, "Capsule Collider", "Set Enabled",
    [target(), { id: "value", label: "Enabled", type: "bool", check: on }], "physics");
const wait = (id, seconds) => action(id, null, "Wait For Seconds",
    [value("delay", "Delay", "float", seconds), { id: "unscaled", label: "Unscaled", type: "bool", check: false }], "time");

// "Update the bar" custom event, used for the HUD and the enemy's bar.
function barGraph(id, title, eventName, pivotName) {
    return {
        id, title,
        nodes: [
            customEvent("ev", eventName),
            getVar("hp", "Health"),
            getVar("max", "MaxHealth"),
            math("div", "Divide", "÷"),
            member("clamp", "Mathf", "Clamp 01", [value("value", "Value", "float")], [{ id: "out", type: "float" }], "math"),
            v3create("v3", undefined, 1, 1),
            getVar("pivot", pivotName, "object"),
            action("scale", "Transform", "Set Local Scale", [target(), value("value", "Local Scale", "vector3")], "transform")
        ],
        edges: [
            "ev.out>scale.in",
            "hp.out>div.a", "max.out>div.b", "div.out>clamp.value", "clamp.out>v3.x",
            "pivot.out>scale.target", "v3.out>scale.value"
        ]
    };
}

// ---------------------------------------------------------------------------
// The graphs
// ---------------------------------------------------------------------------

const legend = {
    id: "0-legend",
    title: "How to read these pictures",
    nodes: [
        { ...event("start", "On Start"), col: 0 },
        { ...member("t", "Transform", "Look At", [flowIn, target(), value("pos", "World Position", "vector3")], [flowOut()], "transform"), col: 2 },
        { ...note("n1", "Green arrows and white wires: the order things happen in (flow). Follow them left to right."), col: 3 },
        { ...note("n2", "Coloured wires carry values. Blue: number. Orange: text. Red: true/false. Yellow: position (Vector 3). Purple: an object or component."), col: 3 },
        { ...note("n3", "“This” means the object the graph is on. A grey box is a value you type in; it goes away once a wire is plugged in. A hollow circle is a port with nothing plugged in."), col: 3 },
        { ...v3create("v", 0, 1, 0), col: 1 },
        { ...getVar("o", "Anim", "object"), col: 1 },
        { ...literal("f", "float", "30"), col: 0 },
        { ...literal("s", "string", "Chase"), col: 0 },
        { ...literal("b", "bool", "✓"), col: 0 }
    ],
    edges: ["start.out>t.in", "v.out>t.pos"]
};

const graphs = [
    // ---------------- 5.4 GameManagerGraph ----------------
    barGraph("5-4-a-update-hud", "GameManagerGraph · A. Update the HUD bar", "UpdateHud", "HudPivot"),
    {
        id: "5-4-b-on-start", title: "GameManagerGraph · B. On start: fill up",
        nodes: [
            event("start", "On Start"),
            getVar("max", "MaxHealth"),
            setVar("set", "Health"),
            triggerCustom("upd", "UpdateHud")
        ],
        edges: ["start.out>set.in", "max.out>set.value", "set.out>upd.in"]
    },
    {
        id: "5-4-c1-getting-hit", title: "GameManagerGraph · C. Getting hit (1 of 2)",
        nodes: [
            onGlobal("ev", "PlayerHit", 1),
            getVar("hp", "Health"),
            math("sub", "Subtract", "−"),
            setVar("set", "Health"),
            triggerCustom("upd", "UpdateHud"),
            getVar("hp2", "Health"),
            compare("le", "Less Or Equal", "≤", undefined, 0),
            ifNode("if"),
            note("next", "True: you died. Continues in the next picture.", { flowIn: true })
        ],
        edges: [
            "ev.out>set.in", "hp.out>sub.a", "ev.arg0>sub.b", "sub.out>set.value",
            "set.out>upd.in", "upd.out>if.in", "hp2.out>le.a", "le.out>if.cond", "if.t>next.in"
        ]
    },
    {
        id: "5-4-c2-you-died", title: "GameManagerGraph · C. Getting hit (2 of 2): you died",
        nodes: [
            note("from", "From the If's True output (previous picture)", { flowOut: true }),
            getVar("sp", "SpawnPoint", "object"),
            getPosition("pos"),
            action("tp", null, "Teleport To Location", [
                value("pos", "Position", "vector3"), value("rot", "Rotation", "float", 0),
                value("rotv", "Rotation Vector", "vector3", "0, 0, 0"),
                { id: "stop", label: "Stop Velocity", type: "bool", check: true },
                { id: "spawn", label: "Is Spawn", type: "bool", check: false }
            ], "bs"),
            getVar("max", "MaxHealth"),
            setVar("set", "Health"),
            triggerCustom("upd", "UpdateHud"),
            triggerGlobal("died", "PlayerDied")
        ],
        edges: [
            "from.out>tp.in", "sp.out>pos.target", "pos.out>tp.pos",
            "tp.out>set.in", "max.out>set.value", "set.out>upd.in", "upd.out>died.in"
        ]
    },

    // ---------------- 6.2 Part A ----------------
    barGraph("6-2-a-update-bar", "EnemyGraph · A. Update the health bar", "UpdateBar", "BarPivot"),
    {
        id: "6-2-b-on-start", title: "EnemyGraph · A. On start",
        nodes: [
            event("start", "On Start"),
            getPosition("pos"),
            setVar("home", "Home", "vector3"),
            getVar("max", "MaxHealth"),
            setVar("hp", "Health"),
            triggerCustom("upd", "UpdateBar")
        ],
        edges: ["start.out>home.in", "pos.out>home.value", "home.out>hp.in", "max.out>hp.value", "hp.out>upd.in"]
    },

    // ---------------- 6.3 Part B ----------------
    {
        id: "6-3-a-where-is-the-player", title: "EnemyGraph · B. Every frame: where is the player? (1 of 2)",
        nodes: [
            event("upd", "On Update"),
            member("user", null, "Local User State", [], [{ id: "pos", label: "Position", type: "vector3" }, { id: "rot", label: "Rotation", type: "any" }], "bs"),
            member("exh", "Vector 3", "Expose", [value("v", "", "vector3")],
                [{ id: "x", label: "X", type: "float" }, { id: "y", label: "Y", type: "float" }, { id: "z", label: "Z", type: "float" }], "math"),
            getPosition("me"),
            member("exm", "Vector 3", "Expose", [value("v", "", "vector3")],
                [{ id: "x", label: "X", type: "float" }, { id: "y", label: "Y", type: "float" }, { id: "z", label: "Z", type: "float" }], "math"),
            v3create("flat"),
            setVar("setflat", "PlayerFlat", "vector3"),
            getVar("pf", "PlayerFlat", "vector3"),
            getPosition("me2"),
            distance("dist"),
            setVar("setdist", "PlayerDistance"),
            note("next", "Continues in the next picture.", { flowIn: true })
        ],
        edges: [
            "upd.out>setflat.in", "user.pos>exh.v", "me.out>exm.v",
            "exh.x>flat.x", "exm.y>flat.y", "exh.z>flat.z", "flat.out>setflat.value",
            "setflat.out>setdist.in", "pf.out>dist.a", "me2.out>dist.b", "dist.out>setdist.value",
            "setdist.out>next.in"
        ]
    },
    {
        id: "6-3-b-animate-and-switch", title: "EnemyGraph · B. Every frame: animate, then do what the state says (2 of 2)",
        nodes: [
            note("from", "From Set Variable PlayerDistance (previous picture)", { flowOut: true }),
            member("vel", "Nav Mesh Agent", "Get Velocity", [target()], [{ id: "out", type: "vector3" }], "nav"),
            member("mag", "Vector 3", "Get Magnitude", [value("v", "", "vector3")], [{ id: "out", type: "float" }], "math"),
            getVar("anim", "Anim", "object"),
            action("sf", "Animator", "Set Float", [target(), value("name", "Name", "string", "Speed"), value("value", "Value", "float")], "animator"),
            getVar("state", "State", "string"),
            {
                id: "sw", title: "Switch On String", icon: "logic",
                ins: [flowIn, value("sel", "Selector", "string")],
                outs: ["Wander", "Chase", "Attack", "Return", "Default"].map((o) => flowOut(o.toLowerCase(), o))
            },
            note("w", "Wander (6.4)", { flowIn: true }),
            note("c", "Chase (6.4)", { flowIn: true }),
            note("a", "Attack (6.4)", { flowIn: true }),
            note("r", "Return (6.4)", { flowIn: true }),
            note("d", "Default: nothing (Dead)", { flowIn: true })
        ],
        edges: [
            "from.out>sf.in", "anim.out>sf.target", "vel.out>mag.v", "mag.out>sf.value",
            "sf.out>sw.in", "state.out>sw.sel",
            "sw.wander>w.in", "sw.chase>c.in", "sw.attack>a.in", "sw.return>r.in", "sw.default>d.in"
        ]
    },

    // ---------------- 6.4 Wander ----------------
    {
        id: "6-4-wander-a", title: "EnemyGraph · C. Wander (1 of 3): chase if you're close, or wait",
        nodes: [
            note("from", "From Switch On String: Wander", { flowOut: true }),
            getVar("pd", "PlayerDistance"),
            getVar("aggro", "AggroRange"),
            compare("lt", "Less", "<"),
            ifNode("if"),
            literal("chase", "string", "Chase"),
            setVar("st", "State", "string"),
            getVar("run", "RunSpeed"),
            setSpeed("spd"),
            getTime("time"),
            getVar("next", "NextWanderTime"),
            compare("gt", "Greater", ">"),
            ifNode("if2"),
            note("go", "True: time to stroll somewhere new. Continues in the next picture.", { flowIn: true })
        ],
        edges: [
            "from.out>if.in", "pd.out>lt.a", "aggro.out>lt.b", "lt.out>if.cond",
            "if.t>st.in", "chase.out>st.value", "st.out>spd.in", "run.out>spd.value",
            "if.f>if2.in", "time.out>gt.a", "next.out>gt.b", "gt.out>if2.cond", "if2.t>go.in"
        ]
    },
    {
        id: "6-4-wander-b", title: "EnemyGraph · C. Wander (2 of 3): pick a spot near home",
        nodes: [
            note("from", "From the second If's True output (previous picture)", { flowOut: true }),
            member("rnd", "Random", "Get Inside Unit Circle", [], [{ id: "out", type: "vector2" }], "random"),
            member("ex", "Vector 2", "Expose", [value("v", "", "vector2")],
                [{ id: "x", label: "X", type: "float" }, { id: "y", label: "Y", type: "float" }], "math"),
            getVar("rad", "WanderRadius"),
            math("mx", "Multiply", "×"),
            math("mz", "Multiply", "×"),
            v3create("v3", undefined, 0, undefined),
            getVar("home", "Home", "vector3"),
            math("add", "Add", "+", undefined, undefined, "vector3"),
            setDestination("dest"),
            note("next", "Continues in the next picture.", { flowIn: true })
        ],
        edges: [
            "from.out>dest.in", "rnd.out>ex.v", "ex.x>mx.a", "rad.out>mx.b", "ex.y>mz.a", "rad.out>mz.b",
            "mx.out>v3.x", "mz.out>v3.z", "home.out>add.a", "v3.out>add.b", "add.out>dest.dest",
            "dest.out>next.in"
        ]
    },
    {
        id: "6-4-wander-c", title: "EnemyGraph · C. Wander (3 of 3): walk there, and wait 3–6 s before the next spot",
        nodes: [
            note("from", "From Set Destination (previous picture)", { flowOut: true }),
            getVar("walk", "WalkSpeed"),
            setSpeed("spd"),
            getTime("time"),
            member("rr", "Random", "Range", [value("min", "Min", "float", 3), value("max", "Max", "float", 6)], [{ id: "out", type: "float" }], "random"),
            math("add", "Add", "+"),
            setVar("set", "NextWanderTime")
        ],
        edges: ["from.out>spd.in", "walk.out>spd.value", "spd.out>set.in", "time.out>add.a", "rr.out>add.b", "add.out>set.value"]
    },

    // ---------------- 6.4 Chase ----------------
    {
        id: "6-4-chase-a", title: "EnemyGraph · C. Chase (1 of 2): run after you, but not too far from home",
        nodes: [
            note("from", "From Switch On String: Chase", { flowOut: true }),
            getVar("pf", "PlayerFlat", "vector3"),
            setDestination("dest"),
            getVar("run", "RunSpeed"),
            setSpeed("spd"),
            getPosition("me"),
            getVar("home", "Home", "vector3"),
            distance("dist"),
            getVar("leash", "LeashRange"),
            compare("gt", "Greater", ">"),
            ifNode("if"),
            literal("ret", "string", "Return"),
            setVar("st", "State", "string"),
            getVar("home2", "Home", "vector3"),
            setDestination("dest2"),
            note("f", "False: still close enough to home. Continues in the next picture.", { flowIn: true })
        ],
        edges: [
            "from.out>dest.in", "pf.out>dest.dest", "dest.out>spd.in", "run.out>spd.value", "spd.out>if.in",
            "me.out>dist.a", "home.out>dist.b", "dist.out>gt.a", "leash.out>gt.b", "gt.out>if.cond",
            "if.t>st.in", "ret.out>st.value", "st.out>dest2.in", "home2.out>dest2.dest", "if.f>f.in"
        ]
    },
    {
        id: "6-4-chase-b", title: "EnemyGraph · C. Chase (2 of 2): close enough? Attack",
        nodes: [
            note("from", "From the If's False output (previous picture)", { flowOut: true }),
            getVar("pd", "PlayerDistance"),
            getVar("ar", "AttackRange"),
            compare("lt", "Less", "<"),
            ifNode("if"),
            literal("atk", "string", "Attack"),
            setVar("st", "State", "string"),
            resetPath("stop")
        ],
        edges: ["from.out>if.in", "pd.out>lt.a", "ar.out>lt.b", "lt.out>if.cond", "if.t>st.in", "atk.out>st.value", "st.out>stop.in"]
    },

    // ---------------- 6.4 Attack ----------------
    {
        id: "6-4-attack-a", title: "EnemyGraph · C. Attack (1 of 2): face you; chase again if you step back",
        nodes: [
            note("from", "From Switch On String: Attack", { flowOut: true }),
            getVar("pf", "PlayerFlat", "vector3"),
            member("look", "Transform", "Look At", [flowIn, target(), value("pos", "World Position", "vector3")], [flowOut()], "transform"),
            getVar("pd", "PlayerDistance"),
            getVar("ar", "AttackRange"),
            math("add", "Add", "+", undefined, 0.5),
            compare("gt", "Greater", ">"),
            ifNode("if"),
            literal("chase", "string", "Chase"),
            setVar("st", "State", "string"),
            note("f", "False: still in reach. Continues in the next picture.", { flowIn: true })
        ],
        edges: [
            "from.out>look.in", "pf.out>look.pos", "look.out>if.in",
            "pd.out>gt.a", "ar.out>add.a", "add.out>gt.b", "gt.out>if.cond",
            "if.t>st.in", "chase.out>st.value", "if.f>f.in"
        ]
    },
    {
        id: "6-4-attack-b", title: "EnemyGraph · C. Attack (2 of 2): hit you every 1.6 s",
        nodes: [
            note("from", "From the If's False output (previous picture)", { flowOut: true }),
            getTime("time"),
            getVar("last", "LastAttackTime"),
            getVar("every", "AttackEvery"),
            math("add", "Add", "+"),
            compare("gt", "Greater", ">"),
            ifNode("if"),
            getTime("time2"),
            setVar("set", "LastAttackTime"),
            getVar("anim", "Anim", "object"),
            setTrigger("trig", "Attack"),
            getVar("dmg", "Damage"),
            triggerGlobal("hit", "PlayerHit", 1)
        ],
        edges: [
            "from.out>if.in", "time.out>gt.a", "last.out>add.a", "every.out>add.b", "add.out>gt.b", "gt.out>if.cond",
            "if.t>set.in", "time2.out>set.value", "set.out>trig.in", "anim.out>trig.target",
            "trig.out>hit.in", "dmg.out>hit.arg0"
        ]
    },

    // ---------------- 6.4 Return ----------------
    {
        id: "6-4-return", title: "EnemyGraph · C. Return: once home, heal and wander again",
        nodes: [
            note("from", "From Switch On String: Return", { flowOut: true }),
            getPosition("me"),
            getVar("home", "Home", "vector3"),
            distance("dist"),
            compare("lt", "Less", "<", undefined, 1),
            ifNode("if"),
            getVar("max", "MaxHealth"),
            setVar("hp", "Health"),
            triggerCustom("upd", "UpdateBar"),
            literal("wander", "string", "Wander"),
            setVar("st", "State", "string")
        ],
        edges: [
            "from.out>if.in", "me.out>dist.a", "home.out>dist.b", "dist.out>lt.a", "lt.out>if.cond",
            "if.t>hp.in", "max.out>hp.value", "hp.out>upd.in", "upd.out>st.in", "wander.out>st.value"
        ]
    },

    // ---------------- 6.5 Part D ----------------
    {
        id: "6-5-a-sword-and-speed", title: "EnemyGraph · D. Getting hit (1 of 4): was it the sword, swung hard enough?",
        nodes: [
            event("ev", "On BS Trigger Enter", [target()],
                [flowOut(), { id: "col", label: "Collider", type: "object" }, { id: "user", label: "user", type: "object" }], { icon: "bs" }),
            member("tag", "Collider", "Compare Tag", [target(), value("tag", "Tag", "string", "UserTag1")], [{ id: "out", type: "bool" }], "physics"),
            ifNode("if"),
            member("rb", "Collider", "Get Attached Rigidbody", [target()], [{ id: "out", type: "object" }], "physics"),
            member("vel", "Rigidbody", "Get Linear Velocity", [target()], [{ id: "out", type: "vector3" }], "physics"),
            member("mag", "Vector 3", "Get Magnitude", [value("v", "", "vector3")], [{ id: "out", type: "float" }], "math"),
            getVar("min", "MinSwingSpeed"),
            compare("ge", "Greater Or Equal", "≥"),
            ifNode("if2"),
            note("next", "True: a real sword swing. Continues in the next picture.", { flowIn: true })
        ],
        edges: [
            "ev.out>if.in", "ev.col>tag.target", "tag.out>if.cond",
            "if.t>if2.in", "ev.col>rb.target", "rb.out>vel.target", "vel.out>mag.v",
            "mag.out>ge.a", "min.out>ge.b", "ge.out>if2.cond", "if2.t>next.in"
        ]
    },
    {
        id: "6-5-b-alive-and-cooldown", title: "EnemyGraph · D. Getting hit (2 of 4): alive, and 2 s since the last hit?",
        nodes: [
            note("from", "From the second If's True output (previous picture)", { flowOut: true }),
            getVar("state", "State", "string"),
            literal("dead", "string", "Dead"),
            compare("ne", "Not Equal", "≠", undefined, undefined, "any"),
            ifNode("if"),
            getTime("time"),
            getVar("last", "LastHitTime"),
            getVar("cd", "SwingCooldown"),
            math("add", "Add", "+"),
            compare("gt", "Greater", ">"),
            ifNode("if2"),
            note("next", "True: the hit counts. Continues in the next picture.", { flowIn: true })
        ],
        edges: [
            "from.out>if.in", "state.out>ne.a", "dead.out>ne.b", "ne.out>if.cond",
            "if.t>if2.in", "time.out>gt.a", "last.out>add.a", "cd.out>add.b", "add.out>gt.b", "gt.out>if2.cond",
            "if2.t>next.in"
        ]
    },
    {
        id: "6-5-c-take-damage", title: "EnemyGraph · D. Getting hit (3 of 4): take the damage",
        nodes: [
            note("from", "From the second If's True output (previous picture)", { flowOut: true }),
            getTime("time"),
            setVar("last", "LastHitTime"),
            getVar("hp", "Health"),
            getVar("dmg", "SwordDamage"),
            math("sub", "Subtract", "−"),
            setVar("set", "Health"),
            triggerCustom("upd", "UpdateBar"),
            getVar("anim", "Anim", "object"),
            setTrigger("trig", "Hit"),
            note("next", "Continues in the next picture.", { flowIn: true })
        ],
        edges: [
            "from.out>last.in", "time.out>last.value", "last.out>set.in", "hp.out>sub.a", "dmg.out>sub.b",
            "sub.out>set.value", "set.out>upd.in", "upd.out>trig.in", "anim.out>trig.target", "trig.out>next.in"
        ]
    },
    {
        id: "6-5-d-fight-back-or-die", title: "EnemyGraph · D. Getting hit (4 of 4): fight back, or die",
        nodes: [
            note("from", "From Animator: Set Trigger (previous picture)", { flowOut: true }),
            getVar("state", "State", "string"),
            literal("wander", "string", "Wander"),
            compare("eq", "Equal", "=", undefined, undefined, "any"),
            ifNode("if"),
            literal("chase", "string", "Chase"),
            // Lower than the If, so the If's False wire visibly passes above it.
            { ...setVar("st", "State", "string"), y: 150 },
            getVar("hp", "Health"),
            compare("le", "Less Or Equal", "≤", undefined, 0),
            ifNode("if2"),
            triggerCustom("die", "Die")
        ],
        edges: [
            "from.out>if.in", "state.out>eq.a", "wander.out>eq.b", "eq.out>if.cond",
            "if.t>st.in", "chase.out>st.value", "st.out>if2.in", "if.f>if2.in",
            "hp.out>le.a", "le.out>if2.cond", "if2.t>die.in"
        ]
    },

    // ---------------- 6.6 Part E ----------------
    {
        id: "6-6-a-die", title: "EnemyGraph · E. Dying (1 of 4): stop, and play the death animation",
        nodes: [
            event("ev", "Custom Event", [target(), value("name", "", "string", "Die")], [flowOut()]),
            note("co", "Select this node and tick Coroutine in the Graph Inspector."),
            literal("dead", "string", "Dead"),
            setVar("st", "State", "string"),
            resetPath("stop"),
            getVar("anim", "Anim", "object"),
            action("rh", "Animator", "Reset Trigger", [target(), value("name", "Name", "string", "Hit")], "animator"),
            action("ra", "Animator", "Reset Trigger", [target(), value("name", "Name", "string", "Attack")], "animator"),
            setTrigger("trig", "Die"),
            note("next", "Continues in the next picture.", { flowIn: true })
        ],
        edges: [
            "ev.out>st.in", "dead.out>st.value", "st.out>stop.in", "stop.out>rh.in", "anim.out>rh.target",
            "rh.out>ra.in", "anim.out>ra.target", "ra.out>trig.in", "anim.out>trig.target", "trig.out>next.in"
        ]
    },
    {
        id: "6-6-b-vanish", title: "EnemyGraph · E. Dying (2 of 4): stop being hittable, then vanish",
        nodes: [
            note("from", "From Animator: Set Trigger Die (previous picture)", { flowOut: true }),
            setColliderEnabled("col", false),
            getVar("bar", "HealthBar", "object"),
            setActive("hidebar", false),
            wait("w1", 2),
            getVar("model", "Model", "object"),
            setActive("hide", false),
            note("next", "Continues in the next picture.", { flowIn: true })
        ],
        edges: [
            "from.out>col.in", "col.out>hidebar.in", "bar.out>hidebar.target", "hidebar.out>w1.in",
            "w1.out>hide.in", "model.out>hide.target", "hide.out>next.in"
        ]
    },
    {
        id: "6-6-c-respawn", title: "EnemyGraph · E. Dying (3 of 4): wait, then go home healed",
        nodes: [
            note("from", "From Game Object: Set Active (previous picture)", { flowOut: true }),
            getVar("resp", "RespawnSeconds"),
            wait("w2"),
            getVar("home", "Home", "vector3"),
            action("warp", "Nav Mesh Agent", "Warp", [target(), value("pos", "New Position", "vector3")], "nav"),
            getVar("max", "MaxHealth"),
            setVar("hp", "Health"),
            triggerCustom("upd", "UpdateBar"),
            note("next", "Continues in the next picture.", { flowIn: true })
        ],
        edges: [
            "from.out>w2.in", "resp.out>w2.delay", "w2.out>warp.in", "home.out>warp.pos",
            "warp.out>hp.in", "max.out>hp.value", "hp.out>upd.in", "upd.out>next.in"
        ]
    },
    {
        id: "6-6-d-come-back", title: "EnemyGraph · E. Dying (4 of 4): come back to life",
        nodes: [
            note("from", "From Trigger Custom Event UpdateBar (previous picture)", { flowOut: true }),
            getVar("model", "Model", "object"),
            setActive("show", true),
            getVar("bar", "HealthBar", "object"),
            setActive("show2", true),
            setColliderEnabled("col", true),
            getVar("anim", "Anim", "object"),
            action("rebind", "Animator", "Play", [target(), value("state", "State Name", "string", "Base Layer.Idle"), value("layer", "Layer", "int", -1)], "animator"),
            literal("wander", "string", "Wander"),
            setVar("st", "State", "string")
        ],
        edges: [
            "from.out>show.in", "model.out>show.target", "show.out>show2.in", "bar.out>show2.target",
            "show2.out>col.in", "col.out>rebind.in", "anim.out>rebind.target", "rebind.out>st.in", "wander.out>st.value"
        ]
    },

    // ---------------- 6.7 Part F ----------------
    {
        id: "6-7-player-died", title: "EnemyGraph · F. When you die, it goes home",
        nodes: [
            onGlobal("ev", "PlayerDied"),
            getVar("s1", "State", "string"),
            literal("c", "string", "Chase"),
            compare("eq1", "Equal", "=", undefined, undefined, "any"),
            getVar("s2", "State", "string"),
            literal("a", "string", "Attack"),
            compare("eq2", "Equal", "=", undefined, undefined, "any"),
            { id: "or", title: "Or", icon: "logic", ins: [value("a", "A", "bool"), value("b", "B", "bool")], outs: [{ id: "out", label: "A | B", type: "bool" }] },
            ifNode("if"),
            literal("ret", "string", "Return"),
            setVar("st", "State", "string"),
            getVar("home", "Home", "vector3"),
            setDestination("dest")
        ],
        edges: [
            "ev.out>if.in", "s1.out>eq1.a", "c.out>eq1.b", "s2.out>eq2.a", "a.out>eq2.b",
            "eq1.out>or.a", "eq2.out>or.b", "or.out>if.cond",
            "if.t>st.in", "ret.out>st.value", "st.out>dest.in", "home.out>dest.dest"
        ]
    }
];

module.exports = { graphs, legend };
