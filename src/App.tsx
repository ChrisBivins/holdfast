import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth, db, firebaseReady, storage } from "./firebase";
import { SEED_TERRITORIES } from "./seed";
import type { Battle, RosterUnit, Territory } from "./types";
import "./App.css";

function generateCampaignId() {
  return "c" + Math.random().toString(36).slice(2, 8);
}

type Army = {
  id: string;
  name: string;
};

export default function App() {
  const ready = firebaseReady();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [status, setStatus] = useState(ready ? "Connecting…" : "Firebase keys missing");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [joinId, setJoinId] = useState("");
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [armies, setArmies] = useState<Army[]>([]);
  const [selectedArmyId, setSelectedArmyId] = useState<string | null>(null);
  const [units, setUnits] = useState<RosterUnit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [note, setNote] = useState("");
  const [color, setColor] = useState("#5a5a5a");
  const [bannerUrl, setBannerUrl] = useState("");
  const [campaignName, setCampaignName] = useState("Shrine World");
  const [campaignSetup, setCampaignSetup] = useState("Pale Seraphim vs Word Bearers");

  const selected = useMemo(
    () => territories.find((t) => t.id === selectedId) ?? null,
    [territories, selectedId],
  );

  const selectedArmy = useMemo(
    () => armies.find((a) => a.id === selectedArmyId) ?? null,
    [armies, selectedArmyId],
  );

  const campaignRef = () => doc(db!, "campaigns", campaignId!);
  const territoriesCol = () => collection(db!, "campaigns", campaignId!, "territories");
  const battlesCol = () => collection(db!, "campaigns", campaignId!, "battles");
  const armiesCol = () => collection(db!, "campaigns", campaignId!, "armies");
  const unitsCol = () => collection(db!, "campaigns", campaignId!, "units");

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!ready || !db || !user || !campaignId) return;

    let unsubTiles = () => {};
    let unsubBattles = () => {};
    let unsubArmies = () => {};
    let unsubUnits = () => {};
    let unsubCampaign = () => {};

    async function boot() {
      const existing = await getDocs(territoriesCol());
      if (existing.empty) {
        await setDoc(campaignRef(), {
          name: "Shrine World",
          setup: "Pale Seraphim vs Word Bearers",
          createdBy: user!.uid,
        });
        await Promise.all(
          SEED_TERRITORIES.map((tile, index) =>
            setDoc(doc(territoriesCol(), `t${index + 1}`), tile),
          ),
        );
      }

      unsubCampaign = onSnapshot(campaignRef(), (snap) => {
        const data = snap.data();
        if (data?.bannerUrl) setBannerUrl(data.bannerUrl);
        if (data?.name) setCampaignName(data.name);
        if (data?.setup) setCampaignSetup(data.setup);
      });

      unsubTiles = onSnapshot(territoriesCol(), (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Territory, "id">) }));
        rows.sort((a, b) => a.row - b.row || a.col - b.col);
        setTerritories(rows);
        setStatus("Live on Firestore");
      });
      unsubBattles = onSnapshot(battlesCol(), (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Battle, "id">) }));
        rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setBattles(rows);
      });
      unsubArmies = onSnapshot(armiesCol(), (snap) => {
        setArmies(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Army, "id">) })));
      });
      unsubUnits = onSnapshot(unitsCol(), (snap) => {
        setUnits(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RosterUnit, "id">) })));
      });
    }

    boot().catch((err) => setStatus(String(err.message || err)));
    return () => {
      unsubTiles();
      unsubBattles();
      unsubArmies();
      unsubUnits();
      unsubCampaign();
    };
  }, [ready, user, campaignId]);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setOwner(selected.owner);
    setNote(selected.note);
    setColor(selected.color || "#5a5a5a");
  }, [selected]);

  async function handleEmailSignIn(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;
    setAuthError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setAuthError(err.message || "Sign in failed");
    }
  }

  async function handleCreateAccount(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;
    setAuthError("");
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setAuthError(err.message || "Could not create account");
    }
  }

  async function handleGoogle() {
    if (!auth) return;
    setAuthError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: any) {
      setAuthError(err.message || "Google sign in failed");
    }
  }

  async function handleSignOut() {
    if (!auth) return;
    await signOut(auth);
    setCampaignId(null);
  }

  function handleCreateCampaign() {
    const id = generateCampaignId();
    setCampaignId(id);
  }

  function handleJoinCampaign(event: FormEvent) {
    event.preventDefault();
    const id = joinId.trim();
    if (id) setCampaignId(id);
  }

  async function saveTile() {
    if (!db || !selected || !campaignId) return;
    setStatus("Saving tile…");
    await updateDoc(doc(territoriesCol(), selected.id), { name, owner, note, color });
    setStatus("Tile saved");
  }

  async function saveCampaign() {
    if (!db || !campaignId) return;
    setStatus("Saving campaign…");
    await setDoc(campaignRef(), { name: campaignName, setup: campaignSetup }, { merge: true });
    setStatus("Campaign updated");
  }

  async function addBattle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !campaignId) return;
    const form = new FormData(event.currentTarget);
    setStatus("Saving battle…");
    await addDoc(battlesCol(), {
      date: String(form.get("date") || ""),
      attacker: String(form.get("attacker") || ""),
      defender: String(form.get("defender") || ""),
      winner: String(form.get("winner") || ""),
      mission: String(form.get("mission") || ""),
      notes: String(form.get("notes") || ""),
      createdAt: Date.now(),
      stamped: serverTimestamp(),
    });
    event.currentTarget.reset();
    setStatus("Battle logged");
  }

  async function addArmy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !campaignId) return;
    const form = new FormData(event.currentTarget);
    const armyName = String(form.get("armyName") || "").trim();
    if (!armyName) return;
    setStatus("Adding army…");
    await addDoc(armiesCol(), { name: armyName });
    event.currentTarget.reset();
    setStatus("Army added");
  }

  async function addUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !campaignId || !selectedArmyId) return;
    const form = new FormData(event.currentTarget);
    setStatus("Saving unit…");
    await addDoc(unitsCol(), {
      name: String(form.get("name") || ""),
      xp: Number(form.get("xp") || 0),
      scars: String(form.get("scars") || ""),
      notes: String(form.get("notes") || ""),
      armyId: selectedArmyId,
    });
    event.currentTarget.reset();
    setStatus("Unit added");
  }

  async function removeUnit(id: string) {
    if (!db || !campaignId) return;
    await deleteDoc(doc(unitsCol(), id));
    setStatus("Unit removed");
  }

  async function removeBattle(id: string) {
    if (!db || !campaignId) return;
    await deleteDoc(doc(battlesCol(), id));
    setStatus("Battle removed");
  }

  async function uploadBanner(file: File) {
    if (!storage || !db || !campaignId) return;
    setStatus("Uploading map image…");
    const fileRef = ref(storage, `campaigns/${campaignId}/${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    await setDoc(campaignRef(), { bannerUrl: url }, { merge: true });
    setBannerUrl(url);
    setStatus("Map image saved");
  }

  const unitsForArmy = units.filter((u) => (u as any).armyId === selectedArmyId);

  if (authLoading) {
    return <div className="wrap"><p>Loading…</p></div>;
  }

  if (!user) {
    return (
      <div className="wrap">
        <header className="top">
          <div>
            <div className="brand">HOLDFAST</div>
            <h1>Sign in</h1>
          </div>
        </header>
        <div className="panel" style={{ maxWidth: 400 }}>
          <form>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <div className="actions">
              <button className="primary" type="button" onClick={handleEmailSignIn}>Sign in</button>
              <button className="ghost" type="button" onClick={handleCreateAccount}>Create account</button>
            </div>
          </form>
          <div className="actions" style={{ marginTop: 12 }}>
            <button className="ghost" type="button" onClick={handleGoogle}>Sign in with Google</button>
          </div>
          {authError && <p className="muted" style={{ color: "#f0c2b0", marginTop: 12 }}>{authError}</p>}
        </div>
      </div>
    );
  }

  if (!campaignId) {
    return (
      <div className="wrap">
        <header className="top">
          <div>
            <div className="brand">HOLDFAST</div>
            <h1>Campaign</h1>
          </div>
          <div>
            <span className="muted">{user.email}</span>
            <button className="ghost" type="button" onClick={handleSignOut} style={{ marginLeft: 12 }}>Sign out</button>
          </div>
        </header>
        <div className="panel" style={{ maxWidth: 420 }}>
          <h2>Create or join</h2>
          <div className="actions" style={{ marginBottom: 20 }}>
            <button className="primary" type="button" onClick={handleCreateCampaign}>
              Create new campaign
            </button>
          </div>
          <form onSubmit={handleJoinCampaign}>
            <label>Or join with an ID</label>
            <input
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              placeholder="Campaign ID"
              required
            />
            <div className="actions">
              <button className="ghost" type="submit">Join</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <div className="brand">HOLDFAST</div>
          <input
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            onBlur={saveCampaign}
            style={{ fontSize: 28, fontWeight: 600, background: "transparent", border: "none", width: "100%", color: "inherit" }}
          />
          <input
            value={campaignSetup}
            onChange={(e) => setCampaignSetup(e.target.value)}
            onBlur={saveCampaign}
            style={{ color: "var(--muted)", background: "transparent", border: "none", width: "100%", marginTop: 4 }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="muted">ID: {campaignId}</span>
          <button className="ghost" type="button" onClick={() => setCampaignId(null)}>Switch campaign</button>
          <span className="muted">{user.email}</span>
          <button className="ghost" type="button" onClick={handleSignOut}>Sign out</button>
          <div className="status">{status}</div>
        </div>
      </header>

      {!ready && (
        <div className="warn">
          Copy .env.example to .env.local, paste the Firebase web keys, then restart npm run dev.
        </div>
      )}

      <div className="grid-layout">
        <section>
          <div className="board">
            {territories.map((tile) => (
              <button
                key={tile.id}
                className={`tile ${tile.id === selectedId ? "selected" : ""}`}
                style={{ borderLeft: `4px solid ${tile.color || "#5a5a5a"}` }}
                onClick={() => setSelectedId(tile.id)}
              >
                <h3>{tile.name}</h3>
                <p>{tile.owner || "Unclaimed"}</p>
              </button>
            ))}
          </div>

          <div className="stack">
            <h2>Battles</h2>
            <form onSubmit={addBattle}>
              <div className="row">
                <div>
                  <label>Date</label>
                  <input name="date" type="date" required />
                </div>
                <div>
                  <label>Mission</label>
                  <input name="mission" placeholder="Secure the Reliquary" />
                </div>
              </div>
              <div className="row">
                <div>
                  <label>Attacker</label>
                  <input name="attacker" placeholder="Word Bearers" />
                </div>
                <div>
                  <label>Defender</label>
                  <input name="defender" placeholder="Pale Seraphim" />
                </div>
              </div>
              <label>Winner</label>
              <input name="winner" />
              <label>Notes</label>
              <textarea name="notes" placeholder="Two or three sentences." />
              <div className="actions">
                <button className="primary" type="submit">Log battle</button>
              </div>
            </form>
            <ul className="list">
              {battles.map((battle) => (
                <li key={battle.id}>
                  <strong>{battle.date} — {battle.winner || "No winner listed"}</strong>
                  <span className="muted">{battle.mission} · {battle.attacker} vs {battle.defender}</span>
                  <div className="actions">
                    <button className="danger" type="button" onClick={() => removeBattle(battle.id)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside>
          <div className="panel">
            <h2>{selected ? selected.name : "Pick a territory"}</h2>
            {selected ? (
              <>
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} />
                <label>Owner</label>
                <input value={owner} onChange={(e) => setOwner(e.target.value)} />
                <label>Color</label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: "100%", height: 36, padding: 2 }} />
                <label>Note</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="actions">
                  <button className="primary" type="button" onClick={saveTile}>Save tile</button>
                </div>
              </>
            ) : (
              <p className="muted">Click a tile to change who holds it.</p>
            )}
          </div>

          <div className="stack">
            <h2>Roster</h2>
            <form onSubmit={addArmy}>
              <label>New army</label>
              <input name="armyName" placeholder="Pale Seraphim" required />
              <div className="actions">
                <button className="primary" type="submit">Add army</button>
              </div>
            </form>

            {armies.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <label>Select army</label>
                <select
                  value={selectedArmyId || ""}
                  onChange={(e) => setSelectedArmyId(e.target.value || null)}
                  style={{ width: "100%" }}
                >
                  <option value="">— pick an army —</option>
                  {armies.map((army) => (
                    <option key={army.id} value={army.id}>{army.name}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedArmy && (
              <>
                <h3 style={{ marginTop: 20 }}>{selectedArmy.name}</h3>
                <form onSubmit={addUnit}>
                  <label>Unit</label>
                  <input name="name" required placeholder="Assault squad" />
                  <div className="row">
                    <div>
                      <label>XP</label>
                      <input name="xp" type="number" min="0" defaultValue={0} />
                    </div>
                    <div>
                      <label>Scars</label>
                      <input name="scars" placeholder="Lost a rhino" />
                    </div>
                  </div>
                  <label>Notes</label>
                  <input name="notes" />
                  <div className="actions">
                    <button className="primary" type="submit">Add unit</button>
                  </div>
                </form>
                <ul className="list">
                  {unitsForArmy.map((unit) => (
                    <li key={unit.id}>
                      <strong>{unit.name} · {unit.xp} XP</strong>
                      <span className="muted">{unit.scars || "No scars yet"}</span>
                      <div className="actions">
                        <button className="danger" type="button" onClick={() => removeUnit(unit.id)}>Remove</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="stack">
            <h2>Map image</h2>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadBanner(file);
              }}
            />
            {bannerUrl && (
              <img src={bannerUrl} alt="Campaign map" style={{ maxWidth: "100%", marginTop: 12, borderRadius: 8 }} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}