import { useEffect, useMemo, useRef, useState } from "react";
import { removeBackground } from "@imgly/background-removal";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Cloud,
  CloudOff,
  Compass,
  ImagePlus,
  LoaderCircle,
  Plus,
  Shirt,
  Sparkles,
  Luggage,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { getOllamaStatus, requestLooks } from "./api";
import { deleteGarment, getGarments, saveGarment } from "./storage";
import { categories, type Category, type Garment, type OllamaStatus, type Page, type SuggestedLook } from "./types";

const colors = ["Black", "White", "Cream", "Blue", "Navy", "Green", "Brown", "Red", "Pink", "Grey", "Yellow", "Print"];
const occasions = ["Everyday", "Work", "Weekend", "Dinner", "Vacation", "Travel day"];

function makeId(): string {
  return crypto.randomUUID();
}

async function resizePhoto(file: File): Promise<Blob> {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this photo.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not read this photo."))), "image/jpeg", 0.88);
  });
}

function useObjectUrl(blob: Blob): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const nextUrl = URL.createObjectURL(blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [blob]);
  return url;
}

function GarmentImage({ garment, className = "" }: { garment: Garment; className?: string }) {
  const src = useObjectUrl(garment.image);
  return <img className={className} src={src} alt={garment.name} />;
}

function App() {
  const [page, setPage] = useState<Page>("wardrobe");
  const [wardrobe, setWardrobe] = useState<Garment[]>([]);
  const [filter, setFilter] = useState("All pieces");
  const [showAdd, setShowAdd] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("Tops");
  const [color, setColor] = useState("Black");
  const [season, setSeason] = useState("All year");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [occasion, setOccasion] = useState("Everyday");
  const [looks, setLooks] = useState<SuggestedLook[]>([]);
  const [styling, setStyling] = useState(false);
  const [manualLook, setManualLook] = useState<string[]>([]);
  const [destination, setDestination] = useState("");
  const [packingIds, setPackingIds] = useState<string[]>([]);
  const [packedIds, setPackedIds] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getGarments()
      .then(setWardrobe)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Your closet could not be opened."));
    getOllamaStatus().then(setStatus).catch(() => setStatus({ ollama: false, model: "qwen3:4b", error: "The local AI service is not responding." }));
    setDestination(localStorage.getItem("threadwise-destination") ?? "");
    setPackingIds(JSON.parse(localStorage.getItem("threadwise-packing") ?? "[]") as string[]);
    setPackedIds(JSON.parse(localStorage.getItem("threadwise-packed") ?? "[]") as string[]);
  }, []);

  useEffect(() => {
    if (photo) {
      const url = URL.createObjectURL(photo);
      setPhotoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPhotoPreview("");
  }, [photo]);

  const visibleWardrobe = useMemo(
    () => filter === "All pieces" ? wardrobe : wardrobe.filter((item) => item.category === filter),
    [filter, wardrobe],
  );
  const readyForAI = Boolean(status?.ollama && status.modelAvailable);
  const aiHint = wardrobe.length < 2
    ? `Add ${2 - wardrobe.length} more ${wardrobe.length === 1 ? "piece" : "pieces"} to your wardrobe to enable AI outfit ideas.`
    : status === null
      ? "Checking your local AI connection…"
      : !status.ollama
        ? `Start Ollama on your computer with ${status.model} for personal outfit ideas.`
        : !status.modelAvailable
          ? `Download the ${status.model} model in Ollama to get personal outfit ideas.`
          : "";
  const categoryCount = (value: string) => wardrobe.filter((item) => item.category === value).length;

  function openAdd() {
    setError("");
    setPhoto(null);
    setName("");
    setCategory("Tops");
    setColor("Black");
    setSeason("All year");
    setShowAdd(true);
  }

  async function handleSaveGarment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo) {
      setError("Choose a photo first.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const input = await resizePhoto(photo);
      const transparentImage = await removeBackground(input, {
        model: "isnet_quint8",
        output: { format: "image/png", quality: 0.9 },
      });
      const garment: Garment = {
        id: makeId(),
        name: name.trim(),
        category,
        color,
        season,
        image: transparentImage,
        createdAt: Date.now(),
      };
      await saveGarment(garment);
      setWardrobe((current) => [garment, ...current]);
      setShowAdd(false);
      setPhoto(null);
      setNotice("Background removed and piece added to your closet.");
      window.setTimeout(() => setNotice(""), 3500);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The photo could not be processed. Try another image.");
    } finally {
      setSaving(false);
    }
  }

  async function removePiece(garment: Garment) {
    try {
      await deleteGarment(garment.id);
      setWardrobe((current) => current.filter((item) => item.id !== garment.id));
      setPackingIds((current) => current.filter((id) => id !== garment.id));
      setPackedIds((current) => current.filter((id) => id !== garment.id));
      setLooks((current) => current.filter((look) => !look.itemIds.includes(garment.id)));
      setManualLook((current) => current.filter((id) => id !== garment.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That piece could not be removed.");
    }
  }

  async function styleCloset() {
    setStyling(true);
    setError("");
    try {
      setLooks(await requestLooks(wardrobe, occasion));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create outfit ideas.");
    } finally {
      setStyling(false);
    }
  }

  function togglePacking(id: string) {
    setPackingIds((current) => {
      const next = current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id];
      localStorage.setItem("threadwise-packing", JSON.stringify(next));
      return next;
    });
    setPackedIds((current) => {
      const next = current.filter((itemId) => itemId !== id);
      localStorage.setItem("threadwise-packed", JSON.stringify(next));
      return next;
    });
  }

  function togglePacked(id: string) {
    setPackedIds((current) => {
      const next = current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id];
      localStorage.setItem("threadwise-packed", JSON.stringify(next));
      return next;
    });
  }

  function toggleManualLook(id: string) {
    setManualLook((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  }

  function saveManualLook() {
    if (manualLook.length < 2) {
      setError("Choose at least two pieces to make a look.");
      return;
    }
    const pieces = wardrobe.filter((item) => manualLook.includes(item.id));
    setLooks((current) => [{
      title: "Your own combination",
      occasion,
      itemIds: pieces.map((item) => item.id),
      note: "A look styled by you, from pieces already in your closet.",
    }, ...current]);
    setManualLook([]);
    setNotice("Your look is ready.");
    window.setTimeout(() => setNotice(""), 3000);
  }

  const packedCount = packedIds.filter((id) => packingIds.includes(id)).length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage("wardrobe"); }}>
          <span className="brand-mark"><Shirt size={19} strokeWidth={1.8} /></span>
          <span>threadwise<span className="brand-dot">.</span></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={page === "wardrobe" ? "nav-link active" : "nav-link"} onClick={() => setPage("wardrobe")}><Shirt size={16} /> Wardrobe</button>
          <button className={page === "outfits" ? "nav-link active" : "nav-link"} onClick={() => setPage("outfits")}><Sparkles size={16} /> Outfit ideas</button>
          <button className={page === "packing" ? "nav-link active" : "nav-link"} onClick={() => setPage("packing")}><Luggage size={16} /> Packing list</button>
        </nav>
        <div className="ai-status" title={readyForAI ? `Using ${status?.model} on this computer` : "Connect a local Ollama model"}>
          {readyForAI ? <Cloud size={15} /> : <CloudOff size={15} />}
          <span>{readyForAI ? "Local AI ready" : "AI offline"}</span>
        </div>
      </header>

      <main className="content">
        {error && <div className="notice error-notice" role="alert"><CircleHelp size={17} /> <span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={16} /></button></div>}
        {notice && <div className="notice success-notice" role="status"><CheckCircle2 size={17} /> {notice}</div>}

        {page === "wardrobe" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow"><span className="eyebrow-line" /> YOUR CLOSET, CONSIDERED</div>
                <h1>Get dressed with<br /><em>what you love.</em></h1>
                <p>Make your wardrobe work harder. Save your pieces, find a fresh combination, and get out the door feeling like you.</p>
                <button className="button button-dark" onClick={openAdd}><Plus size={17} /> Add a piece</button>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="art-sun" />
                <div className="art-note note-one">less stress,<br />more style</div>
                <div className="art-note note-two">made for<br />real life ✳</div>
                <div className="hanger"><span /><span /><span /></div>
                <div className="art-label">a little more you,<br />every morning.</div>
              </div>
            </section>

            <section className="collection-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow eyebrow-muted">THE GOOD STUFF</div>
                  <h2>Your wardrobe <span className="count-badge">{wardrobe.length}</span></h2>
                </div>
                <button className="text-button" onClick={() => setPage("outfits")}>Style an outfit <ArrowRight size={16} /></button>
              </div>
              <div className="category-summary">
                {categories.slice(0, 5).map((item) => (
                  <button key={item} className="category-summary-item" onClick={() => setFilter(filter === item ? "All pieces" : item)}>
                    <span>{item}</span><strong>{categoryCount(item)}</strong>
                  </button>
                ))}
              </div>
              <div className="filter-row">
                {["All pieces", ...categories].map((item) => (
                  <button key={item} className={filter === item ? "filter-pill selected" : "filter-pill"} onClick={() => setFilter(item)}>
                    {item}{item === "All pieces" && <span>{wardrobe.length}</span>}
                  </button>
                ))}
              </div>
              {visibleWardrobe.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><ImagePlus size={24} /></div>
                  <h3>{wardrobe.length === 0 ? "Your closet starts here" : `No ${filter.toLowerCase()} yet`}</h3>
                  <p>{wardrobe.length === 0 ? "Snap a photo of a favourite piece. We’ll make the background disappear and keep it right here on your device." : "Add a piece in this category whenever you’re ready."}</p>
                  <button className="button button-outline" onClick={openAdd}><Plus size={16} /> Add your first piece</button>
                </div>
              ) : (
                <div className="garment-grid">
                  {visibleWardrobe.map((garment) => <GarmentCard key={garment.id} garment={garment} onRemove={() => removePiece(garment)} />)}
                  <button className="add-card" onClick={openAdd}><span><Plus size={20} /></span><strong>Add a piece</strong><small>Make room for more</small></button>
                </div>
              )}
            </section>
            <section className="privacy-strip">
              <div className="privacy-icon"><Check size={16} /></div>
              <p><strong>Your closet stays yours.</strong> Photos are cut out on this device and saved only in this browser.</p>
              <span>PRIVATE BY DESIGN</span>
            </section>
          </>
        )}

        {page === "outfits" && (
          <section className="page-section">
            <div className="eyebrow"><span className="eyebrow-line" /> A LITTLE STYLE HELP</div>
            <div className="page-title-row"><div><h1>Good things <em>go together.</em></h1><p>Pick an occasion and let your closet surprise you. Or mix and match your own way.</p></div><div className="page-stamp"><Sparkles size={22} /><span>made from<br />your wardrobe</span></div></div>
            <div className="style-controls">
              <label className="select-field"><span>What are you dressing for?</span><span className="select-wrap"><select value={occasion} onChange={(event) => setOccasion(event.target.value)}>{occasions.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></span></label>
              <button className="button button-dark" onClick={styleCloset} disabled={styling || wardrobe.length < 2} aria-describedby={aiHint ? "style-help" : undefined}>
                {styling ? <LoaderCircle className="spin" size={17} /> : <WandSparkles size={17} />}
                {styling ? "Finding your looks…" : "Style with local AI"}
              </button>
              {aiHint && <p className="inline-hint" id="style-help">{aiHint}</p>}
            </div>
            {looks.length > 0 && <div className="look-grid">{looks.map((look, index) => <LookCard key={`${look.title}-${index}`} look={look} wardrobe={wardrobe} />)}</div>}
            <div className="manual-section">
              <div className="section-heading"><div><div className="eyebrow eyebrow-muted">YOUR EYE, YOUR RULES</div><h2>Build your own look</h2></div><button className="button button-outline button-small" onClick={saveManualLook} disabled={manualLook.length < 2}><Check size={15} /> Save look</button></div>
              {wardrobe.length === 0 ? <div className="empty-inline">Add a few wardrobe pieces first, then come back to make a look.</div> : <div className="select-grid">{wardrobe.map((garment) => <GarmentCard key={garment.id} garment={garment} selectable selected={manualLook.includes(garment.id)} onSelect={() => toggleManualLook(garment.id)} />)}</div>}
            </div>
          </section>
        )}

        {page === "packing" && (
          <section className="page-section packing-page">
            <div className="eyebrow"><span className="eyebrow-line" /> TAKE YOUR STYLE WITH YOU</div>
            <div className="page-title-row"><div><h1>Pack light. <em>Feel like you.</em></h1><p>Build a thoughtful packing list from the pieces you already love wearing.</p></div><div className="page-stamp"><Compass size={23} /><span>your next<br />little escape</span></div></div>
            <label className="destination-field"><span>Where are you off to?</span><input value={destination} onChange={(event) => { setDestination(event.target.value); localStorage.setItem("threadwise-destination", event.target.value); }} placeholder="A weekend in Lisbon…" /></label>
            <div className="packing-progress"><div><strong>{packedCount}</strong><span> of {packingIds.length} pieces packed</span></div><div className="progress-track"><span style={{ width: `${packingIds.length ? packedCount / packingIds.length * 100 : 0}%` }} /></div></div>
            <div className="section-heading"><div><div className="eyebrow eyebrow-muted">CHOOSE YOUR PIECES</div><h2>{destination ? `For ${destination}` : "Build your packing list"}</h2></div><span className="packing-total"><Luggage size={16} /> {packingIds.length} selected</span></div>
            {wardrobe.length === 0 ? <div className="empty-inline">Your wardrobe is empty for now. Add a few pieces to start packing.</div> : (
              <div className="select-grid">
                {wardrobe.map((garment) => (
                  <GarmentCard key={garment.id} garment={garment} selectable selected={packingIds.includes(garment.id)} packed={packedIds.includes(garment.id)} onSelect={() => togglePacking(garment.id)} onPacked={() => togglePacked(garment.id)} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="footer"><a href="#" className="footer-brand" onClick={(event) => { event.preventDefault(); setPage("wardrobe"); }}>threadwise.</a><span>Wear what you have. Love how it feels.</span><span className="footer-ai"><Sparkles size={14} /> Thoughtful tech, softer mornings.</span></footer>

      {showAdd && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowAdd(false); }}>
          <section className="add-modal" role="dialog" aria-modal="true" aria-labelledby="add-title">
            <div className="modal-header"><div><div className="eyebrow eyebrow-muted">MAKE IT YOURS</div><h2 id="add-title">Add a piece</h2></div><button className="icon-button" onClick={() => setShowAdd(false)} disabled={saving} aria-label="Close"><X size={19} /></button></div>
            <form onSubmit={handleSaveGarment}>
              <button type="button" className={photo ? "photo-picker has-photo" : "photo-picker"} onClick={() => fileInput.current?.click()}>
                {photoPreview ? <img src={photoPreview} alt="Selected clothing item preview" /> : <><span className="photo-picker-icon"><ImagePlus size={24} /></span><strong>Choose a photo</strong><small>Or take one with your camera</small><span className="photo-picker-cta"><Plus size={15} /> Browse photos</span></>}
                {photo && <span className="photo-change">Tap to change photo</span>}
              </button>
              <input ref={fileInput} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) { if (file.size > 15 * 1024 * 1024) { setError("Choose a photo under 15 MB."); return; } setPhoto(file); setError(""); setName(file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")); } }} />
              <label className="form-field"><span>What is it?</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. linen button-up" required maxLength={60} /></label>
              <div className="form-row">
                <label className="form-field"><span>Category</span><span className="select-wrap"><select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></span></label>
                <label className="form-field"><span>Main colour</span><span className="select-wrap"><select value={color} onChange={(event) => setColor(event.target.value)}>{colors.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></span></label>
              </div>
              <label className="form-field"><span>Season</span><span className="select-wrap"><select value={season} onChange={(event) => setSeason(event.target.value)}>{["All year", "Spring", "Summer", "Autumn", "Winter"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></span></label>
              <div className="background-note"><Sparkles size={15} /><span>We’ll remove the background on this device before saving.</span></div>
              <button className="button button-dark modal-submit" type="submit" disabled={saving || !photo}>
                {saving ? <><LoaderCircle className="spin" size={17} /> Clearing the background…</> : <><Plus size={17} /> Add to my closet</>}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function GarmentCard({
  garment,
  onRemove,
  onSelect,
  onPacked,
  selectable = false,
  selected = false,
  packed = false,
}: {
  garment: Garment;
  onRemove?: () => void;
  onSelect?: () => void;
  onPacked?: () => void;
  selectable?: boolean;
  selected?: boolean;
  packed?: boolean;
}) {
  return (
    <article className={`garment-card${selected ? " selected" : ""}${packed ? " packed" : ""}`}>
      <button className="garment-pick" onClick={onSelect} disabled={!selectable} aria-pressed={selected} aria-label={`${selected ? "Remove" : "Add"} ${garment.name}${selectable ? " to selection" : ""}`}>
        <div className="garment-image-wrap"><span className="image-ground" /><GarmentImage garment={garment} className="garment-image" />{selected && <span className="selected-mark"><Check size={14} /></span>}</div>
        <div className="garment-details"><div className="garment-name">{garment.name}</div><div className="garment-meta">{garment.category} <span>·</span> {garment.color}</div></div>
      </button>
      {packed && <span className="packed-label"><Check size={12} /> Packed</span>}
      {onPacked && selected && <button className={packed ? "packed-toggle checked" : "packed-toggle"} onClick={onPacked}>{packed ? <><Check size={13} /> Packed</> : <><ArrowDownToLine size={13} /> Mark packed</>}</button>}
      {onRemove && <button className="remove-garment" onClick={onRemove} aria-label={`Remove ${garment.name}`}><Trash2 size={15} /></button>}
    </article>
  );
}

function LookCard({ look, wardrobe }: { look: SuggestedLook; wardrobe: Garment[] }) {
  const pieces = look.itemIds.map((id) => wardrobe.find((item) => item.id === id)).filter((item): item is Garment => Boolean(item));
  return (
    <article className="look-card">
      <div className="look-top"><div><span className="look-kicker">A LOOK FOR {look.occasion.toUpperCase()}</span><h3>{look.title}</h3></div><span className="look-spark"><Sparkles size={17} /></span></div>
      <div className="look-pieces">{pieces.map((garment) => <div className="look-piece" key={garment.id}><GarmentImage garment={garment} /><span>{garment.name}</span></div>)}</div>
      <p>{look.note}</p>
    </article>
  );
}

export default App;
