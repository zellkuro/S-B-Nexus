// Swords and Spells Nexus backend: saves each player's level, XP, gold and quests.
//
// Runs on Cloudflare Workers with a D1 database. The world page calls it:
//   GET  /health                      -> { ok: true }
//   GET  /players/:uid?name=Display   -> { profile }            (creates a new player on first visit)
//   POST /players/:uid/events         -> { profile, xp, gold, goldLost, levelsGained, questsChanged }
//        body: { "event": { "type": "kill", "enemy": "slime" }, "name": "Display" }
//
// Every event goes through shared/rules.js, the same rules the world uses, so
// a client can only ask for things the rules allow. Refused events answer
// 409 with { error: { code, message }, profile } so the page can resync.
//
// Note: the SDK gives no way to prove which player is calling (see the design
// doc, section 9.4). The rules limit what a faked request can do.

import rules from "../../shared/rules.js";
import { D1Store } from "./store.js";

const UID_PATTERN = /^[A-Za-z0-9:_.-]{1,80}$/;
const MAX_BODY_BYTES = 4096;
const MAX_RETRIES = 3;

export default {
    fetch(request, env) {
        return handle(request, env, new D1Store(env.DB));
    }
};

export async function handle(request, env, store, now = Date.now(), random = secureRandom) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
        const url = new URL(request.url);
        const parts = url.pathname.split("/").filter(Boolean);

        if (request.method === "GET" && parts.length === 1 && parts[0] === "health") {
            return json({ ok: true }, 200, cors);
        }

        if (parts[0] !== "players" || !parts[1]) return error(404, "not-found", "No such route", cors);
        const uid = decodeURIComponent(parts[1]);
        if (!UID_PATTERN.test(uid)) return error(400, "bad-uid", "Player id isn't valid", cors);

        if (request.method === "GET" && parts.length === 2) {
            const name = cleanName(url.searchParams.get("name"));
            const { profile } = await loadOrCreate(store, uid, name, now);
            return json({ profile: publicProfile(profile) }, 200, cors);
        }

        if (request.method === "POST" && parts.length === 3 && parts[2] === "events") {
            const body = await readJson(request);
            if (!body || typeof body.event !== "object") return error(400, "bad-event", "Body needs an event", cors);
            return await applyWithRetry(store, uid, cleanName(body.name), body.event, now, random, cors);
        }

        return error(404, "not-found", "No such route", cors);
    } catch (e) {
        if (e instanceof HttpError) return error(e.status, e.code, e.message, cors);
        console.error(e);
        return error(500, "server-error", "Something went wrong", cors);
    }
}

async function loadOrCreate(store, uid, name, now) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const found = await store.get(uid);
        if (found) {
            if (name && found.profile.name !== name) {
                found.profile.name = name;
                if (await store.put(uid, found.profile, found.version)) return found;
                continue;
            }
            return found;
        }
        const profile = rules.newProfile(uid, name, now);
        if (await store.put(uid, profile, 0)) return { profile, version: 1 };
    }
    throw new HttpError(503, "busy", "Try again");
}

async function applyWithRetry(store, uid, name, event, now, random, cors) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const { profile, version } = await loadOrCreate(store, uid, name, now);
        let result;
        try {
            result = rules.applyEvent(profile, event, now, random());
        } catch (e) {
            if (e instanceof rules.RuleError) {
                return json({ error: { code: e.code, message: e.message }, profile: publicProfile(profile) }, 409, cors);
            }
            throw e;
        }
        if (await store.put(uid, result.profile, version)) {
            return json({
                profile: publicProfile(result.profile),
                xp: result.xp,
                gold: result.gold,
                goldLost: result.goldLost,
                levelsGained: result.levelsGained,
                questsChanged: result.questsChanged
            }, 200, cors);
        }
        // Someone else saved this player in between: read again and retry.
    }
    throw new HttpError(503, "busy", "Try again");
}

function publicProfile(profile) {
    const { recentKills, ...rest } = profile;
    return rest;
}

function cleanName(name) {
    return typeof name === "string" ? name.replace(/[\u0000-\u001f]/g, "").slice(0, 40) : "";
}

async function readJson(request) {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) throw new HttpError(413, "too-big", "Request is too big");
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new HttpError(400, "bad-json", "Body isn't JSON");
    }
}

// ALLOWED_ORIGINS: comma-separated origins, "*" for any, and "https://*.example.com"
// for any subdomain. Altspace worlds are served from https://<world>.worldspace.host.
function corsHeaders(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const ok = allowed.some((pattern) => pattern === "*" || pattern === origin || wildcardMatch(pattern, origin));
    const headers = {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
    };
    if (ok) headers["Access-Control-Allow-Origin"] = allowed.includes("*") ? "*" : origin;
    return headers;
}

function wildcardMatch(pattern, origin) {
    const star = pattern.indexOf("*.");
    if (star < 0 || !origin) return false;
    const prefix = pattern.slice(0, star);    // "https://"
    const suffix = pattern.slice(star + 1);   // ".worldspace.host"
    return origin.startsWith(prefix) && origin.endsWith(suffix) && origin.length > prefix.length + suffix.length;
}

function json(data, status, headers) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...headers, "Content-Type": "application/json" }
    });
}

function error(status, code, message, headers) {
    return json({ error: { code, message } }, status, headers);
}

function secureRandom() {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] / 2 ** 32;
}

class HttpError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
