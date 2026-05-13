import { useState, useRef } from 'react';
import api from '../../services/api';

/**
 * Carga masiva de costos por CSV. Soporta plantillas: productos / comisiones / envio / adicionales.
 * Extraído del bloque CSVUploadSection que vivía dentro de pages/Costos.jsx.
 *
 * Parser CSV simple — no maneja quoted strings con comas internas, alcanza para los templates planos.
 */
function parseCSVPreview(text, maxRows = 50) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], totalRows: 0 };
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
    return obj;
  });
  return { headers, rows: rows.slice(0, maxRows), totalRows: rows.length };
}

const TEMPLATE_TYPES = [
  { id: 'productos', label: 'Productos' },
  { id: 'comisiones', label: 'Comisiones' },
  { id: 'envio', label: 'Envío' },
  { id: 'adicionales', label: 'Adicionales' },
];

export default function CSVUploadPanel({ storeId, onUploaded }) {
  const fileRef = useRef();
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    setResult(null);
    if (!file) {
      setSelectedFile(null);
      setPreview(null);
      return;
    }
    setSelectedFile(file);
    try {
      const text = await file.text();
      setPreview(parseCSVPreview(text, 50));
    } catch {
      setPreview({ headers: [], rows: [], totalRows: 0, error: 'No se pudo leer el archivo.' });
    }
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0] || selectedFile;
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('effectiveFrom', effectiveFrom);
    try {
      const { data } = await api.post(`/api/stores/${storeId}/products/costs`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      if (fileRef.current) fileRef.current.value = '';
      setSelectedFile(null);
      setPreview(null);
      onUploaded?.();
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Error' });
    }
    setUploading(false);
  };

  const cancelPreview = () => {
    if (fileRef.current) fileRef.current.value = '';
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
  };

  const downloadTemplate = (type) => {
    window.open(`/api/stores/${storeId}/products/costs/template?type=${type}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] text-gray-200 mb-2">Descargá una plantilla, completala con Excel y subila acá.</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_TYPES.map((t) => (
            <button key={t.id} onClick={() => downloadTemplate(t.id)} className="chip">
              Plantilla {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-[11px] text-gray-200 flex items-center gap-2">
          Vigencia desde
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className="input-dark"
          />
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="text-[12px] text-gray-200 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[12px] file:font-semibold file:bg-blue-500/15 file:text-blue-300 hover:file:bg-blue-500/25 file:transition"
        />
        <button
          onClick={handleUpload}
          disabled={uploading || !preview || preview.error}
          className="btn-primary disabled:opacity-50"
        >
          {uploading ? 'Subiendo...' : 'Confirmar e importar'}
        </button>
        {preview && (
          <button onClick={cancelPreview} className="btn-ghost text-[12px]">
            Cancelar
          </button>
        )}
      </div>

      {preview && !preview.error && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-semibold text-white">
              Vista previa — {preview.totalRows} {preview.totalRows === 1 ? 'fila' : 'filas'} detectadas
            </p>
            <p className="text-[11px] text-gray-300">
              Mostrando primeras {Math.min(preview.totalRows, 10)} · vigencia desde {effectiveFrom}
            </p>
          </div>
          {preview.headers.length === 0 ? (
            <p className="text-[12px] text-amber-300">El archivo está vacío.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-gray-300">
                    {preview.headers.map((h) => (
                      <th key={h} className="text-left font-semibold uppercase tracking-wider text-[10px] py-1 px-2 border-b border-white/[0.06]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      {preview.headers.map((h) => (
                        <td key={h} className="py-1 px-2 text-white border-b border-white/[0.03] truncate max-w-[160px]">{row[h] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.totalRows > 10 && (
                <p className="text-[11px] text-gray-300 mt-2">+ {preview.totalRows - 10} filas más se importan al confirmar.</p>
              )}
            </div>
          )}
        </div>
      )}

      {preview?.error && <p className="text-[12px] text-red-400">{preview.error}</p>}

      {result && !result.error && (
        <div className="space-y-1">
          <p className="text-[12px] text-emerald-400">
            Actualizados: {result.updated} · Vigencia: {effectiveFrom}
            {result.notFound?.length > 0 && ` | No encontrados: ${result.notFound.length}`}
          </p>
          {result.notFound?.length > 0 && (
            <details className="text-[11px] text-amber-300">
              <summary className="cursor-pointer hover:text-amber-200">Ver SKUs no encontrados ({result.notFound.length})</summary>
              <p className="mt-1 text-gray-300 break-all">{result.notFound.join(', ')}</p>
            </details>
          )}
          {result.invalidRows?.length > 0 && (
            <details className="text-[11px] text-amber-400">
              <summary className="cursor-pointer hover:text-amber-300">Ver filas inválidas ({result.invalidRows.length})</summary>
              <p className="mt-1 text-gray-300 break-all">{result.invalidRows.join(' | ')}</p>
            </details>
          )}
        </div>
      )}
      {result?.error && <p className="text-[12px] text-red-400">{result.error}</p>}
    </div>
  );
}
