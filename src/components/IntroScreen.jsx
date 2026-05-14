export default function IntroScreen({ onEnter }) {
    return (
        <div className="intro-screen">
            <div className="intro-content">
                <h1 className="intro-title">PROMPT KRITIKAL</h1>
                <button className="intro-button" onClick={onEnter} autoFocus>
                    ENTER SITUATION ROOM
                </button>
            </div>
        </div>
    );
}
