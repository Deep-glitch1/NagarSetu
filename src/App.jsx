import React, { useState } from "react";
import {
  Camera, ClipboardList, Map as MapIcon, CalendarClock, Truck, Droplets,
  Vote, Landmark, MapPin, CheckCircle2, Clock, AlertTriangle, ChevronRight,
  Star, Bell, Upload, Sparkles, Building2, Flame, Home as HomeIcon, Menu, X
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";


const C = {
  navy: "#122A3E",
  navyDeep: "#0B1B29",
  paper: "#F4F5F3",
  card: "#FFFFFF",
  ink: "#1C2B36",
  inkSoft: "#5B6B76",
  line: "#DEE3E3",
  marigold: "#D98324",
  marigoldDeep: "#B76A16",
  red: "#B3341F",
  teal: "#186E64",
  tealSoft: "#E4F2EF",
  redSoft: "#FBEAE6",
  marigoldSoft: "#FBEEDD",
};

const display = { fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, monospace" };

const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
    * { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
    .stamp { transform: rotate(-8deg); }
    .ticket-stub {
      background-image: radial-gradient(circle, ${C.paper} 3px, transparent 3px);
      background-size: 10px 10px;
      background-position: left center;
    }
  `}</style>
);

/* ---------------------------------------------------------
   Mock data
--------------------------------------------------------- */
const NAV = [
  { group: "REPORT & TRACK", items: [
    { id: "report", label: "Report an Issue", icon: Camera },
    { id: "mine", label: "My Complaints", icon: ClipboardList },
  ]},
  { group: "CITY INSIGHTS", items: [
    { id: "heatmap", label: "Hotspot Map", icon: MapIcon },
  ]},
  { group: "CIVIC SERVICES", items: [
    { id: "booking", label: "Book a Facility", icon: CalendarClock },
    { id: "truck", label: "Track Collection Truck", icon: Truck },
    { id: "toilets", label: "Rate a Toilet", icon: Droplets },
    { id: "budget", label: "Budget & Voting", icon: Vote },
  ]},
];

const CATEGORIES = ["Pothole", "Garbage", "Broken Streetlight", "Water Leakage", "Damaged Road"];

const STAGES = ["Received", "Assigned", "Work Started", "Pending Verification", "Verified"];

const INITIAL_COMPLAINTS = [
  { id: "NS-2026-004821", category: "Pothole", ward: "Ward 6", stage: 4, status: "verified", date: "12 Aug" },
  { id: "NS-2026-004798", category: "Broken Streetlight", ward: "Ward 6", stage: 2, status: "active", date: "14 Aug" },
  { id: "NS-2026-004715", category: "Garbage", ward: "Ward 4", stage: 1, status: "escalated", date: "07 Aug" },
];

const TOILETS = [
  { id: 1, name: "Community Toilet, Ward 6 Market", rating: 4.3, votes: 58, flagged: false },
  { id: 2, name: "Public Toilet, Bus Stand Road", rating: 2.1, votes: 34, flagged: true },
  { id: 3, name: "Sulabh Complex, Station Road", rating: 3.9, votes: 71, flagged: false },
];

const BUDGET_DATA = [
  { ward: "Ward 3", recommended: 18.2, approved: 16.5 },
  { ward: "Ward 4", recommended: 24.6, approved: 24.0 },
  { ward: "Ward 6", recommended: 31.4, approved: 27.8 },
  { ward: "Ward 9", recommended: 12.9, approved: 12.9 },
];

const VOTE_CATEGORIES = [
  { id: "road", label: "Road Repair", base: 412 },
  { id: "garbage", label: "Waste Collection", base: 298 },
  { id: "light", label: "Streetlighting", base: 176 },
  { id: "water", label: "Water Supply", base: 355 },
];

/* ---------------------------------------------------------
   Small UI atoms
--------------------------------------------------------- */
function Pill({ children, tone = "navy" }) {
  const tones = {
    navy: { bg: "#EEF1F3", color: C.navy },
    teal: { bg: C.tealSoft, color: C.teal },
    red: { bg: C.redSoft, color: C.red },
    marigold: { bg: C.marigoldSoft, color: C.marigoldDeep },
  };
  const t = tones[tone];
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: t.bg, color: t.color, ...mono, letterSpacing: "0.02em" }}
    >
      {children}
    </span>
  );
}

function SectionHeading({ eyebrow, title, sub }) {
  return (
    <div className="mb-6">
      <div className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: C.marigoldDeep, ...mono }}>
        {eyebrow}
      </div>
      <h1 className="text-2xl md:text-[28px] font-semibold" style={{ ...display, color: C.navy }}>{title}</h1>
      {sub && <p className="text-sm mt-1.5 max-w-xl" style={{ color: C.inkSoft }}>{sub}</p>}
    </div>
  );
}

function Card({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-xl border p-5 ${className}`}
      style={{ background: C.card, borderColor: C.line, boxShadow: "0 1px 2px rgba(18,42,62,0.04)", ...style }}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------
   Screens
--------------------------------------------------------- */
function ReportScreen({ onSubmit }) {
  const [step, setStep] = useState("idle"); // idle -> analyzing -> detected -> submitted
  const [detected, setDetected] = useState(null);

  const simulate = () => {
    setStep("analyzing");
    setTimeout(() => {
      setDetected({ category: "Pothole", confidence: 94 });
      setStep("detected");
    }, 900);
  };

  const submit = () => {
    onSubmit(detected.category);
    setStep("submitted");
  };

  return (
    <div>
      <SectionHeading
        eyebrow="Module 1 · Image Classifier"
        title="Report an Issue"
        sub="Take a photo. NagarSetu identifies the category and location automatically — no form to fill."
      />
      <Card className="max-w-xl">
        {step !== "submitted" ? (
          <>
            <div
              className="rounded-lg border-2 border-dashed flex flex-col items-center justify-center py-14 mb-4 cursor-pointer transition-colors"
              style={{ borderColor: step === "idle" ? C.line : C.marigold, background: step === "idle" ? C.paper : C.marigoldSoft }}
              onClick={step === "idle" ? simulate : undefined}
            >
              {step === "idle" && (
                <>
                  <Upload size={30} style={{ color: C.inkSoft }} />
                  <p className="mt-3 text-sm font-medium" style={{ color: C.ink }}>Tap to capture or upload a photo</p>
                  <p className="text-xs mt-1" style={{ color: C.inkSoft }}>(demo — click to simulate)</p>
                </>
              )}
              {step === "analyzing" && (
                <>
                  <Sparkles size={30} className="animate-pulse" style={{ color: C.marigoldDeep }} />
                  <p className="mt-3 text-sm font-medium" style={{ color: C.marigoldDeep }}>Classifying photo…</p>
                </>
              )}
              {step === "detected" && detected && (
                <>
                  <CheckCircle2 size={30} style={{ color: C.teal }} />
                  <p className="mt-3 text-sm font-semibold" style={{ color: C.ink }}>{detected.category} detected</p>
                  <p className="text-xs mt-1" style={{ color: C.inkSoft, ...mono }}>{detected.confidence}% confidence</p>
                </>
              )}
            </div>

            {step === "detected" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm" style={{ color: C.ink }}>
                  <MapPin size={15} style={{ color: C.red }} />
                  GPS locked — MG Road, Ward 6
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: C.ink }}>
                  <Building2 size={15} style={{ color: C.navy }} />
                  Auto-routed to: <span className="font-semibold">Public Works Department</span>
                </div>
                <button
                  onClick={submit}
                  className="w-full mt-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: C.marigoldDeep }}
                >
                  Submit Complaint
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <CheckCircle2 size={36} style={{ color: C.teal }} className="mx-auto mb-3" />
            <p className="font-semibold" style={{ color: C.ink }}>Complaint filed.</p>
            <p className="text-sm mt-1" style={{ color: C.inkSoft }}>Ticket NS-2026-004902 added to My Complaints.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function StageTrack({ stage, status }) {
  const color = status === "escalated" ? C.red : status === "verified" ? C.teal : C.marigoldDeep;
  return (
    <div className="flex items-center gap-1 mt-3">
      {STAGES.map((s, i) => (
        <React.Fragment key={s}>
          <div className="flex flex-col items-center flex-1">
            <div
              className="w-full h-1.5 rounded-full"
              style={{ background: i <= stage ? color : C.line }}
            />
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function ComplaintTicket({ c }) {
  const statusMap = {
    verified: { label: "VERIFIED", tone: "teal" },
    active: { label: "IN PROGRESS", tone: "marigold" },
    escalated: { label: "ESCALATED", tone: "red" },
  };
  const s = statusMap[c.status];
  return (
    <div className="rounded-xl border flex overflow-hidden" style={{ borderColor: C.line, background: C.card }}>
      <div className="w-3 ticket-stub" style={{ borderRight: `1px dashed ${C.line}` }} />
      <div className="flex-1 p-4 relative">
        {c.status === "verified" && (
          <div
            className="stamp absolute top-3 right-4 border-2 rounded px-2 py-0.5 text-[10px] font-bold"
            style={{ borderColor: C.teal, color: C.teal, ...mono }}
          >
            ✓ VERIFIED
          </div>
        )}
        <div className="flex items-center justify-between pr-2">
          <span className="text-xs font-semibold" style={{ color: C.inkSoft, ...mono }}>{c.id}</span>
          <Pill tone={s.tone}>{s.label}</Pill>
        </div>
        <p className="font-semibold mt-1.5" style={{ color: C.navy, ...display }}>{c.category}</p>
        <p className="text-xs mt-0.5" style={{ color: C.inkSoft }}>{c.ward} · filed {c.date}</p>
        <StageTrack stage={c.stage} status={c.status} />
        <div className="flex justify-between text-[11px] mt-1.5" style={{ color: C.inkSoft }}>
          <span>Received</span><span>Verified</span>
        </div>
        {c.status === "escalated" && (
          <div className="flex items-center gap-1.5 mt-2 text-xs font-medium" style={{ color: C.red }}>
            <AlertTriangle size={13} /> SLA breached — escalated to Ward Supervisor
          </div>
        )}
      </div>
    </div>
  );
}

function MyComplaintsScreen({ complaints }) {
  return (
    <div>
      <SectionHeading
        eyebrow="Modules 5 & 6 · Verification + Escalation"
        title="My Complaints"
        sub="Every ticket is stamped only after an independent AI check — not on an officer's word alone."
      />
      <div className="space-y-3 max-w-xl">
        {complaints.map((c) => <ComplaintTicket key={c.id} c={c} />)}
      </div>
    </div>
  );
}

function HeatmapScreen() {
  const dots = [
    { x: 30, y: 40, r: 14, cat: "Pothole" }, { x: 55, y: 30, r: 8, cat: "Garbage" },
    { x: 70, y: 55, r: 18, cat: "Pothole" }, { x: 40, y: 65, r: 6, cat: "Streetlight" },
    { x: 60, y: 75, r: 10, cat: "Water" }, { x: 80, y: 25, r: 7, cat: "Garbage" },
    { x: 20, y: 70, r: 9, cat: "Pothole" },
  ];
  return (
    <div>
      <SectionHeading
        eyebrow="Module 8 · Hotspot Clustering"
        title="City Hotspot Map"
        sub="DBSCAN clusters recurring complaints so departments can plan proactive repair, not just react."
      />
      <Card className="max-w-2xl">
        <svg viewBox="0 0 100 90" className="w-full h-72 rounded-lg" style={{ background: C.navy }}>
          {[...Array(6)].map((_, i) => (
            <line key={i} x1={0} y1={i * 15} x2={100} y2={i * 15} stroke="#25445E" strokeWidth="0.3" />
          ))}
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r / 2.2} fill={C.marigold} fillOpacity="0.55" stroke={C.marigold} strokeWidth="0.4" />
          ))}
        </svg>
        <div className="flex items-center gap-4 mt-4 text-xs" style={{ color: C.inkSoft }}>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: C.marigold, opacity: 0.9 }} /> Larger = denser complaint cluster</span>
        </div>
      </Card>
    </div>
  );
}

function BookingScreen() {
  const [selected, setSelected] = useState("hall");
  const facilities = {
    hall: { name: "Community Hall — Ward 4", icon: HomeIcon, note: "Pending admin approval", tone: "marigold", desc: "Best for weddings, functions, events." },
    cremation: { name: "Cremation Ground — Ward 4", icon: Flame, note: "Instant confirmation — no approval needed", tone: "teal", desc: "Capacity check only. Death is not schedulable." },
    sanatorium: { name: "Sanatorium — Ward 7", icon: Building2, note: "Pending admin approval", tone: "marigold", desc: "Rest-house slots for visiting families." },
  };
  const f = facilities[selected];
  return (
    <div>
      <SectionHeading
        eyebrow="Module 13 · Facility Booking"
        title="Book a Facility"
        sub="Every facility type gets an approval path matched to how urgent it actually is."
      />
      <div className="flex gap-2 mb-4 flex-wrap">
        {Object.entries(facilities).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setSelected(k)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors"
            style={{
              borderColor: selected === k ? C.navy : C.line,
              background: selected === k ? C.navy : C.card,
              color: selected === k ? "white" : C.ink,
            }}
          >
            <v.icon size={15} /> {v.name.split(" — ")[0]}
          </button>
        ))}
      </div>
      <Card className="max-w-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold" style={{ color: C.navy, ...display }}>{f.name}</p>
            <p className="text-sm mt-1" style={{ color: C.inkSoft }}>{f.desc}</p>
          </div>
          <f.icon size={26} style={{ color: C.marigoldDeep }} />
        </div>
        <Pill tone={f.tone}>{f.note}</Pill>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-lg border px-3 py-2" style={{ borderColor: C.line }}>
            <p className="text-[11px]" style={{ color: C.inkSoft }}>Date</p>
            <p className="text-sm font-medium" style={{ color: C.ink }}>28 Aug 2026</p>
          </div>
          <div className="rounded-lg border px-3 py-2" style={{ borderColor: C.line }}>
            <p className="text-[11px]" style={{ color: C.inkSoft }}>Slot</p>
            <p className="text-sm font-medium" style={{ color: C.ink }}>10:00 AM – 1:00 PM</p>
          </div>
        </div>
        <button
          className="w-full mt-4 rounded-lg py-2.5 text-sm font-semibold text-white hover:opacity-90"
          style={{ background: C.marigoldDeep }}
        >
          {selected === "cremation" ? "Confirm Booking Instantly" : "Request Booking"}
        </button>
      </Card>
    </div>
  );
}

function TruckScreen() {
  const [notify, setNotify] = useState(true);
  return (
    <div>
      <SectionHeading
        eyebrow="Module 14 · Vehicle Tracking & Geofencing"
        title="Track Collection Truck"
        sub="GPS logs are kept permanently — so a missed-collection complaint can be checked against the real route."
      />
      <Card className="max-w-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: C.marigoldSoft }}>
              <Truck size={20} style={{ color: C.marigoldDeep }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: C.navy, ...display }}>Vehicle AB-12-3456</p>
              <p className="text-xs" style={{ color: C.inkSoft }}>Ward 6 · Morning Route</p>
            </div>
          </div>
          <Pill tone="marigold">ETA ~8 MIN</Pill>
        </div>

        <div className="mt-5">
          <div className="w-full h-2 rounded-full" style={{ background: C.line }}>
            <div className="h-2 rounded-full" style={{ width: "64%", background: C.marigoldDeep }} />
          </div>
          <div className="flex justify-between text-[11px] mt-1.5" style={{ color: C.inkSoft }}>
            <span>Depot</span><span>Your Street</span><span>Route End</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t" style={{ borderColor: C.line }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: C.ink }}>
            <Bell size={15} style={{ color: C.navy }} /> Notify me on arrival
          </div>
          <button
            onClick={() => setNotify(!notify)}
            className="w-11 h-6 rounded-full relative transition-colors"
            style={{ background: notify ? C.teal : C.line }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
              style={{ left: notify ? "22px" : "2px" }}
            />
          </button>
        </div>
      </Card>
    </div>
  );
}

function StarRow({ value }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} fill={i <= Math.round(value) ? C.marigold : "none"} stroke={C.marigold} />
      ))}
    </div>
  );
}

function ToiletsScreen() {
  return (
    <div>
      <SectionHeading
        eyebrow="Module 15 · Toilet Rating & Auto-Inspection"
        title="Rate a Toilet"
        sub="Cleanliness score decays over time (EWMA) — a low rolling average auto-opens an inspection ticket."
      />
      <div className="space-y-3 max-w-xl">
        {TOILETS.map((t) => (
          <Card key={t.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold" style={{ color: C.navy, ...display }}>{t.name}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <StarRow value={t.rating} />
                  <span className="text-xs" style={{ color: C.inkSoft }}>{t.rating.toFixed(1)} · {t.votes} ratings</span>
                </div>
              </div>
              {t.flagged && (
                <Pill tone="red"><AlertTriangle size={11} /> Auto-inspection triggered</Pill>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function BudgetScreen() {
  const [votes, setVotes] = useState(Object.fromEntries(VOTE_CATEGORIES.map((c) => [c.id, c.base])));
  const [voted, setVoted] = useState(null);
  const total = Object.values(votes).reduce((a, b) => a + b, 0);

  const cast = (id) => {
    if (voted) return;
    setVotes((v) => ({ ...v, [id]: v[id] + 1 }));
    setVoted(id);
  };

  return (
    <div>
      <SectionHeading
        eyebrow="Modules 12 & 16 · Budget Allocation + Participatory Budgeting"
        title="Budget & Voting"
        sub="Your vote is weighted by your Trust Score, then feeds — as advisory input — into Council's budget review."
      />

      <Card className="max-w-2xl mb-5">
        <p className="text-sm font-semibold mb-3" style={{ color: C.ink }}>Recommended vs. Approved Budget (₹ Lakh)</p>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={BUDGET_DATA} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="ward" tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={{ stroke: C.line }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, borderColor: C.line, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="recommended" name="Recommended" fill={C.marigold} radius={[4, 4, 0, 0]} />
              <Bar dataKey="approved" name="Approved" fill={C.navy} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold" style={{ color: C.ink }}>What matters most in Ward 6 this cycle?</p>
          <Pill tone="teal">Vote weight 1.4× (Trust: High)</Pill>
        </div>
        <p className="text-xs mb-4" style={{ color: C.inkSoft }}>Advisory input only — Council approves the final allocation.</p>
        <div className="space-y-2.5">
          {VOTE_CATEGORIES.map((c) => {
            const pct = Math.round((votes[c.id] / total) * 100);
            return (
              <div key={c.id} onClick={() => cast(c.id)} className="cursor-pointer group">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium flex items-center gap-1.5" style={{ color: C.ink }}>
                    {voted === c.id && <CheckCircle2 size={13} style={{ color: C.teal }} />}
                    {c.label}
                  </span>
                  <span style={{ color: C.inkSoft, ...mono }}>{pct}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full" style={{ background: C.line }}>
                  <div
                    className="h-2.5 rounded-full transition-all"
                    style={{ width: `${pct}%`, background: voted === c.id ? C.teal : C.marigold }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {voted && <p className="text-xs mt-3" style={{ color: C.teal }}>Vote recorded — thank you.</p>}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------
   Shell
--------------------------------------------------------- */
export default function NagarSetuDemo() {
  const [tab, setTab] = useState("report");
  const [mobileNav, setMobileNav] = useState(false);
  const [complaints, setComplaints] = useState(INITIAL_COMPLAINTS);

  const addComplaint = (category) => {
    setComplaints((cs) => [
      { id: "NS-2026-004902", category, ward: "Ward 6", stage: 0, status: "active", date: "Today" },
      ...cs,
    ]);
  };

  const screens = {
    report: <ReportScreen onSubmit={addComplaint} />,
    mine: <MyComplaintsScreen complaints={complaints} />,
    heatmap: <HeatmapScreen />,
    booking: <BookingScreen />,
    truck: <TruckScreen />,
    toilets: <ToiletsScreen />,
    budget: <BudgetScreen />,
  };

  const NavList = ({ onClick }) => (
    <>
      {NAV.map((g) => (
        <div key={g.group} className="mb-5">
          <p className="text-[10px] font-bold tracking-widest uppercase px-3 mb-2" style={{ color: "#7C93A5", ...mono }}>
            {g.group}
          </p>
          {g.items.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setTab(item.id); onClick && onClick(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors"
                style={{
                  background: active ? "rgba(217,131,36,0.16)" : "transparent",
                  color: active ? C.marigold : "#C7D3DB",
                }}
              >
                <Icon size={16} />
                {item.label}
                {active && <ChevronRight size={14} className="ml-auto" />}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );

  return (
    <div className="min-h-screen w-full flex" style={{ background: C.paper }}>
      <FontLoader />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 px-3 py-5" style={{ background: C.navyDeep }}>
        <div className="flex items-center gap-2 px-3 mb-7">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.marigold }}>
            <Landmark size={17} color={C.navyDeep} />
          </div>
          <span className="font-semibold text-white text-lg" style={display}>NagarSetu</span>
        </div>
        <NavList />
        <div className="mt-auto px-3 pt-4 border-t" style={{ borderColor: "#22384A" }}>
          <p className="text-xs text-white font-medium">Priya Sharma</p>
          <p className="text-[11px]" style={{ color: "#7C93A5" }}>Ward 6 · Trust Score: High</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3" style={{ background: C.navyDeep }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.marigold }}>
            <Landmark size={15} color={C.navyDeep} />
          </div>
          <span className="font-semibold text-white" style={display}>NagarSetu</span>
        </div>
        <button onClick={() => setMobileNav(!mobileNav)}>
          {mobileNav ? <X color="white" size={22} /> : <Menu color="white" size={22} />}
        </button>
      </div>
      {mobileNav && (
        <div className="md:hidden fixed top-14 left-0 right-0 bottom-0 z-10 px-3 py-4 overflow-y-auto" style={{ background: C.navyDeep }}>
          <NavList onClick={() => setMobileNav(false)} />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 px-5 py-6 md:px-10 md:py-8 mt-14 md:mt-0 max-w-4xl">
        {screens[tab]}
      </main>
    </div>
  );
}