import { FormEvent, useEffect, useMemo, useState } from "react";
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
import { CAMPAIGN_ID, db, firebaseReady, storage } from "./firebase";
import { SEED_TERRITORIES } from "./seed";
import type { Battle, RosterUnit, Territory } from "./types";
import "./App.css";

const campaignRef = () => doc(db!, "campaigns", CAMPAIGN_ID);
const territoriesCol = () => collection(db!, "campaigns", CAMPAIGN_ID, "territories");
const battlesCol = () => collection(db!, "campaigns", CAMPAIGN_ID, "battles");
const unitsCol = () => collection(db!, "campaigns", CAMPAIGN_ID, "units");

export default function App() {
  const ready = firebaseReady();
  const [status, setStatus] = useState(ready ? "Connecting to Firestore…" : "Firebase keys missing");
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [units, setUnits] = useState<RosterUnit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [owner, setOwner] = useState("");
  const [note, setNote] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  const selected = useMemo(
    () => territories.find((t) => t.id === selectedId) ?? null,
    [territories, selectedId],
  );

  useEffect(() => {
    if (!ready || !db) return;

    let unsubTiles = () => {};
    let unsubBattles = () => {};
    let unsubUnits = () => {};

    async function boot() {
      const existing = await getDocs(territoriesCol());
      if (existing.empty) {
        await setDoc(campaignRef(), {
          name: "Shrine World",
          setup: "Pale Seraphim vs Word Bearers",
        });
        await Promise.all(
          SEED_TERRITORIES.map((tile, index) =>
            setDoc(doc(territoriesCol(), `t${index + 1}`), tile),
          ),
        );
      }

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
      unsubUnits = onSnapshot(unitsCol(), (snap) => {
        setUnits(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RosterUnit, "id">) })));
      });
    }

    boot().catch((err) => setStatus(String(err.message || err)));
    return () => {
      unsubTiles();
      unsubBattles();
      unsubUnits();
    };
  }, [ready]);

  useEffect(() => {
    if (!selected) return;
    setOwner(selected.owner);
    setNote(selected.note);
  }, [selected]);

  async function saveTile() {
    if (!db || !selected) return;
    setStatus("Saving tile…");
    await updateDoc(doc(territoriesCol(), selected.id), { owner, note });
    setStatus("Tile saved");
  }

  async function addBattle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) return;
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

  async function addUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) return;
    const form = new FormData(event.currentTarget);
    setStatus("Saving unit…");
    await addDoc(unitsCol(), {
      name: String(form.get("name") || ""),
      xp: Number(form.get("xp") || 0),
      scars: String(form.get("scars") || ""),
      notes: String(form.get("notes") || ""),
    });
    event.currentTarget.reset();
    setStatus("Unit added");
  }

  async function removeUnit(id: string) {
    if (!db) return;
    await deleteDoc(doc(unitsCol(), id));
    setStatus("Unit removed");
  }

  async function removeBattle(id: string) {
    if (!db) return;
    await deleteDoc(doc(battlesCol(), id));
    setStatus("Battle removed");
  }

  async function uploadBanner(file: File) {
    if (!storage || !db) return;
    setStatus("Uploading map image…");
    const fileRef = ref(storage, `campaigns/${CAMPAIGN_ID}/${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    await setDoc(campaignRef(), { bannerUrl: url }, { merge: true });
    setBannerUrl(url);
    setStatus("Map image saved");
  }

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <div className="brand">HOLDFAST</div>
          <h1>Shrine World</h1>
          <p className="sub">Pale Seraphim vs Word Bearers</p>
        </div>
        <div className="status">{status}</div>
      </header>

      {!ready && (
        <div className="warn">
          Copy .env.example to .env.local, paste the Firebase web keys, then restart npm run dev.
        </div>
      )}

      <div className="grid-layout">
        <section>
          <div className="board">
            {territories.map((tile) => {
              const ownerKey = (tile.owner || "Unclaimed").toLowerCase();
              const colorClass =
                ownerKey.includes("pale") || ownerKey.includes("seraphim") ? "owner-pale" :
                ownerKey.includes("word") || ownerKey.includes("bearer") ? "owner-word" :
                "owner-unclaimed";

              return (
                <button
                  key={tile.id}
                  className={`tile ${colorClass} ${tile.id === selectedId ? "selected" : ""}`}
                  onClick={() => setSelectedId(tile.id)}
                >
                  <h3>{tile.name}</h3>
                  <p>{tile.owner || "Unclaimed"}</p>
                </button>
              );
            })}
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
                <label>Owner</label>
                <input value={owner} onChange={(e) => setOwner(e.target.value)} />
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
              {units.map((unit) => (
                <li key={unit.id}>
                  <strong>{unit.name} · {unit.xp} XP</strong>
                  <span className="muted">{unit.scars || "No scars yet"}</span>
                  <div className="actions">
                    <button className="danger" type="button" onClick={() => removeUnit(unit.id)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="stack">
            <h2>Map image</h2>
            <p className="muted">Optional. Proves Storage talks to the same campaign document.</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadBanner(file);
              }}
            />
            {bannerUrl ? <p className="muted">Uploaded. URL stored on the campaign.</p> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}