function GraphPanel({ graphJson, setGraphJson, onGenerateGraph }){
    return(
        <section className="graph-panel">
            <h2>Graph View</h2>

            <div className="graph-placeholder">
                <p>Graph will appear here</p>
                <textarea
                    className="text-area"
                    value={graphJson}
                    onChange={(e) => setGraphJson(e.target.value)}
                />

                <button onClick={onGenerateGraph}>Generate Graph</button>
            </div>

        </section>

    );
}

export default GraphPanel;
