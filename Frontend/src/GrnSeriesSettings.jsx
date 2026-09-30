import { useEffect, useState } from "react";
import { FiHash, FiSave } from "react-icons/fi";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const apiFetch = (input, options = {}) =>
  window.fetch(input, { ...options, credentials: "include" });

export default function GrnSeriesSettings() {
  const [nextNumber, setNextNumber] = useState("");
  const [savedNextNumber, setSavedNextNumber] = useState("");
  const [currentNumber, setCurrentNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const applySettings = (data) => {
    setNextNumber(data.nextNumber || "");
    setSavedNextNumber(data.nextNumber || "");
    setCurrentNumber(data.currentNumber || "Not issued yet");
  };

  useEffect(() => {
    apiFetch(`${API_URL}/grns/number-series`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        applySettings(data);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch(`${API_URL}/grns/number-series`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      applySettings(data);
      setMessage(`Next GRN number set to ${data.nextNumber}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grn-series-settings">
      <div className="grn-series-heading">
        <span><FiHash /></span>
        <div>
          <p className="eyebrow">GRN NUMBER CONTROL</p>
          <h2>GRN number series</h2>
          <p>Set the exact number that the next saved GRN should receive.</p>
        </div>
      </div>
      <form onSubmit={save}>
        <label>
          Next GRN Number
          <input
            value={nextNumber}
            onChange={(event) => setNextNumber(event.target.value.toUpperCase())}
            placeholder="GRN-000001"
            disabled={loading || saving}
            maxLength="50"
            required
          />
        </label>
        <button type="submit" disabled={loading || saving || nextNumber === savedNextNumber}>
          <FiSave /> {saving ? "Saving..." : "Save series"}
        </button>
      </form>
      <div className="grn-series-status">
        <span>Last issued <b>{currentNumber}</b></span>
        <span>Next number <b>{savedNextNumber || "Loading..."}</b></span>
      </div>
      {error && <p className="dashboard-error">{error}</p>}
      {message && <p className="stock-update-success">{message}</p>}
    </section>
  );
}
