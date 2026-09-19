interface LandingPageProps {
  onBegin: () => void;
}

/** Deliberately sparse: name, one sentence, one action. */
export const LandingPage = ({ onBegin }: LandingPageProps) => (
  <div className="stack">
    <header className="stack">
      <p className="eyebrow">Virginia Tech · Accessible campus navigation</p>
      <h1 style={{ fontSize: "var(--text-3xl)" }}>MotionBridge</h1>
      <p className="lede">
        Teach this website two movements of your own, then find accessible campus spaces without
        touching a keyboard or mouse.
      </p>
    </header>

    <div className="row">
      <button type="button" className="button button--primary button--large" onClick={onBegin}>
        Begin
      </button>
    </div>

    <p className="search__hint">
      Takes about a minute. You choose the two movements — MotionBridge learns yours rather than
      asking you to learn anyone else's. A keyboard works everywhere too.
    </p>
  </div>
);
