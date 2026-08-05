// Preview canvas dimensions, in the same coordinate space the editor uses.
// Box positions are scaled from this into the smaller card footprint.
const PREVIEW_WIDTH = 900;
const PREVIEW_HEIGHT = 600;
const CARD_WIDTH = 220;
const CARD_HEIGHT = 150;

// Preview boxes are a fixed size (see .note-card-box), so lines can be drawn
// between box centres by offsetting the stored top-left coordinates by half.
const BOX_WIDTH = 150;
const BOX_HEIGHT = 60;

function parseCanvas(cueSection) {
  if (!cueSection) return null;
  try {
    return JSON.parse(cueSection);
  } catch {
    return null;
  }
}

function NoteCard({ note, onOpen, groupName, selectable = false, selected = false }) {
  const canvas = parseCanvas(note.cue_section);
  const scale = Math.min(CARD_WIDTH / PREVIEW_WIDTH, CARD_HEIGHT / PREVIEW_HEIGHT);

  const className = [
    "note-card",
    selectable ? "is-selectable" : "",
    selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={className}
      onClick={() => onOpen(note.id)}
      // Announces the tick as a state rather than leaving it purely visual.
      aria-pressed={selectable ? selected : undefined}
    >
      <div className="note-card-preview" style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
        <div
          className="note-card-canvas"
          style={{
            width: PREVIEW_WIDTH,
            height: PREVIEW_HEIGHT,
            transform: `scale(${scale})`,
          }}
        >
          <svg className="note-card-lines" width={PREVIEW_WIDTH} height={PREVIEW_HEIGHT}>
            {canvas?.lines?.map(([a, b]) => {
              const from = canvas.boxes.find((box) => box.id === a);
              const to = canvas.boxes.find((box) => box.id === b);
              if (!from || !to) return null;
              return (
                <line
                  key={`${a}_${b}`}
                  x1={from.x + BOX_WIDTH / 2}
                  y1={from.y + BOX_HEIGHT / 2}
                  x2={to.x + BOX_WIDTH / 2}
                  y2={to.y + BOX_HEIGHT / 2}
                />
              );
            })}
          </svg>

          {canvas?.boxes?.map((box) => (
            <div
              key={box.id}
              className="note-card-box"
              style={{
                left: box.x,
                top: box.y,
                backgroundColor: box.color || "#f1f1f1",
              }}
            >
              {/* Text only, never innerHTML: stored note markup is not trusted. */}
              {stripHtml(box.content)}
            </div>
          ))}

          {!canvas?.boxes?.length && <p className="note-card-empty">Empty canvas</p>}
        </div>

        {selectable && (
          <span className="note-card-check" aria-hidden="true">
            {selected ? "✓" : ""}
          </span>
        )}
      </div>

      <div className="note-card-meta">
        <span className="note-card-title">{note.title}</span>

        {/* Only a real group gets the highlight - "No group" is an absence, not
            a tag, so it stays plain. */}
        {groupName ? (
          <span className="note-card-group">{groupName}</span>
        ) : (
          <span className="note-card-nogroup">No group</span>
        )}
      </div>
    </button>
  );
}

// DOMParser rather than a detached div + innerHTML: it builds an inert
// document, so nothing in the stored markup can load resources or run.
function stripHtml(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").trim().slice(0, 60);
}

export default NoteCard;
