interface LandingPageProps {
  onBegin: () => void;
}

/** Deliberately sparse: name, one sentence, one action. */
export const LandingPage = ({ onBegin }: LandingPageProps) => (
  <div className="landing">
    <div>
      <h1 className="display" style={{ fontSize: "var(--text-3xl)", maxWidth: "13ch" }}>
        Browse campus <em>without touching anything.</em>
      </h1>

      <p className="lede" style={{ marginTop: "var(--space-5)", maxWidth: "48ch" }}>
        Teach this website two movements of your own. Then find accessible spaces at Virginia Tech
        using nothing but your face.
      </p>

      <button
        type="button"
        className="button button--primary button--large"
        style={{ marginTop: "var(--space-6)" }}
        onClick={onBegin}
      >
        Begin
        <span aria-hidden="true">&#8594;</span>
      </button>
    </div>

    <aside className="landing__aside">
      <p className="label">You will teach</p>
      <dl className="landing__commands">
        <div className="landing__command">
          <dt>NEXT</dt>
          <dd>Moves the focus between results</dd>
        </div>
        <div className="landing__command">
          <dt>SELECT</dt>
          <dd>Opens the focused result</dd>
        </div>
      </dl>
      <p className="camera__note">
        Any small movement you can repeat comfortably. A tilt, a raised eyebrow, a glance.
      </p>
    </aside>
  </div>
);
