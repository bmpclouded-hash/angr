import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Fish, MapPin, Plus, Home as HomeIcon, Map as MapIcon, BookOpen, Compass,
  User as UserIcon, Camera, X, Trophy, Wind, Sun, Sunrise, Sunset, Thermometer,
  Clock, ChevronRight, ChevronLeft, Search, Settings, LogOut, Check, Star,
  Lock, Ruler, Weight, Trash2, Anchor, Droplets, Gauge, Play, Square, Info,
  Filter, ArrowLeft, ImagePlus, BadgeCheck, Waves, Moon, ZoomIn, ZoomOut,
  Navigation, Crosshair, Minus, Medal, TrendingUp
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

/* ---------------------------------------------------------------
   ANGR — fishing companion app
   Persistence: window.storage (per-user key/value, survives reload)
   Note: there is no real backend here — "sign in" is a local profile
   name, not authentication, and data lives in this artifact's storage
   for this browser/account, not a synced multi-device database.
------------------------------------------------------------------*/

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* Map projection — the map represents a coastal-to-piedmont Carolinas region.
   x/y are percentages (0-100) within that box; lat/lng are derived from them
   so every pin has a real, exact coordinate rather than a vague marker. */
const MAP_BBOX = { latMin: 32.4, latMax: 35.4, lngMin: -81.6, lngMax: -79.5 };
function xyToLatLng(x, y) {
  const lat = MAP_BBOX.latMax - (y / 100) * (MAP_BBOX.latMax - MAP_BBOX.latMin);
  const lng = MAP_BBOX.lngMin + (x / 100) * (MAP_BBOX.lngMax - MAP_BBOX.lngMin);
  return { lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 };
}
function latLngToXY(lat, lng) {
  const x = ((lng - MAP_BBOX.lngMin) / (MAP_BBOX.lngMax - MAP_BBOX.lngMin)) * 100;
  const y = ((MAP_BBOX.latMax - lat) / (MAP_BBOX.latMax - MAP_BBOX.latMin)) * 100;
  return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
}

/* Water-blue accent, used for interactive pickers and water/map elements
   alongside the earthy rust/green/amber palette. */
const BLUE = "#2F6690";
const BLUE_LIGHT = "#BFE0F0";
const BLUE_DIM = "#1B3243";

const SPECIES = [
  { id: "largemouth-bass", name: "Largemouth Bass", habitat: "Weedy lakes, ponds, slow rivers", avgSize: "2–6 lb", seasons: "Spring & fall", bait: "Texas-rigged worm, spinnerbait", technique: "Cast near cover, work slow in cold water", fact: "Can leap several feet out of water when hooked.", water: "freshwater" },
  { id: "smallmouth-bass", name: "Smallmouth Bass", habitat: "Rocky lakes & clear rivers", avgSize: "1–4 lb", seasons: "Late spring, early fall", bait: "Tube jig, crankbait", technique: "Fish rocky points and current breaks", fact: "Pound-for-pound one of the hardest fighting freshwater fish.", water: "freshwater" },
  { id: "crappie", name: "Crappie", habitat: "Brush piles, submerged timber", avgSize: "0.5–2 lb", seasons: "Spring spawn", bait: "Minnow, small jig", technique: "Fish vertically near structure", fact: "Often called 'papermouth' for their thin, tearable mouth.", water: "freshwater" },
  { id: "bluegill", name: "Bluegill", habitat: "Ponds, lake shallows", avgSize: "0.25–1 lb", seasons: "Summer spawn", bait: "Worm, cricket, small popper", technique: "Light tackle, shallow beds", fact: "One of the most common panfish in North America.", water: "freshwater" },
  { id: "catfish", name: "Catfish", habitat: "Rivers, lake bottoms", avgSize: "2–20 lb", seasons: "Warm summer nights", bait: "Cut bait, stink bait, chicken liver", technique: "Bottom rig, fish after dark", fact: "Has taste buds covering its entire body.", water: "freshwater" },
  { id: "rainbow-trout", name: "Rainbow Trout", habitat: "Cold streams & lakes", avgSize: "1–4 lb", seasons: "Spring & fall", bait: "PowerBait, small spinner, nymph", technique: "Drift bait naturally with current", fact: "Named for the pink stripe along its side.", water: "freshwater" },
  { id: "redfish", name: "Redfish", habitat: "Coastal flats, marshes", avgSize: "3–15 lb", seasons: "Fall feeding runs", bait: "Cut mullet, gold spoon", technique: "Sight-fish tailing fish on shallow flats", fact: "Has a distinctive black eyespot near its tail.", water: "saltwater" },
  { id: "snook", name: "Snook", habitat: "Mangroves, inlets, docks", avgSize: "3–10 lb", seasons: "Summer spawn", bait: "Live pilchard, jerkbait", technique: "Cast tight to structure at dusk", fact: "Sensitive to cold — a hard freeze can be fatal to them.", water: "saltwater" },
  { id: "tarpon", name: "Tarpon", habitat: "Coastal channels, bridges", avgSize: "30–150 lb", seasons: "Late spring migration", bait: "Live crab, large swimbait", technique: "Match the roll, feed on the take", fact: "Can gulp air at the surface to survive low-oxygen water.", water: "saltwater" },
  { id: "striped-bass", name: "Striped Bass", habitat: "Coastal surf, rivers", avgSize: "5–30 lb", seasons: "Spring & fall runs", bait: "Bunker chunk, topwater plug", technique: "Fish moving tide and bait schools", fact: "Can live over 30 years in the wild.", water: "saltwater" },
];

/* Combines the built-in species guide with anything the user has added,
   so custom species work everywhere — search, autocomplete, trip targets. */
function combinedSpecies(data) {
  return [...SPECIES, ...((data && data.customSpecies) || [])];
}

function resizeImageToDataUrl(file, maxW, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale; canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      onDone(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function shareCatchCard(c, units) {
  const canvas = document.createElement("canvas");
  canvas.width = 800; canvas.height = 1000;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#1E2318"); grad.addColorStop(1, "#12140F");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);

  function finish(photoImg) {
    let top = 90;
    if (photoImg) {
      const ph = canvas.height * 0.52;
      const scale = Math.max(canvas.width / photoImg.width, ph / photoImg.height);
      const w = photoImg.width * scale, h = photoImg.height * scale;
      ctx.drawImage(photoImg, (canvas.width - w) / 2, (ph - h) / 2, w, h);
      top = ph + 70;
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#F2EFE6";
    ctx.font = "700 56px Georgia, serif";
    ctx.fillText(c.species, canvas.width / 2, top);
    ctx.fillStyle = "#D9A441";
    ctx.font = "600 36px Menlo, monospace";
    ctx.fillText(`${fmtWeight(c.weight, units)}  ·  ${fmtLength(c.length, units)}`, canvas.width / 2, top + 58);
    ctx.fillStyle = "#9CA394";
    ctx.font = "400 26px Helvetica, sans-serif";
    ctx.fillText(c.location, canvas.width / 2, top + 108);
    ctx.fillText(`Bait: ${c.bait}`, canvas.width / 2, top + 144);
    ctx.fillStyle = "#6B8F5A";
    ctx.font = "700 30px Georgia, serif";
    ctx.fillText("ANGR", canvas.width / 2, canvas.height - 50);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "angr-catch.png", { type: "image/png" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: c.species }).catch(() => {});
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `angr-${c.species.replace(/\s+/g, "-").toLowerCase()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
      }
    });
  }

  if (c.photos && c.photos[0]) {
    const img = new Image();
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = c.photos[0];
  } else {
    finish(null);
  }
}

const ACHIEVEMENTS = [
  { id: "first-catch", label: "First Catch", icon: "🏆", desc: "Log your first fish", check: (s) => s.totalFish >= 1 },
  { id: "ten-fish", label: "10 Fish", icon: "🎣", desc: "Catch 10 fish total", check: (s) => s.totalFish >= 10 },
  { id: "fifty-fish", label: "50 Fish", icon: "🐟", desc: "Catch 50 fish total", check: (s) => s.totalFish >= 50 },
  { id: "personal-best", label: "Personal Best", icon: "🔥", desc: "Beat your own record weight", check: (s) => s.hasPersonalBestBeat },
  { id: "first-salt", label: "First Saltwater Catch", icon: "🌊", desc: "Log a saltwater species", check: (s) => s.hasSaltwater },
  { id: "night-fisher", label: "Night Fisher", icon: "🌙", desc: "Log a catch after dark", check: (s) => s.hasNightCatch },
  { id: "ten-spots", label: "10 Fishing Spots", icon: "🗺️", desc: "Save 10 spots", check: (s) => s.totalSpots >= 10 },
  { id: "twentyfive-trips", label: "25 Trips", icon: "🏕️", desc: "Complete 25 trips", check: (s) => s.totalTrips >= 25 },
];

const CONDITIONS_DEMO = { temp: 74, feelsLike: 76, wind: 8, windDir: "SW", weather: "Partly cloudy", humidity: 61, pressure: 30.02, sunrise: "6:42 AM", sunset: "7:58 PM", moon: "Waxing gibbous" };
const TIDE_DEMO = { next: "High", nextTime: "4:12 PM", following: "Low", followingTime: "10:47 PM" };

function lbToKg(lb) { return lb * 0.453592; }
function inToCm(inch) { return inch * 2.54; }
function kgToLb(kg) { return kg / 0.453592; }
function cmToIn(cm) { return cm / 2.54; }
function fmtWeight(lb, units) { return units === "metric" ? `${lbToKg(lb).toFixed(1)}kg` : `${lb}lb`; }
function fmtLength(inch, units) { return units === "metric" ? `${inToCm(inch).toFixed(1)}cm` : `${inch}in`; }

function emptyData() {
  return { user: null, trips: [], catches: [], spots: [], gear: [], achievements: [], customSpecies: [] };
}

function demoSeed() {
  const now = Date.now();
  const day = 86400000;
  const spot1 = { id: uid(), name: "Lake Murray Cove", x: 32, y: 40, species: ["Largemouth Bass", "Crappie"], bait: "Texas-rigged worm", bestTime: "Early morning", notes: "Rocky point holds fish in summer.", privacy: "private", trips: 6, demo: true };
  const spot2 = { id: uid(), name: "Catawba River Bend", x: 58, y: 62, species: ["Smallmouth Bass", "Catfish"], bait: "Tube jig", bestTime: "Evening", notes: "Current break just past the bridge.", privacy: "private", trips: 3, demo: true };
  const spot3 = { id: uid(), name: "Folly Beach Inlet", x: 74, y: 24, species: ["Redfish", "Snook"], bait: "Gold spoon", bestTime: "Falling tide", notes: "Tailing reds on the flat at low tide.", privacy: "private", trips: 2, demo: true };

  const trip1 = { id: uid(), name: "Morning at Murray", location: spot1.name, spotId: spot1.id, species: "Largemouth Bass", startTime: now - 12 * day, endTime: now - 12 * day + 3 * 3600000, weather: "Clear, 68°F", notes: "Slow start, picked up after 8am.", demo: true };
  const trip2 = { id: uid(), name: "Bend Evening Run", location: spot2.name, spotId: spot2.id, species: "Smallmouth Bass", startTime: now - 5 * day, endTime: now - 5 * day + 2.5 * 3600000, weather: "Overcast, 71°F", notes: "", demo: true };

  const catches = [
    { id: uid(), tripId: trip1.id, species: "Largemouth Bass", length: 21.4, weight: 5.2, bait: "Texas-rigged worm", location: spot1.name, time: now - 12 * day + 1.5 * 3600000, photos: [], weatherNote: "Clear, 68°F", waterCondition: "Stained", notes: "Personal best!", gear: {}, demo: true },
    { id: uid(), tripId: trip1.id, species: "Largemouth Bass", length: 15.1, weight: 2.1, bait: "Spinnerbait", location: spot1.name, time: now - 12 * day + 2.2 * 3600000, photos: [], weatherNote: "Clear, 70°F", waterCondition: "Stained", notes: "", gear: {}, demo: true },
    { id: uid(), tripId: trip2.id, species: "Smallmouth Bass", length: 17.0, weight: 2.8, bait: "Tube jig", location: spot2.name, time: now - 5 * day + 1 * 3600000, photos: [], weatherNote: "Overcast, 71°F", waterCondition: "Clear", notes: "Fought hard near the current seam.", gear: {}, demo: true },
    { id: uid(), tripId: trip2.id, species: "Catfish", length: 24.0, weight: 6.5, bait: "Cut bait", location: spot2.name, time: now - 5 * day + 2 * 3600000, photos: [], weatherNote: "Overcast, 69°F", waterCondition: "Clear", notes: "", gear: {}, demo: true },
  ];

  const gear = [
    { id: uid(), category: "rod", brand: "St. Croix", model: "Bass X", length: "7'0\"", power: "Medium-Heavy", action: "Fast", demo: true },
    { id: uid(), category: "reel", brand: "Shimano", model: "Curado DC", ratio: "7.4:1", demo: true },
    { id: uid(), category: "lure", name: "Ol' Monster", brand: "Zoom", color: "Green Pumpkin", type: "Soft plastic worm", size: "7.5in", demo: true },
  ];

  return {
    user: null,
    trips: [trip1, trip2],
    catches,
    spots: [spot1, spot2, spot3],
    gear,
    achievements: [],
    customSpecies: [],
  };
}

function computeStats(data) {
  const totalFish = data.catches.length;
  const totalTrips = data.trips.length;
  const biggest = data.catches.reduce((m, c) => (c.weight > (m?.weight ?? -1) ? c : m), null);
  const speciesCount = {};
  data.catches.forEach((c) => { speciesCount[c.species] = (speciesCount[c.species] || 0) + 1; });
  const favoriteSpecies = Object.entries(speciesCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const totalSpots = data.spots.length;
  const hasSaltwater = data.catches.some((c) => combinedSpecies(data).find((s) => s.name === c.species)?.water === "saltwater");
  const hasNightCatch = data.catches.some((c) => {
    const h = new Date(c.time).getHours();
    return h >= 20 || h < 5;
  });
  const sortedByWeight = [...data.catches].sort((a, b) => a.time - b.time);
  let best = -Infinity, hasPersonalBestBeat = false;
  sortedByWeight.forEach((c) => { if (c.weight > best) { if (best !== -Infinity) hasPersonalBestBeat = true; best = c.weight; } });
  const now = Date.now();
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const tripsThisMonth = data.trips.filter((t) => t.startTime >= startOfMonth.getTime()).length;
  const bestBySpecies = {};
  data.catches.forEach((c) => { if (!bestBySpecies[c.species] || c.weight > bestBySpecies[c.species].weight) bestBySpecies[c.species] = c; });
  const personalBests = Object.values(bestBySpecies).sort((a, b) => b.weight - a.weight);
  return { totalFish, totalTrips, biggest, favoriteSpecies, totalSpots, hasSaltwater, hasNightCatch, hasPersonalBestBeat, tripsThisMonth, personalBests };
}

/* ---------------- storage helpers ----------------
   Uses localStorage — works in any real browser (GitHub Pages included).
   Kept as async functions so the rest of the app didn't need to change. */
async function loadData() {
  try {
    const raw = window.localStorage.getItem("angr-data");
    if (raw) return JSON.parse(raw);
  } catch (e) { /* storage unavailable or corrupted — fall through */ }
  return null;
}
async function saveData(data) {
  try { window.localStorage.setItem("angr-data", JSON.stringify(data)); } catch (e) { /* best effort — e.g. storage full or blocked */ }
}
function normalizeData(d) {
  if (!d) return d;
  return {
    ...d,
    customSpecies: d.customSpecies || [],
    catches: (d.catches || []).map((c) => c.photos ? c : { ...c, photos: c.photo ? [c.photo] : [] }),
  };
}

/* ---------------- small UI atoms ---------------- */

function Logo({ size = 28 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <path d="M8 22c0-7 5-14 12-14 5 0 8 3 8 3" stroke="#C17A46" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M28 11c1.5 0 3 1 3 3s-2 3.5-2 5c0 2 1.5 3 1.5 3" stroke="#C17A46" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="30.5" cy="12.5" r="1.6" fill="#C17A46" />
        <path d="M6 24c0 5 3.5 9 9 9 4 0 6-2 6-2" stroke="#6B8F5A" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      </svg>
      <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: size * 0.7, letterSpacing: 1, color: "#F2EFE6" }}>ANGR</span>
    </div>
  );
}

function WaveDivider({ color = "#2C3226" }) {
  return (
    <svg width="100%" height="10" viewBox="0 0 200 10" preserveAspectRatio="none" style={{ display: "block" }}>
      <path d="M0 5 Q 10 0, 20 5 T 40 5 T 60 5 T 80 5 T 100 5 T 120 5 T 140 5 T 160 5 T 180 5 T 200 5" stroke={color} strokeWidth="1" fill="none" />
    </svg>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#1E2318",
        border: "1px solid #2C3226",
        borderRadius: 16,
        padding: 16,
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Pill({ children, tone = "default" }) {
  const tones = {
    default: { bg: "#26402C", color: "#BFE0C6" },
    amber: { bg: "#3A2E14", color: "#E8C173" },
    rust: { bg: "#3A2415", color: "#E3A576" },
    muted: { bg: "#242A1D", color: "#9CA394" },
    blue: { bg: BLUE_DIM, color: BLUE_LIGHT },
  };
  const t = tones[tone] || tones.default;
  return (
    <span style={{ background: t.bg, color: t.color, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function BigButton({ icon: Icon, label, onClick, tone = "rust", style }) {
  const bg = tone === "rust" ? "linear-gradient(135deg,#C17A46,#9C5F32)" : "linear-gradient(135deg,#4A7C59,#2E5138)";
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        background: bg, color: "#F8F1E7", border: "none", borderRadius: 16,
        padding: "16px 20px", fontSize: 16, fontWeight: 700, fontFamily: "'Fraunces', serif",
        cursor: "pointer", boxShadow: "0 6px 18px rgba(0,0,0,0.35)", width: "100%",
        letterSpacing: 0.3, ...style,
      }}
    >
      {Icon && <Icon size={20} />}
      {label}
    </button>
  );
}

function TextField({ label, value, onChange, placeholder, type = "text", multiline, icon: Icon }) {
  const commonStyle = {
    width: "100%", background: "#161A12", border: "1px solid #2C3226", borderRadius: 10,
    color: "#F2EFE6", padding: Icon ? "10px 12px 10px 36px" : "10px 12px", fontSize: 14,
    fontFamily: "'Inter', sans-serif", outline: "none", boxSizing: "border-box",
  };
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <div style={{ fontSize: 12, color: "#9CA394", marginBottom: 6, fontWeight: 600 }}>{label}</div>}
      <div style={{ position: "relative" }}>
        {Icon && <Icon size={15} color="#6B7563" style={{ position: "absolute", left: 12, top: 12 }} />}
        {multiline ? (
          <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...commonStyle, resize: "vertical", fontFamily: "'Inter', sans-serif" }} />
        ) : (
          <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={commonStyle} />
        )}
      </div>
    </div>
  );
}

function PickerField({ label, value, onChange, options, scroll, allowClear }) {
  const all = allowClear ? ["All", ...options] : options;
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <div style={{ fontSize: 12, color: "#9CA394", marginBottom: 6, fontWeight: 600 }}>{label}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: scroll ? "nowrap" : "wrap", overflowX: scroll ? "auto" : "visible", paddingBottom: scroll ? 2 : 0 }}>
        {all.map((o) => {
          const selected = allowClear ? (o === "All" ? !value : value === o) : value === o;
          return (
            <button
              key={o}
              onClick={() => onChange(allowClear && o === "All" ? "" : o)}
              style={{
                flexShrink: scroll ? 0 : undefined,
                padding: "9px 15px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: selected ? `1px solid #4FA3D1` : "1px solid #2C3226",
                background: selected ? `linear-gradient(135deg, ${BLUE}, ${BLUE_DIM})` : "#161A12",
                color: selected ? BLUE_LIGHT : "#9CA394",
                whiteSpace: "nowrap", transition: "background 0.15s, color 0.15s",
              }}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, actionLabel, onAction }) {
  return (
    <div style={{ textAlign: "center", padding: "36px 20px", color: "#9CA394" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "#1E2318", border: "1px solid #2C3226", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
        <Icon size={26} color="#6B8F5A" />
      </div>
      <div style={{ color: "#F2EFE6", fontWeight: 700, fontFamily: "'Fraunces', serif", fontSize: 17, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, maxWidth: 280, margin: "0 auto 16px" }}>{body}</div>
      {actionLabel && <button onClick={onAction} style={{ background: "#26402C", color: "#BFE0C6", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: 0.4 }}>{actionLabel.toUpperCase()}</button>}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,10,7,0.72)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#181C13", width: "100%", maxWidth: wide ? 520 : 440, maxHeight: "88vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: 20, border: "1px solid #2C3226", borderBottom: "none", animation: "slideUp 0.25s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 19, color: "#F2EFE6" }}>{title}</div>
          <button onClick={onClose} style={{ background: "#242A1D", border: "none", borderRadius: 999, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={17} color="#F2EFE6" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DemoTag() {
  return <span style={{ fontSize: 9.5, fontFamily: "'JetBrains Mono', monospace", color: "#6B7563", background: "#20261A", border: "1px solid #2C3226", padding: "1px 6px", borderRadius: 5, letterSpacing: 0.5 }}>DEMO</span>;
}

/* ---------------- Onboarding ---------------- */

function Onboarding({ onDone }) {
  const [name, setName] = useState("");
  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 28, textAlign: "center" }}>
      <svg width="72" height="72" viewBox="0 0 40 40" fill="none" style={{ marginBottom: 18 }}>
        <path d="M8 22c0-7 5-14 12-14 5 0 8 3 8 3" stroke="#C17A46" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M28 11c1.5 0 3 1 3 3s-2 3.5-2 5c0 2 1.5 3 1.5 3" stroke="#C17A46" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="30.5" cy="12.5" r="1.8" fill="#C17A46" />
        <path d="M6 24c0 5 3.5 9 9 9 4 0 6-2 6-2" stroke="#6B8F5A" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
      </svg>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 34, letterSpacing: 1.5, color: "#F2EFE6" }}>ANGR</div>
      <div style={{ color: "#9CA394", fontSize: 14, marginTop: 6, marginBottom: 30, maxWidth: 280 }}>Your fishing log, spots, and gear — all in one place.</div>
      <div style={{ width: "100%", maxWidth: 300 }}>
        <TextField placeholder="What should we call you?" value={name} onChange={setName} icon={UserIcon} />
        <BigButton icon={ChevronRight} label="Get on the water" onClick={() => name.trim() && onDone(name.trim())} />
      </div>
      <div style={{ fontSize: 11, color: "#5C6353", marginTop: 22, maxWidth: 280, lineHeight: 1.5 }}>
        This just sets a local profile name — there's no password or account system behind it.
      </div>
    </div>
  );
}

/* ---------------- Conditions widget ---------------- */

function ConditionsCard() {
  const c = CONDITIONS_DEMO;
  const items = [
    { icon: Thermometer, label: "Temp", value: `${c.temp}°F` },
    { icon: Wind, label: "Wind", value: `${c.wind} mph ${c.windDir}`, blue: true },
    { icon: Droplets, label: "Humidity", value: `${c.humidity}%`, blue: true },
    { icon: Gauge, label: "Pressure", value: `${c.pressure} in` },
    { icon: Sunrise, label: "Sunrise", value: c.sunrise },
    { icon: Sunset, label: "Sunset", value: c.sunset },
    { icon: Moon, label: "Moon", value: c.moon.split(" ")[0] },
  ];
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 15, color: "#F2EFE6" }}>Today's Conditions</div>
        <Pill tone="amber">{c.weather}</Pill>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <it.icon size={15} color={it.blue ? BLUE_LIGHT : "#6B8F5A"} />
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#F2EFE6", fontWeight: 600 }}>{it.value}</div>
            <div style={{ fontSize: 10, color: "#7A8270" }}>{it.label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 10.5, color: "#5C6353", display: "flex", alignItems: "center", gap: 5 }}>
        <Info size={11} /> Placeholder data — wire up a weather API to make this live.
      </div>
    </Card>
  );
}

/* ---------------- Home ---------------- */

function Home({ data, stats, units, onStartFishing, onOpenTrip, onGoMap, onGoTab }) {
  const recentTrips = [...data.trips].sort((a, b) => b.startTime - a.startTime).slice(0, 3);
  const favSpots = data.spots.slice(0, 3);
  return (
    <div style={{ padding: "18px 16px 100px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ color: "#9CA394", fontSize: 13 }}>Good {timeOfDay()},</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 26, color: "#F2EFE6" }}>{data.user?.name || "Angler"}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Trips this month", value: stats.tripsThisMonth },
          { label: "Fish caught", value: stats.totalFish },
          { label: "Biggest catch", value: stats.biggest ? fmtWeight(stats.biggest.weight, units) : "—" },
          { label: "Top species", value: stats.favoriteSpecies ? stats.favoriteSpecies.split(" ")[0] : "—" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#1E2318", border: "1px solid #2C3226", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15, color: "#F2EFE6" }}>{s.value}</div>
            <div style={{ fontSize: 9, color: "#7A8270", marginTop: 3, lineHeight: 1.3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <BigButton icon={Anchor} label="Start Fishing" onClick={onStartFishing} />
      </div>

      <div style={{ marginBottom: 20 }}><ConditionsCard /></div>

      <SectionHeader title="Recent Trips" onSeeAll={() => onGoTab("log")} />
      {recentTrips.length === 0 ? (
        <Card style={{ marginBottom: 20 }}><EmptyState icon={Anchor} title="No trips yet" body="Start your first fishing trip and it'll show up here." actionLabel="Start Fishing" onAction={onStartFishing} /></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {recentTrips.map((t) => {
            const tCatches = data.catches.filter((c) => c.tripId === t.id);
            const biggest = tCatches.reduce((m, c) => (c.weight > (m?.weight ?? -1) ? c : m), null);
            return (
              <Card key={t.id} onClick={() => onOpenTrip(t)} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, background: "linear-gradient(135deg,#26402C,#161A12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Waves size={22} color="#6B8F5A" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: "#F2EFE6", fontSize: 14 }}>{t.name}</div>
                    {t.demo && <DemoTag />}
                  </div>
                  <div style={{ fontSize: 12, color: "#9CA394" }}>{t.location} · {fmtDate(t.startTime)}</div>
                  <div style={{ fontSize: 11.5, color: "#7A8270", marginTop: 2 }}>{tCatches.length} caught{biggest ? ` · biggest ${fmtWeight(biggest.weight, units)}` : ""} · {fmtDuration(t.endTime - t.startTime)}</div>
                </div>
                <ChevronRight size={16} color="#5C6353" />
              </Card>
            );
          })}
        </div>
      )}

      <SectionHeader title="Favorite Spots" onSeeAll={onGoMap} />
      {favSpots.length === 0 ? (
        <Card><EmptyState icon={MapPin} title="No spots saved" body="Save a fishing spot from the map to see it here." actionLabel="Open Map" onAction={onGoMap} /></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {favSpots.map((s) => (
            <Card key={s.id} onClick={onGoMap} style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#26402C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <MapPin size={18} color="#BFE0C6" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "#F2EFE6", fontSize: 14 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: "#9CA394" }}>{s.species.slice(0, 2).join(", ")}</div>
              </div>
              <Pill tone="muted">{s.trips} trips</Pill>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, onSeeAll }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 16, color: "#F2EFE6" }}>{title}</div>
      {onSeeAll && <button onClick={onSeeAll} style={{ background: "none", border: "none", color: "#8FAE7E", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>See all</button>}
    </div>
  );
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
function fmtDate(ts) { return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function fmtDateTime(ts) { return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
function fmtDuration(ms) {
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ---------------- Map ---------------- */

function MapScreen({ data, onAddSpot, onDeleteSpot }) {
  const [selected, setSelected] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState(null); // { x, y }
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [locError, setLocError] = useState("");
  const [mapQuery, setMapQuery] = useState("");
  const containerRef = useRef(null);
  const dragState = useRef(null);

  const searchMatches = mapQuery.length > 0 ? data.spots.filter((s) => s.name.toLowerCase().includes(mapQuery.toLowerCase())) : [];

  function goToSpot(s) {
    const z = 2.2;
    const rect = containerRef.current.getBoundingClientRect();
    const px = (s.x / 100) * rect.width * z, py = (s.y / 100) * rect.height * z;
    setZoom(z);
    setPan(clampPan({ x: rect.width / 2 - px, y: rect.height / 2 - py }, z));
    setSelected(s);
    setMapQuery("");
  }

  const clampPan = useCallback((p, z) => {
    const el = containerRef.current;
    if (!el) return p;
    const rect = el.getBoundingClientRect();
    const contentW = rect.width * z, contentH = rect.height * z;
    const minX = Math.min(0, rect.width - contentW), minY = Math.min(0, rect.height - contentH);
    return { x: Math.min(0, Math.max(minX, p.x)), y: Math.min(0, Math.max(minY, p.y)) };
  }, []);

  function pointToXY(clientX, clientY) {
    const rect = containerRef.current.getBoundingClientRect();
    const px = clientX - rect.left - pan.x;
    const py = clientY - rect.top - pan.y;
    const x = Math.min(100, Math.max(0, (px / (rect.width * zoom)) * 100));
    const y = Math.min(100, Math.max(0, (py / (rect.height * zoom)) * 100));
    return { x, y };
  }

  function handlePointerDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, startPan: pan, moved: false };
  }
  function handlePointerMove(e) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX, dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragState.current.moved = true;
    setPan(clampPan({ x: dragState.current.startPan.x + dx, y: dragState.current.startPan.y + dy }, zoom));
  }
  function handlePointerUp(e) {
    if (!dragState.current) return; // pointerdown originated on a marker/child, not the map itself
    const wasDrag = dragState.current.moved;
    dragState.current = null;
    if (wasDrag) return;
    if (placing) {
      const { x, y } = pointToXY(e.clientX, e.clientY);
      setDraft({ x, y });
    } else {
      setSelected(null);
    }
  }

  function adjustZoom(factor) {
    const nz = Math.min(3.5, Math.max(1, zoom * factor));
    setZoom(nz);
    setPan((p) => clampPan(p, nz));
  }

  function dragDraftPin(e) {
    e.stopPropagation();
    const move = (ev) => setDraft(pointToXY(ev.clientX, ev.clientY));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function useMyLocation() {
    setLocError("");
    if (!navigator.geolocation) { setLocError("Location isn't available in this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { x, y } = latLngToXY(pos.coords.latitude, pos.coords.longitude);
        setPlacing(true);
        setZoom(1); setPan({ x: 0, y: 0 });
        setDraft({ x, y });
      },
      () => setLocError("Couldn't get your location — tap the map to drop a pin instead."),
      { timeout: 6000 }
    );
  }

  const draftCoords = draft ? xyToLatLng(draft.x, draft.y) : null;

  return (
    <div style={{ padding: "18px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: "#F2EFE6" }}>Fishing Map</div>
        {!placing ? (
          <button onClick={() => { setPlacing(true); setSelected(null); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#26402C", color: "#BFE0C6", border: "none", borderRadius: 10, padding: "8px 12px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
            <Plus size={15} /> Add Spot
          </button>
        ) : (
          <button onClick={() => { setPlacing(false); setDraft(null); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#3A2415", color: "#E3A576", border: "none", borderRadius: 10, padding: "8px 12px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
            <X size={15} /> Cancel
          </button>
        )}
      </div>

      {placing && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: BLUE_DIM, border: `1px solid ${BLUE}`, borderRadius: 10, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: BLUE_LIGHT }}>
          <Crosshair size={14} style={{ flexShrink: 0 }} /> Tap the map for the exact spot — you can drag the pin to fine-tune it.
        </div>
      )}
      {!placing && (
        <div style={{ position: "relative", marginBottom: 10 }}>
          <TextField placeholder="Search your spots…" value={mapQuery} onChange={setMapQuery} icon={Search} />
          {searchMatches.length > 0 && (
            <div style={{ marginTop: -8, background: "#161A12", border: "1px solid #2C3226", borderRadius: 10, overflow: "hidden" }}>
              {searchMatches.map((s) => (
                <div key={s.id} onClick={() => goToSpot(s)} style={{ padding: "9px 12px", fontSize: 13, color: "#F2EFE6", cursor: "pointer", borderBottom: "1px solid #20261A", display: "flex", alignItems: "center", gap: 8 }}>
                  <MapPin size={13} color="#8FAE7E" /> {s.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {locError && <div style={{ fontSize: 11.5, color: "#E3A576", marginBottom: 10 }}>{locError}</div>}

      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: "relative", width: "100%", aspectRatio: "1/1",
          background: "linear-gradient(135deg,#16232A,#101710)", borderRadius: 18,
          border: placing ? "1px solid #D9A441" : "1px solid #2C3226", overflow: "hidden", marginBottom: 10,
          cursor: placing ? "crosshair" : "grab", touchAction: "none",
        }}
      >
        <div style={{ position: "absolute", width: `${100 * zoom}%`, height: `${100 * zoom}%`, left: pan.x, top: pan.y }}>
          <TopoPattern />
          {data.spots.map((s) => (
            <div key={s.id}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); if (!placing) setSelected(s); }}
              title={s.name}
              style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, transform: "translate(-50%,-100%)", cursor: "pointer" }}>
              <MapPin size={30 / Math.max(1, zoom * 0.6)} color={selected?.id === s.id ? "#D9A441" : "#C17A46"} fill={selected?.id === s.id ? "#D9A441" : "#C17A46"} fillOpacity={0.25} strokeWidth={2} />
            </div>
          ))}
          {draft && (
            <div
              onPointerDown={dragDraftPin}
              style={{ position: "absolute", left: `${draft.x}%`, top: `${draft.y}%`, transform: "translate(-50%,-100%)", cursor: "grab" }}>
              <MapPin size={32 / Math.max(1, zoom * 0.6)} color="#D9A441" fill="#D9A441" fillOpacity={0.35} strokeWidth={2.5} />
            </div>
          )}
        </div>

        {data.spots.length === 0 && !placing && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#5C6353", fontSize: 13, textAlign: "center", padding: 20, pointerEvents: "none" }}>
            Tap "Add Spot" to drop your first pin
          </div>
        )}

        <div style={{ position: "absolute", right: 10, top: 10, display: "flex", flexDirection: "column", gap: 6 }} onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={() => adjustZoom(1.4)} style={mapBtnStyle}><ZoomIn size={15} /></button>
          <button onClick={() => adjustZoom(1 / 1.4)} style={mapBtnStyle}><ZoomOut size={15} /></button>
        </div>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={useMyLocation} style={{ ...mapBtnStyle, position: "absolute", left: 10, top: 10, width: "auto", padding: "0 10px", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, border: `1px solid ${BLUE}`, color: BLUE_LIGHT }}>
          <Navigation size={13} /> My location
        </button>
      </div>

      {draft && (
        <AddSpotModal
          coords={draftCoords}
          onClose={() => setDraft(null)}
          onSave={(spot) => { onAddSpot({ ...spot, x: draft.x, y: draft.y }); setDraft(null); setPlacing(false); }}
        />
      )}

      {selected && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#F2EFE6", fontFamily: "'Fraunces', serif" }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: "#9CA394", marginTop: 2 }}>{selected.privacy === "private" ? "🔒 Private" : selected.privacy === "friends" ? "Friends-only" : "Public"} · {selected.trips} trips</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6B8F5A", marginTop: 3 }}>
                {xyToLatLng(selected.x, selected.y).lat.toFixed(4)}, {xyToLatLng(selected.x, selected.y).lng.toFixed(4)}
              </div>
            </div>
            <button onClick={() => { onDeleteSpot(selected.id); setSelected(null); }} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={16} color="#B5654A" /></button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0" }}>
            {selected.species.map((sp) => <Pill key={sp}>{sp}</Pill>)}
          </div>
          <div style={{ fontSize: 12.5, color: "#C7CCBB", lineHeight: 1.6 }}>
            <div><b style={{ color: "#9CA394" }}>Best bait:</b> {selected.bait}</div>
            <div><b style={{ color: "#9CA394" }}>Best time:</b> {selected.bestTime}</div>
            {selected.species.some((sp) => combinedSpecies(data).find((s) => s.name === sp)?.water === "saltwater") && (
              <div><b style={{ color: "#9CA394" }}>Tide:</b> {TIDE_DEMO.next} {TIDE_DEMO.nextTime} → {TIDE_DEMO.following} {TIDE_DEMO.followingTime} <span style={{ color: "#5C6353" }}>(placeholder)</span></div>
            )}
            {selected.notes && <div><b style={{ color: "#9CA394" }}>Notes:</b> {selected.notes}</div>}
          </div>
        </Card>
      )}

      <SectionHeader title="Saved Spots" />
      {data.spots.length === 0 ? (
        <Card><EmptyState icon={MapPin} title="No spots yet" body="Spots you save will appear here with your notes and catch history." actionLabel="Add Fishing Spot" onAction={() => setPlacing(true)} /></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.spots.map((s) => (
            <Card key={s.id} onClick={() => setSelected(s)} style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#26402C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MapPin size={18} color="#BFE0C6" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ fontWeight: 700, color: "#F2EFE6", fontSize: 14 }}>{s.name}</div>
                  {s.demo && <DemoTag />}
                </div>
                <div style={{ fontSize: 12, color: "#9CA394" }}>{s.species.slice(0, 2).join(", ")}</div>
              </div>
              <ChevronRight size={15} color="#5C6353" />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const mapBtnStyle = { width: 30, height: 30, borderRadius: 9, background: "rgba(18,20,15,0.85)", border: "1px solid #3A4530", color: "#F2EFE6", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };

function TopoPattern() {
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.4 }} preserveAspectRatio="none">
      {[...Array(6)].map((_, i) => (
        <path key={i} d={`M0 ${20 + i * 40} Q 60 ${i % 2 === 0 ? 0 : 40}, 120 ${20 + i * 40} T 240 ${20 + i * 40} T 360 ${20 + i * 40}`} stroke={i % 2 === 0 ? "#2F5A6B" : "#3A4530"} strokeWidth="1" fill="none" />
      ))}
    </svg>
  );
}

function AddSpotModal({ coords, onClose, onSave }) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [bait, setBait] = useState("");
  const [bestTime, setBestTime] = useState("");
  const [notes, setNotes] = useState("");
  const [privacy, setPrivacy] = useState("private");
  return (
    <Modal title="Add Fishing Spot" onClose={onClose}>
      {coords && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#20261A", border: "1px solid #2C3226", borderRadius: 10, padding: "8px 12px", marginBottom: 14 }}>
          <Crosshair size={14} color="#D9A441" />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: "#D9A441" }}>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
          <span style={{ fontSize: 10.5, color: "#7A8270", marginLeft: "auto" }}>pinned on map</span>
        </div>
      )}
      <TextField label="Spot name" value={name} onChange={setName} placeholder="e.g. Sunset Cove" icon={MapPin} />
      <TextField label="Species (comma separated)" value={species} onChange={setSpecies} placeholder="Largemouth Bass, Crappie" icon={Fish} />
      <TextField label="Best bait" value={bait} onChange={setBait} placeholder="Texas-rigged worm" icon={Anchor} />
      <TextField label="Best time" value={bestTime} onChange={setBestTime} placeholder="Early morning" icon={Clock} />
      <TextField label="Notes" value={notes} onChange={setNotes} placeholder="Anything worth remembering about this spot" multiline />
      <PickerField label="Privacy" value={privacy} onChange={setPrivacy} options={["private", "friends", "public"]} />
      <div style={{ fontSize: 11, color: "#5C6353", marginBottom: 14, display: "flex", gap: 5, alignItems: "flex-start" }}>
        <Lock size={12} style={{ marginTop: 2, flexShrink: 0 }} /> New spots default to private — coordinates are never shown publicly.
      </div>
      <BigButton icon={Check} label="Save Spot" onClick={() => name.trim() && onSave({
        id: uid(), name: name.trim(),
        species: species.split(",").map((s) => s.trim()).filter(Boolean), bait: bait || "—", bestTime: bestTime || "—",
        notes, privacy, trips: 0,
      })} tone="green" />
    </Modal>
  );
}

/* ---------------- Trip flow ---------------- */

function TripSetupModal({ spots, speciesList, onClose, onStart }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [target, setTarget] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Modal title="Start Fishing" onClose={onClose}>
      <TextField label="Trip name" value={name} onChange={setName} placeholder="e.g. Morning at Murray" icon={Anchor} />
      <PickerField label="Location" value={location} onChange={setLocation} options={[...spots.map((s) => s.name), "New location"]} scroll />
      <PickerField label="Target species" value={target} onChange={setTarget} options={speciesList.map((s) => s.name)} scroll />
      <TextField label="Notes" value={notes} onChange={setNotes} placeholder="Anything you want to remember" multiline />
      <BigButton icon={Play} label="Begin Trip" onClick={() => onStart({
        id: uid(), name: name.trim() || "Fishing Trip", location: location || "Unspecified", spotId: spots.find((s) => s.name === location)?.id || null,
        species: target, startTime: Date.now(), endTime: null, weather: `${CONDITIONS_DEMO.weather}, ${CONDITIONS_DEMO.temp}°F`, notes,
      })} />
    </Modal>
  );
}

function ActiveTripBar({ trip, catchCount, onLogCatch, onEnd }) {
  const [elapsed, setElapsed] = useState(Date.now() - trip.startTime);
  useEffect(() => { const t = setInterval(() => setElapsed(Date.now() - trip.startTime), 1000); return () => clearInterval(t); }, [trip.startTime]);
  return (
    <div style={{ position: "fixed", bottom: 74, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 30, padding: "0 16px" }}>
      <div style={{ background: "#1E2318", border: "1px solid #3A4530", borderRadius: 18, padding: "12px 14px", width: "100%", maxWidth: 480, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, color: "#F2EFE6", fontSize: 13.5 }}>{trip.name}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#8FAE7E" }}>{fmtDuration(elapsed)} · {catchCount} caught</div>
          </div>
          <button onClick={onEnd} style={{ display: "flex", alignItems: "center", gap: 5, background: "#3A2415", color: "#E3A576", border: "none", borderRadius: 10, padding: "8px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            <Square size={12} /> End Trip
          </button>
        </div>
        <BigButton icon={Fish} label="LOG CATCH" onClick={onLogCatch} />
      </div>
    </div>
  );
}

function LogCatchModal({ gear, speciesList, units, initial, onClose, onSave }) {
  const isEdit = !!initial;
  const [species, setSpecies] = useState(initial?.species || "");
  const [showSuggest, setShowSuggest] = useState(false);
  const [length, setLength] = useState(initial ? (units === "metric" ? inToCm(initial.length).toFixed(1) : String(initial.length)) : "");
  const [weight, setWeight] = useState(initial ? (units === "metric" ? lbToKg(initial.weight).toFixed(1) : String(initial.weight)) : "");
  const [bait, setBait] = useState(initial?.bait || "");
  const [location, setLocation] = useState(initial?.location || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [waterCondition, setWaterCondition] = useState(initial?.waterCondition || "");
  const [photos, setPhotos] = useState(initial?.photos || []);
  const fileRef = useRef(null);

  const suggestions = species.length > 0 ? speciesList.filter((s) => s.name.toLowerCase().includes(species.toLowerCase())).slice(0, 5) : [];
  const lengthUnit = units === "metric" ? "cm" : "in";
  const weightUnit = units === "metric" ? "kg" : "lb";

  function handlePhoto(e) {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => resizeImageToDataUrl(file, 480, (dataUrl) => setPhotos((p) => [...p, dataUrl])));
  }
  function removePhoto(i) { setPhotos((p) => p.filter((_, idx) => idx !== i)); }

  function save() {
    if (!species.trim()) return;
    const lengthIn = units === "metric" ? cmToIn(parseFloat(length) || 0) : (parseFloat(length) || 0);
    const weightLb = units === "metric" ? kgToLb(parseFloat(weight) || 0) : (parseFloat(weight) || 0);
    onSave({
      ...(initial || {}),
      id: initial?.id || uid(), species: species.trim(), length: Math.round(lengthIn * 10) / 10, weight: Math.round(weightLb * 10) / 10,
      bait: bait || "—", location: location || "—", time: initial?.time || Date.now(), photos, waterCondition: waterCondition || "—",
      notes, weatherNote: initial?.weatherNote || `${CONDITIONS_DEMO.weather}, ${CONDITIONS_DEMO.temp}°F`, gear: initial?.gear || {},
    });
  }

  return (
    <Modal title={isEdit ? "Edit Catch" : "Log Catch"} onClose={onClose}>
      <div style={{ position: "relative" }}>
        <TextField label="Species" value={species} onChange={(v) => { setSpecies(v); setShowSuggest(true); }} placeholder="Start typing…" icon={Fish} />
        {showSuggest && suggestions.length > 0 && (
          <div style={{ marginTop: -8, marginBottom: 12, background: "#161A12", border: "1px solid #2C3226", borderRadius: 10, overflow: "hidden" }}>
            {suggestions.map((s) => (
              <div key={s.id} onClick={() => { setSpecies(s.name); setShowSuggest(false); }} style={{ padding: "8px 12px", fontSize: 13, color: "#F2EFE6", cursor: "pointer", borderBottom: "1px solid #20261A" }}>{s.name}</div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><TextField label={`Length (${lengthUnit})`} value={length} onChange={setLength} placeholder={units === "metric" ? "54" : "21.4"} type="number" icon={Ruler} /></div>
        <div style={{ flex: 1 }}><TextField label={`Weight (${weightUnit})`} value={weight} onChange={setWeight} placeholder={units === "metric" ? "2.4" : "5.2"} type="number" icon={Weight} /></div>
      </div>
      <TextField label="Bait / Lure" value={bait} onChange={setBait} placeholder="Texas-rigged worm" icon={Anchor} />
      <TextField label="Location" value={location} onChange={setLocation} placeholder="Lake Murray" icon={MapPin} />
      <PickerField label="Water conditions" value={waterCondition} onChange={setWaterCondition} options={["Clear", "Stained", "Muddy", "Calm", "Choppy"]} />
      <TextField label="Notes" value={notes} onChange={setNotes} placeholder="Anything worth remembering" multiline />

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#9CA394", marginBottom: 6, fontWeight: 600 }}>Photos</div>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhoto} style={{ display: "none" }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: "relative", width: 76, height: 76 }}>
              <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
              <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: -6, right: -6, background: "#B5654A", border: "none", borderRadius: 999, width: 20, height: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={11} color="#fff" /></button>
            </div>
          ))}
          <button onClick={() => fileRef.current?.click()} style={{ width: 76, height: 76, border: "1px dashed #3A4530", background: "#161A12", borderRadius: 10, color: "#8FAE7E", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" }}>
            <ImagePlus size={18} /> <span style={{ fontSize: 10 }}>Add</span>
          </button>
        </div>
      </div>

      <BigButton icon={Check} label={isEdit ? "Save Changes" : "Save Catch"} onClick={save} />
    </Modal>
  );
}

function CatchConfirmation({ c, units, onClose }) {
  return (
    <Modal title="Nice fish!" onClose={onClose}>
      {c.photos && c.photos.length > 0 && (
        c.photos.length === 1 ? (
          <img src={c.photos[0]} alt="" style={{ width: "100%", borderRadius: 12, marginBottom: 14 }} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
            {c.photos.slice(0, 4).map((p, i) => <img key={i} src={p} alt="" style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", borderRadius: 10 }} />)}
          </div>
        )
      )}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 24, color: "#F2EFE6" }}>{c.species}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", color: "#D9A441", fontSize: 18, marginTop: 4 }}>{fmtWeight(c.weight, units)} &nbsp;·&nbsp; {fmtLength(c.length, units)}</div>
        <div style={{ color: "#9CA394", fontSize: 13, marginTop: 10 }}>Caught at</div>
        <div style={{ color: "#F2EFE6", fontWeight: 600 }}>{c.location}</div>
        <div style={{ color: "#9CA394", fontSize: 13, marginTop: 8 }}>Bait</div>
        <div style={{ color: "#F2EFE6", fontWeight: 600 }}>{c.bait}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => shareCatchCard(c, units)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#242A1D", border: `1px solid ${BLUE}`, color: BLUE_LIGHT, borderRadius: 14, padding: "13px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          <ImagePlus size={16} /> Share
        </button>
        <div style={{ flex: 1.4 }}><BigButton icon={Check} label="Back to trip" onClick={onClose} tone="green" /></div>
      </div>
    </Modal>
  );
}

function weeklyTrend(catches) {
  const week = 7 * 86400000;
  const now = Date.now();
  const buckets = [...Array(8)].map((_, i) => ({ start: now - (7 - i) * week, count: 0 }));
  catches.forEach((c) => {
    const idx = buckets.findIndex((b, i) => c.time >= b.start && c.time < b.start + week);
    if (idx >= 0) buckets[idx].count++;
    else if (c.time >= buckets[7].start) buckets[7].count++;
  });
  return buckets.map((b) => ({ label: new Date(b.start).toLocaleDateString(undefined, { month: "short", day: "numeric" }), count: b.count }));
}

/* ---------------- Journal (Log tab) ---------------- */

function Journal({ data, stats, units, onStartFishing, onDeleteCatch, onEditCatch, onDeleteTrip, onEditTrip }) {
  const [filterSpecies, setFilterSpecies] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [tab, setTab] = useState("trips");

  const filteredCatches = data.catches.filter((c) => (!filterSpecies || c.species === filterSpecies) && (!filterLocation || c.location === filterLocation));
  const filteredTrips = data.trips.filter((t) => (!filterLocation || t.location === filterLocation));
  const uniqueSpecies = [...new Set(data.catches.map((c) => c.species))];
  const uniqueLocations = [...new Set([...data.catches.map((c) => c.location), ...data.trips.map((t) => t.location)])];

  return (
    <div style={{ padding: "18px 16px 100px" }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: "#F2EFE6", marginBottom: 14 }}>Fishing Journal</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Total Fish", value: stats.totalFish },
          { label: "Trips", value: stats.totalTrips },
          { label: "Biggest Fish", value: stats.biggest ? fmtWeight(stats.biggest.weight, units) : "—" },
          { label: "Fav. Species", value: stats.favoriteSpecies ? stats.favoriteSpecies.split(" ")[0] : "—" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#1E2318", border: "1px solid #2C3226", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15, color: "#F2EFE6" }}>{s.value}</div>
            <div style={{ fontSize: 9, color: "#7A8270", marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {stats.personalBests.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionHeader title="Personal Bests" />
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {stats.personalBests.slice(0, 6).map((c) => (
              <div key={c.species} style={{ flexShrink: 0, width: 118, background: "#1E2318", border: "1px solid #2C3226", borderRadius: 14, padding: 12 }}>
                <Medal size={16} color="#D9A441" />
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 16, color: "#F2EFE6", marginTop: 6 }}>{fmtWeight(c.weight, units)}</div>
                <div style={{ fontSize: 11, color: "#9CA394", marginTop: 2, lineHeight: 1.3 }}>{c.species}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.catches.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <SectionHeader title="Catch Trend" />
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 11.5, color: "#7A8270" }}>
              <TrendingUp size={13} color="#6B8F5A" /> Fish logged per week, last 8 weeks
            </div>
            <div style={{ width: "100%", height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTrend(data.catches)} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="#242A1D" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#7A8270", fontSize: 10 }} axisLine={{ stroke: "#2C3226" }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#7A8270", fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip contentStyle={{ background: "#1E2318", border: "1px solid #3A4530", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#F2EFE6" }} />
                  <Line type="monotone" dataKey="count" stroke="#D9A441" strokeWidth={2.5} dot={{ r: 3, fill: "#D9A441" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["trips", "catches"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid #2C3226", background: tab === t ? "#26402C" : "#161A12", color: tab === t ? "#BFE0C6" : "#9CA394", fontWeight: 700, fontSize: 13, cursor: "pointer", textTransform: "capitalize" }}>{t}</button>
        ))}
      </div>

      <PickerField value={filterSpecies} onChange={setFilterSpecies} options={uniqueSpecies} allowClear scroll />
      <PickerField value={filterLocation} onChange={setFilterLocation} options={uniqueLocations} allowClear scroll />

      {tab === "trips" ? (
        filteredTrips.length === 0 ? (
          <EmptyState icon={Anchor} title="No trips yet" body="Start your first fishing trip and your catches will appear here." actionLabel="Start Fishing" onAction={onStartFishing} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...filteredTrips].sort((a, b) => b.startTime - a.startTime).map((t) => {
              const tCatches = data.catches.filter((c) => c.tripId === t.id);
              return (
                <Card key={t.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontWeight: 700, color: "#F2EFE6" }}>{t.name}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {t.demo && <DemoTag />}
                      <button onClick={() => onEditTrip(t)} style={{ background: "none", border: "none", cursor: "pointer" }}><Settings size={14} color="#7A8270" /></button>
                      <button onClick={() => onDeleteTrip(t)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color="#B5654A" /></button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#9CA394", marginTop: 2 }}>{t.location} · {fmtDate(t.startTime)} · {t.endTime ? fmtDuration(t.endTime - t.startTime) : "in progress"}</div>
                  <div style={{ fontSize: 12, color: "#7A8270", marginTop: 6 }}>{tCatches.length} fish caught{t.notes ? ` — "${t.notes}"` : ""}</div>
                </Card>
              );
            })}
          </div>
        )
      ) : filteredCatches.length === 0 ? (
        <EmptyState icon={Fish} title="No catches yet" body="Log a catch during a trip and it'll show up here." actionLabel="Start Fishing" onAction={onStartFishing} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...filteredCatches].sort((a, b) => b.time - a.time).map((c) => (
            <Card key={c.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                {c.photos && c.photos[0] ? <img src={c.photos[0]} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }} /> :
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: "#26402C", display: "flex", alignItems: "center", justifyContent: "center" }}><Fish size={20} color="#BFE0C6" /></div>}
                {c.photos && c.photos.length > 1 && (
                  <div style={{ position: "absolute", bottom: -4, right: -4, background: "#12140F", border: "1px solid #2C3226", borderRadius: 999, fontSize: 9, fontWeight: 700, color: "#D9A441", padding: "1px 5px" }}>+{c.photos.length - 1}</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ fontWeight: 700, color: "#F2EFE6", fontSize: 14 }}>{c.species}</div>
                  {c.demo && <DemoTag />}
                </div>
                <div style={{ fontSize: 12, color: "#9CA394" }}>{fmtWeight(c.weight, units)} · {fmtLength(c.length, units)} · {c.location}</div>
                <div style={{ fontSize: 11, color: "#7A8270" }}>{fmtDateTime(c.time)}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={() => onEditCatch(c)} style={{ background: "none", border: "none", cursor: "pointer" }}><Settings size={14} color="#7A8270" /></button>
                <button onClick={() => onDeleteCatch(c)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color="#B5654A" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Discover ---------------- */

function Discover({ data, onOpenSpecies, onAddSpecies, onUpdateSpecies, onDeleteSpecies }) {
  const [section, setSection] = useState("home");
  const reports = data.spots.slice(0, 3).map((s) => ({ location: s.name, species: s.species[0] || "Mixed bag", condition: ["Clear", "Stained", "Murky"][Math.floor(Math.random() * 3)], bait: s.bait, activity: ["Slow", "Steady", "Hot bite"][Math.floor(Math.random() * 3)] }));
  const speciesList = combinedSpecies(data);

  if (section === "species") return <SpeciesDatabase data={data} onBack={() => setSection("home")} onAddSpecies={onAddSpecies} onUpdateSpecies={onUpdateSpecies} onDeleteSpecies={onDeleteSpecies} />;

  return (
    <div style={{ padding: "18px 16px 100px" }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: "#F2EFE6", marginBottom: 4 }}>Discover</div>
      <div style={{ fontSize: 13, color: "#9CA394", marginBottom: 16 }}>Community reports & fishing knowledge</div>

      <SectionHeader title="Fishing Reports" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {reports.length === 0 ? <Card><EmptyState icon={BookOpen} title="No reports yet" body="Save spots and log trips to start generating your own reports." /></Card> :
          reports.map((r, i) => (
            <Card key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, color: "#F2EFE6" }}>{r.location}</div>
                <Pill tone={r.activity === "Hot bite" ? "rust" : "default"}>{r.activity}</Pill>
              </div>
              <div style={{ fontSize: 12.5, color: "#9CA394", marginTop: 6, lineHeight: 1.6 }}>
                <div><b style={{ color: "#7A8270" }}>Species:</b> {r.species}</div>
                <div><b style={{ color: "#7A8270" }}>Water:</b> {r.condition}</div>
                <div><b style={{ color: "#7A8270" }}>Recommended bait:</b> {r.bait}</div>
              </div>
            </Card>
          ))}
      </div>

      <SectionHeader title="Species Guide" onSeeAll={() => setSection("species")} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {speciesList.slice(0, 3).map((s) => (
          <Card key={s.id} onClick={() => setSection("species")} style={{ padding: 12 }}>
            {s.photo ? <img src={s.photo} alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: "cover" }} /> : <Fish size={18} color="#6B8F5A" />}
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#F2EFE6" }}>{s.name}</div>
              {s.custom && <Pill tone="amber">Yours</Pill>}
            </div>
            <div style={{ fontSize: 11, color: "#7A8270" }}>{s.avgSize || "—"}</div>
          </Card>
        ))}
        <Card onClick={() => setSection("species")} style={{ padding: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, border: "1px dashed #3A4530" }}>
          <Plus size={18} color="#8FAE7E" />
          <div style={{ fontSize: 12, color: "#8FAE7E", fontWeight: 700 }}>Add Species</div>
        </Card>
      </div>

      <SectionHeader title="Tips & Seasonal" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Card><div style={{ fontWeight: 700, color: "#F2EFE6", marginBottom: 4 }}>🍂 Fall feeding window</div><div style={{ fontSize: 12.5, color: "#9CA394", lineHeight: 1.6 }}>As water cools, baitfish move shallow and predators follow — cover water fast with reaction baits before slowing down near cover.</div></Card>
        <Card><div style={{ fontWeight: 700, color: "#F2EFE6", marginBottom: 4 }}>🌡️ Reading pressure</div><div style={{ fontSize: 12.5, color: "#9CA394", lineHeight: 1.6 }}>Falling barometric pressure ahead of a front often triggers aggressive feeding — a good window to be on the water.</div></Card>
        <Card><div style={{ fontWeight: 700, color: "#F2EFE6", marginBottom: 4 }}>🌊 Fish the tide change</div><div style={{ fontSize: 12.5, color: "#9CA394", lineHeight: 1.6 }}>Next {TIDE_DEMO.next.toLowerCase()} tide is around {TIDE_DEMO.nextTime} — moving water right around the turn is usually when coastal species feed hardest. <span style={{ color: "#5C6353" }}>(placeholder — wire up a tide API for your coast)</span></div></Card>
      </div>
    </div>
  );
}

function SpeciesDatabase({ data, onBack, onAddSpecies, onUpdateSpecies, onDeleteSpecies }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null); // species being edited, or "new"
  const list = combinedSpecies(data);
  const filtered = list.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  if (editing) {
    return (
      <SpeciesFormScreen
        initial={editing === "new" ? null : editing}
        onCancel={() => setEditing(null)}
        onSave={(sp) => {
          if (editing === "new") { onAddSpecies(sp); setSelected(sp); }
          else { onUpdateSpecies(sp); setSelected(sp); }
          setEditing(null);
        }}
      />
    );
  }

  if (selected) {
    const isCustom = !!selected.custom;
    return (
      <div style={{ padding: "18px 16px 100px" }}>
        <button onClick={() => setSelected(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#8FAE7E", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}><ArrowLeft size={15} /> Back</button>
        <div style={{ width: "100%", aspectRatio: "16/9", background: selected.photo ? "none" : "linear-gradient(135deg,#26402C,#161A12)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, overflow: "hidden" }}>
          {selected.photo ? <img src={selected.photo} alt={selected.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Fish size={48} color="#6B8F5A" />}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 24, color: "#F2EFE6" }}>{selected.name}</div>
          {isCustom && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditing(selected)} style={{ background: "#242A1D", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Settings size={14} color="#9CA394" /></button>
              <button onClick={() => { onDeleteSpecies(selected.id); setSelected(null); }} style={{ background: "#242A1D", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={14} color="#B5654A" /></button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <Pill tone={selected.water === "saltwater" ? "blue" : "default"}>{selected.water}</Pill>
          {isCustom && <Pill tone="amber">Added by you</Pill>}
        </div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {[["Average size", selected.avgSize], ["Habitat", selected.habitat], ["Best seasons", selected.seasons], ["Best bait", selected.bait], ["Technique", selected.technique]].map(([label, val]) => (
            val ? <div key={label}><div style={{ fontSize: 11, color: "#7A8270", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div><div style={{ fontSize: 14, color: "#F2EFE6", marginTop: 2 }}>{val}</div></div> : null
          ))}
          {selected.fact && <Card style={{ background: "#20261A" }}><div style={{ fontSize: 12.5, color: "#BFE0C6", fontStyle: "italic" }}>💡 {selected.fact}</div></Card>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "18px 16px 100px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#8FAE7E", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}><ArrowLeft size={15} /> Back</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: "#F2EFE6" }}>Species Database</div>
        <button onClick={() => setEditing("new")} style={{ display: "flex", alignItems: "center", gap: 6, background: "#26402C", color: "#BFE0C6", border: "none", borderRadius: 10, padding: "8px 12px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
          <Plus size={15} /> Add Species
        </button>
      </div>
      <TextField placeholder="Search species…" value={query} onChange={setQuery} icon={Search} />
      {filtered.length === 0 ? (
        <EmptyState icon={Fish} title="No species found" body="Can't find what you're after? Add it yourself with your own notes and bait tips." actionLabel="Add Species" onAction={() => setEditing("new")} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((s) => (
            <Card key={s.id} onClick={() => setSelected(s)} style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {s.photo ? <img src={s.photo} alt="" style={{ width: 42, height: 42, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} /> :
                <div style={{ width: 42, height: 42, borderRadius: 10, background: "#26402C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Fish size={19} color="#BFE0C6" /></div>}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ fontWeight: 700, color: "#F2EFE6", fontSize: 14 }}>{s.name}</div>
                  {s.custom && <Pill tone="amber">Yours</Pill>}
                </div>
                <div style={{ fontSize: 12, color: "#9CA394" }}>{s.avgSize || "—"} · {s.water}</div>
              </div>
              <ChevronRight size={15} color="#5C6353" />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SpeciesFormScreen({ initial, onCancel, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [water, setWater] = useState(initial?.water || "freshwater");
  const [avgSize, setAvgSize] = useState(initial?.avgSize || "");
  const [habitat, setHabitat] = useState(initial?.habitat || "");
  const [seasons, setSeasons] = useState(initial?.seasons || "");
  const [bait, setBait] = useState(initial?.bait || "");
  const [technique, setTechnique] = useState(initial?.technique || "");
  const [fact, setFact] = useState(initial?.fact || "");
  const [photo, setPhoto] = useState(initial?.photo || null);
  const fileRef = useRef(null);

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    resizeImageToDataUrl(file, 600, setPhoto);
  }

  function save() {
    if (!name.trim()) return;
    onSave({
      id: initial?.id || uid(), name: name.trim(), water, avgSize, habitat, seasons, bait, technique, fact, photo, custom: true,
    });
  }

  return (
    <div style={{ padding: "18px 16px 100px" }}>
      <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#8FAE7E", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}><ArrowLeft size={15} /> Cancel</button>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: "#F2EFE6", marginBottom: 16 }}>{initial ? "Edit Species" : "Add Species"}</div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#9CA394", marginBottom: 6, fontWeight: 600 }}>Photo</div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
        {photo ? (
          <div style={{ position: "relative" }}>
            <img src={photo} alt="" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 12, display: "block" }} />
            <button onClick={() => setPhoto(null)} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: 999, width: 26, height: 26, cursor: "pointer" }}><X size={14} color="#fff" /></button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} style={{ width: "100%", border: "1px dashed #3A4530", background: "#161A12", borderRadius: 10, padding: "18px 0", color: "#8FAE7E", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <ImagePlus size={20} /> <span style={{ fontSize: 12.5 }}>Add a reference photo</span>
          </button>
        )}
      </div>

      <TextField label="Species name" value={name} onChange={setName} placeholder="e.g. Peacock Bass" icon={Fish} />
      <PickerField label="Water type" value={water} onChange={setWater} options={["freshwater", "saltwater"]} />
      <TextField label="Average size" value={avgSize} onChange={setAvgSize} placeholder="e.g. 2–6 lb" icon={Weight} />
      <TextField label="Habitat" value={habitat} onChange={setHabitat} placeholder="Where you typically find them" />
      <TextField label="Best seasons" value={seasons} onChange={setSeasons} placeholder="e.g. Spring & fall" icon={Sunrise} />
      <TextField label="Best bait" value={bait} onChange={setBait} placeholder="What's worked for you" icon={Anchor} />
      <TextField label="Technique" value={technique} onChange={setTechnique} placeholder="How you fish for them" multiline />
      <TextField label="Fun fact" value={fact} onChange={setFact} placeholder="Something interesting worth remembering" multiline />

      <BigButton icon={Check} label={initial ? "Save Changes" : "Add to Species Guide"} onClick={save} tone="green" />
    </div>
  );
}

/* ---------------- Gear ---------------- */

function GearScreen({ data, onAddGear, onDeleteGear, onBack }) {
  const [adding, setAdding] = useState(null);
  const categories = [["rod", "Rods", Anchor], ["reel", "Reels", Settings], ["lure", "Lures", Fish], ["bait", "Baits", Waves]];
  return (
    <div style={{ padding: "18px 16px 100px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#8FAE7E", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}><ArrowLeft size={15} /> Back</button>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: "#F2EFE6", marginBottom: 14 }}>Gear & Tackle</div>
      {categories.map(([key, label, Icon]) => {
        const items = data.gear.filter((g) => g.category === key);
        return (
          <div key={key} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, color: "#F2EFE6", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><Icon size={15} color="#6B8F5A" /> {label}</div>
              <button onClick={() => setAdding(key)} style={{ background: "#242A1D", border: "none", borderRadius: 8, width: 26, height: 26, color: "#BFE0C6", cursor: "pointer" }}><Plus size={14} /></button>
            </div>
            {items.length === 0 ? <div style={{ fontSize: 12, color: "#5C6353" }}>None added yet.</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((g) => (
                  <Card key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#F2EFE6" }}>{g.brand ? `${g.brand} ${g.model || g.name || ""}` : g.name}</div>
                      <div style={{ fontSize: 11.5, color: "#9CA394" }}>{[g.length, g.power, g.ratio, g.color, g.type, g.size].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {g.demo && <DemoTag />}
                      <button onClick={() => onDeleteGear(g.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color="#B5654A" /></button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {adding && <AddGearModal category={adding} onClose={() => setAdding(null)} onSave={(g) => { onAddGear(g); setAdding(null); }} />}
    </div>
  );
}

function AddGearModal({ category, onClose, onSave }) {
  const [fields, setFields] = useState({});
  const set = (k) => (v) => setFields((f) => ({ ...f, [k]: v }));
  const schemas = {
    rod: [["brand", "Brand"], ["model", "Model"], ["length", "Length"], ["power", "Power"], ["action", "Action"]],
    reel: [["brand", "Brand"], ["model", "Model"], ["ratio", "Gear ratio"]],
    lure: [["name", "Name"], ["brand", "Brand"], ["color", "Color"], ["type", "Type"], ["size", "Size"]],
    bait: [["type", "Type"], ["color", "Color"], ["size", "Size"]],
  };
  const labelMap = { rod: "Rod", reel: "Reel", lure: "Lure", bait: "Bait" };
  return (
    <Modal title={`Add ${labelMap[category]}`} onClose={onClose}>
      {schemas[category].map(([key, label]) => <TextField key={key} label={label} value={fields[key] || ""} onChange={set(key)} placeholder={label} />)}
      <BigButton icon={Check} label="Save Gear" onClick={() => onSave({ id: uid(), category, ...fields })} tone="green" />
    </Modal>
  );
}

/* ---------------- Profile ---------------- */

function Profile({ data, stats, onUpdateUser, onOpenGear, onSignOut }) {
  const [units, setUnits] = useState(data.user?.units || "imperial");
  const [notifications, setNotifications] = useState(data.user?.notifications ?? true);

  useEffect(() => { onUpdateUser({ ...data.user, units, notifications }); }, [units, notifications]);

  function exportJSON() {
    const payload = { exportedAt: new Date().toISOString(), trips: data.trips, catches: data.catches, spots: data.spots, gear: data.gear, customSpecies: data.customSpecies };
    downloadBlob(JSON.stringify(payload, null, 2), "application/json", "angr-backup.json");
  }
  function exportCSV() {
    const rows = [["Date", "Species", `Weight (${units === "metric" ? "kg" : "lb"})`, `Length (${units === "metric" ? "cm" : "in"})`, "Bait", "Location", "Water Condition", "Notes"]];
    data.catches.forEach((c) => rows.push([
      new Date(c.time).toISOString(), c.species,
      units === "metric" ? lbToKg(c.weight).toFixed(1) : c.weight,
      units === "metric" ? inToCm(c.length).toFixed(1) : c.length,
      c.bait, c.location, c.waterCondition, (c.notes || "").replace(/[\n,]/g, " "),
    ]));
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadBlob(csv, "text/csv", "angr-catches.csv");
  }

  return (
    <div style={{ padding: "18px 16px 100px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
        <div style={{ width: 76, height: 76, borderRadius: "50%", background: "linear-gradient(135deg,#26402C,#161A12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10, border: "2px solid #3A4530" }}>
          <UserIcon size={34} color="#BFE0C6" />
        </div>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 20, color: "#F2EFE6" }}>{data.user?.name}</div>
        <div style={{ fontSize: 12, color: "#9CA394" }}>{stats.favoriteSpecies ? `${stats.favoriteSpecies} angler` : "New angler"}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 20 }}>
        {[["Catches", stats.totalFish], ["Trips", stats.totalTrips], ["Best", stats.biggest ? fmtWeight(stats.biggest.weight, units) : "—"]].map(([label, value]) => (
          <div key={label} style={{ background: "#1E2318", border: "1px solid #2C3226", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 17, color: "#F2EFE6" }}>{value}</div>
            <div style={{ fontSize: 10, color: "#7A8270", marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      <SectionHeader title="Achievements" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {ACHIEVEMENTS.map((a) => {
          const unlocked = data.achievements.includes(a.id);
          return (
            <div key={a.id} title={a.desc} style={{ textAlign: "center", opacity: unlocked ? 1 : 0.4 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: unlocked ? "#26402C" : "#1B1F17", border: `1px solid ${unlocked ? "#4A7C59" : "#2C3226"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 6px" }}>
                {unlocked ? a.icon : <Lock size={16} color="#5C6353" />}
              </div>
              <div style={{ fontSize: 9.5, color: unlocked ? "#BFE0C6" : "#5C6353", lineHeight: 1.3 }}>{a.label}</div>
            </div>
          );
        })}
      </div>

      <SectionHeader title="Settings" />
      <Card style={{ marginBottom: 12 }}>
        <SettingRow label="Units" value={units === "imperial" ? "lb / in" : "kg / cm"} onClick={() => setUnits(units === "imperial" ? "metric" : "imperial")} />
        <SettingRow label="Notifications" value={notifications ? "On" : "Off"} onClick={() => setNotifications((n) => !n)} />
        <SettingRow label="Gear & Tackle" onClick={onOpenGear} icon={ChevronRight} />
        <SettingRow label="Privacy" value="Spots default to private" noAction />
        <SettingRow label="Location permissions" value="Not connected" noAction />
      </Card>

      <SectionHeader title="Your Data" />
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#9CA394", marginBottom: 12, lineHeight: 1.5 }}>Everything lives in this browser only — export a backup so it's never just one storage clear away from gone.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportJSON} style={{ flex: 1, background: "#242A1D", border: "1px solid #2C3226", color: "#F2EFE6", borderRadius: 10, padding: "10px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Export JSON</button>
          <button onClick={exportCSV} style={{ flex: 1, background: "#242A1D", border: "1px solid #2C3226", color: "#F2EFE6", borderRadius: 10, padding: "10px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Export Catches CSV</button>
        </div>
      </Card>

      <button onClick={onSignOut} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "none", border: "1px solid #3A2415", color: "#E3A576", borderRadius: 12, padding: "12px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
        <LogOut size={15} /> Sign Out
      </button>
      <div style={{ fontSize: 10.5, color: "#5C6353", textAlign: "center", marginTop: 10 }}>Signing out clears your local profile name; your logged data stays in this browser's storage.</div>
    </div>
  );
}

function SettingRow({ label, value, onClick, noAction, icon: Icon }) {
  return (
    <div onClick={onClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid #242A1D", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 13.5, color: "#F2EFE6", fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {value && <div style={{ fontSize: 12.5, color: "#9CA394" }}>{value}</div>}
        {Icon && !noAction && <Icon size={14} color="#5C6353" />}
      </div>
    </div>
  );
}

function downloadBlob(content, mime, filename) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function EditTripModal({ trip, spots, speciesList, onClose, onSave }) {
  const [name, setName] = useState(trip.name);
  const [location, setLocation] = useState(trip.location);
  const [target, setTarget] = useState(trip.species || "");
  const [notes, setNotes] = useState(trip.notes || "");
  return (
    <Modal title="Edit Trip" onClose={onClose}>
      <TextField label="Trip name" value={name} onChange={setName} icon={Anchor} />
      <PickerField label="Location" value={location} onChange={setLocation} options={[...spots.map((s) => s.name), "New location"]} scroll />
      <PickerField label="Target species" value={target} onChange={setTarget} options={speciesList.map((s) => s.name)} scroll />
      <TextField label="Notes" value={notes} onChange={setNotes} multiline />
      <BigButton icon={Check} label="Save Changes" onClick={() => onSave({ ...trip, name: name.trim() || trip.name, location, species: target, notes })} tone="green" />
    </Modal>
  );
}

/* ---------------- Bottom nav ---------------- */

function BottomNav({ tab, setTab }) {
  const items = [["home", HomeIcon, "Home"], ["map", MapIcon, "Map"], ["log", BookOpen, "Log"], ["discover", Compass, "Discover"], ["profile", UserIcon, "Profile"]];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(18,20,15,0.96)", backdropFilter: "blur(10px)", borderTop: "1px solid #2C3226", display: "flex", zIndex: 20 }}>
      {items.map(([key, Icon, label]) => (
        <button key={key} onClick={() => setTab(key)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 0 12px", background: "none", border: "none", cursor: "pointer" }}>
          <Icon size={20} color={tab === key ? "#D9A441" : "#7A8270"} fill={tab === key && key === "home" ? "none" : "none"} />
          <span style={{ fontSize: 10, fontWeight: 700, color: tab === key ? "#D9A441" : "#7A8270" }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------- Achievement toast ---------------- */

function AchievementToast({ achievement, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: "fixed", top: 16, left: 16, right: 16, zIndex: 60, display: "flex", justifyContent: "center" }}>
      <div style={{ background: "linear-gradient(135deg,#3A2E14,#26402C)", border: "1px solid #D9A441", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, maxWidth: 380, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize: 26 }}>{achievement.icon}</div>
        <div>
          <div style={{ fontSize: 11, color: "#E8C173", fontWeight: 700, letterSpacing: 0.5 }}>ACHIEVEMENT UNLOCKED</div>
          <div style={{ fontSize: 14, color: "#F2EFE6", fontWeight: 700 }}>{achievement.label}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Root App ---------------- */

export default function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(emptyData());
  const [tab, setTab] = useState("home");
  const [showTripSetup, setShowTripSetup] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [showLogCatch, setShowLogCatch] = useState(false);
  const [confirmCatch, setConfirmCatch] = useState(null);
  const [viewingTrip, setViewingTrip] = useState(null);
  const [showGear, setShowGear] = useState(false);
  const [toast, setToast] = useState(null);
  const [editingCatch, setEditingCatch] = useState(null);
  const [editingTrip, setEditingTrip] = useState(null);
  const initialized = useRef(false);

  useEffect(() => {
    (async () => {
      const saved = await loadData();
      if (saved) {
        setData(normalizeData(saved));
      } else {
        setData(normalizeData(demoSeed()));
      }
      setTimeout(() => setLoading(false), 700);
    })();
  }, []);

  useEffect(() => {
    if (!initialized.current) { initialized.current = true; return; }
    saveData(data);
  }, [data]);

  const stats = useMemo(() => computeStats(data), [data]);

  const checkAchievements = useCallback((nextData) => {
    const s = computeStats(nextData);
    const newly = ACHIEVEMENTS.filter((a) => !nextData.achievements.includes(a.id) && a.check(s));
    if (newly.length > 0) {
      const updated = { ...nextData, achievements: [...nextData.achievements, ...newly.map((a) => a.id)] };
      setToast(newly[0]);
      return updated;
    }
    return nextData;
  }, []);

  function handleOnboard(name) {
    setData((d) => ({ ...d, user: { name, units: "imperial", notifications: true } }));
  }

  function handleStartTrip(trip) {
    setActiveTrip(trip);
    setData((d) => ({ ...d, trips: [...d.trips, trip] }));
    setShowTripSetup(false);
    setTab("home");
  }

  function handleEndTrip() {
    if (!activeTrip) return;
    setData((d) => {
      const trips = d.trips.map((t) => t.id === activeTrip.id ? { ...t, endTime: Date.now() } : t);
      let spots = d.spots;
      if (activeTrip.spotId) spots = spots.map((s) => s.id === activeTrip.spotId ? { ...s, trips: s.trips + 1 } : s);
      const next = { ...d, trips, spots };
      return checkAchievements(next);
    });
    setActiveTrip(null);
  }

  function handleLogCatch(c) {
    const withTrip = { ...c, tripId: activeTrip?.id || null };
    setData((d) => {
      const next = { ...d, catches: [...d.catches, withTrip] };
      return checkAchievements(next);
    });
    setShowLogCatch(false);
    setConfirmCatch(withTrip);
  }

  function handleAddSpot(spot) {
    setData((d) => checkAchievements({ ...d, spots: [...d.spots, spot] }));
  }
  function handleDeleteSpot(id) {
    setData((d) => ({ ...d, spots: d.spots.filter((s) => s.id !== id) }));
  }
  function handleDeleteCatch(c) {
    if (!window.confirm(`Delete this ${c.species} catch? This can't be undone.`)) return;
    setData((d) => ({ ...d, catches: d.catches.filter((x) => x.id !== c.id) }));
  }
  function handleEditCatchSave(updated) {
    setData((d) => checkAchievements({ ...d, catches: d.catches.map((c) => (c.id === updated.id ? updated : c)) }));
    setEditingCatch(null);
  }
  function handleDeleteTrip(t) {
    if (!window.confirm(`Delete "${t.name}" and its logged catches? This can't be undone.`)) return;
    setData((d) => {
      const trips = d.trips.filter((x) => x.id !== t.id);
      const catches = d.catches.filter((c) => c.tripId !== t.id);
      let spots = d.spots;
      if (t.endTime && t.spotId) spots = spots.map((s) => (s.id === t.spotId ? { ...s, trips: Math.max(0, s.trips - 1) } : s));
      return { ...d, trips, catches, spots };
    });
  }
  function handleEditTripSave(updated) {
    setData((d) => ({ ...d, trips: d.trips.map((t) => (t.id === updated.id ? updated : t)) }));
    setEditingTrip(null);
  }
  function handleAddSpecies(sp) {
    setData((d) => ({ ...d, customSpecies: [...d.customSpecies, sp] }));
  }
  function handleUpdateSpecies(sp) {
    setData((d) => ({ ...d, customSpecies: d.customSpecies.map((s) => s.id === sp.id ? sp : s) }));
  }
  function handleDeleteSpecies(id) {
    setData((d) => ({ ...d, customSpecies: d.customSpecies.filter((s) => s.id !== id) }));
  }
  function handleAddGear(g) {
    setData((d) => ({ ...d, gear: [...d.gear, g] }));
  }
  function handleDeleteGear(id) {
    setData((d) => ({ ...d, gear: d.gear.filter((g) => g.id !== id) }));
  }
  function handleUpdateUser(u) {
    setData((d) => ({ ...d, user: u }));
  }
  function handleSignOut() {
    setData((d) => ({ ...d, user: null }));
  }

  const activeTripCatchCount = activeTrip ? data.catches.filter((c) => c.tripId === activeTrip.id).length : 0;
  const units = data.user?.units || "imperial";

  const fontImports = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');
      * { box-sizing: border-box; }
      @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      ::-webkit-scrollbar { width: 0; height: 0; }
    `}</style>
  );

  const shell = {
    width: "100%", maxWidth: 480, margin: "0 auto", minHeight: 640, background: "#12140F",
    fontFamily: "'Inter', sans-serif", color: "#F2EFE6", position: "relative", overflow: "hidden",
    borderRadius: 20, border: "1px solid #22271A",
  };

  if (loading) {
    return (
      <div style={shell}>
        {fontImports}
        <div style={{ height: 640, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.4s ease" }}>
          <svg width="64" height="64" viewBox="0 0 40 40" fill="none">
            <path d="M8 22c0-7 5-14 12-14 5 0 8 3 8 3" stroke="#C17A46" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M28 11c1.5 0 3 1 3 3s-2 3.5-2 5c0 2 1.5 3 1.5 3" stroke="#C17A46" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="30.5" cy="12.5" r="1.8" fill="#C17A46" />
          </svg>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, letterSpacing: 1.5, marginTop: 12 }}>ANGR</div>
        </div>
      </div>
    );
  }

  if (!data.user) {
    return <div style={shell}>{fontImports}<Onboarding onDone={handleOnboard} /></div>;
  }

  return (
    <div style={shell}>
      {fontImports}
      <div style={{ minHeight: 640, position: "relative" }}>
        {tab === "home" && <Home data={data} stats={stats} units={units} onStartFishing={() => setShowTripSetup(true)} onOpenTrip={setViewingTrip} onGoMap={() => setTab("map")} onGoTab={setTab} />}
        {tab === "map" && <MapScreen data={data} onAddSpot={handleAddSpot} onDeleteSpot={handleDeleteSpot} />}
        {tab === "log" && <Journal data={data} stats={stats} units={units} onStartFishing={() => setShowTripSetup(true)} onDeleteCatch={handleDeleteCatch} onEditCatch={setEditingCatch} onDeleteTrip={handleDeleteTrip} onEditTrip={setEditingTrip} />}
        {tab === "discover" && !showGear && <Discover data={data} onOpenSpecies={() => {}} onAddSpecies={handleAddSpecies} onUpdateSpecies={handleUpdateSpecies} onDeleteSpecies={handleDeleteSpecies} />}
        {tab === "profile" && !showGear && <Profile data={data} stats={stats} onUpdateUser={handleUpdateUser} onOpenGear={() => setShowGear(true)} onSignOut={handleSignOut} />}
        {showGear && <GearScreen data={data} onAddGear={handleAddGear} onDeleteGear={handleDeleteGear} onBack={() => setShowGear(false)} />}

        {activeTrip && !showLogCatch && !confirmCatch && (
          <ActiveTripBar trip={activeTrip} catchCount={activeTripCatchCount} onLogCatch={() => setShowLogCatch(true)} onEnd={handleEndTrip} />
        )}

        <BottomNav tab={tab} setTab={(t) => { setShowGear(false); setTab(t); }} />
      </div>

      {showTripSetup && <TripSetupModal spots={data.spots} speciesList={combinedSpecies(data)} onClose={() => setShowTripSetup(false)} onStart={handleStartTrip} />}
      {showLogCatch && <LogCatchModal gear={data.gear} speciesList={combinedSpecies(data)} units={units} onClose={() => setShowLogCatch(false)} onSave={handleLogCatch} />}
      {confirmCatch && <CatchConfirmation c={confirmCatch} units={units} onClose={() => setConfirmCatch(null)} />}
      {editingCatch && <LogCatchModal gear={data.gear} speciesList={combinedSpecies(data)} units={units} initial={editingCatch} onClose={() => setEditingCatch(null)} onSave={handleEditCatchSave} />}
      {editingTrip && <EditTripModal trip={editingTrip} spots={data.spots} speciesList={combinedSpecies(data)} onClose={() => setEditingTrip(null)} onSave={handleEditTripSave} />}
      {viewingTrip && (
        <Modal title={viewingTrip.name} onClose={() => setViewingTrip(null)}>
          <div style={{ fontSize: 13, color: "#9CA394", marginBottom: 10 }}>{viewingTrip.location} · {fmtDate(viewingTrip.startTime)}</div>
          <div style={{ fontSize: 13, color: "#F2EFE6", marginBottom: 6 }}>Target: {viewingTrip.species || "—"}</div>
          <div style={{ fontSize: 13, color: "#F2EFE6", marginBottom: 6 }}>Weather: {viewingTrip.weather}</div>
          {viewingTrip.notes && <div style={{ fontSize: 13, color: "#F2EFE6", marginBottom: 10 }}>Notes: {viewingTrip.notes}</div>}
          <SectionHeader title="Catches" />
          {data.catches.filter((c) => c.tripId === viewingTrip.id).map((c) => (
            <div key={c.id} style={{ fontSize: 12.5, color: "#C7CCBB", padding: "6px 0", borderBottom: "1px solid #242A1D" }}>{c.species} — {fmtWeight(c.weight, units)} / {fmtLength(c.length, units)}</div>
          ))}
        </Modal>
      )}
      {toast && <AchievementToast achievement={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
