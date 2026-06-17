import { useEffect, useMemo, useRef, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(dateValue) {
  if (!dateValue) return '-';

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateValue));
}

function fileIcon(name) {
  const extension = name.split('.').pop()?.toLowerCase();

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) return '🖼️';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)) return '🎬';
  if (['pdf'].includes(extension)) return '📄';
  if (['zip', 'rar', '7z'].includes(extension)) return '🗜️';
  return '📎';
}

export default function App() {
  const [dragActive, setDragActive] = useState(false);
  const [recentFiles, setRecentFiles] = useState([]);
  const [allFiles, setAllFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [status, setStatus] = useState('Listo para subir archivos.');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  async function loadRecentFiles() {
    const response = await fetch(`${API_BASE_URL}/files/latest`);
    if (!response.ok) {
      throw new Error('No se pudo cargar la lista de archivos recientes.');
    }

    const data = await response.json();
    setRecentFiles(data.files || []);
  }

  async function loadAllFiles() {
    const response = await fetch(`${API_BASE_URL}/files`);
    if (!response.ok) {
      throw new Error('No se pudo cargar la lista completa de archivos.');
    }

    const data = await response.json();
    setAllFiles(data.files || []);
  }

  useEffect(() => {
    Promise.all([loadRecentFiles(), loadAllFiles()]).catch((error) => setStatus(error.message));
  }, []);

  function handlePickFiles(fileList) {
    const nextFiles = Array.from(fileList || []);
    if (nextFiles.length === 0) return;
    setSelectedFiles((currentFiles) => {
      const mergedFiles = [...currentFiles, ...nextFiles];
      setStatus(`${mergedFiles.length} archivo(s) listo(s) para subir.`);
      return mergedFiles;
    });
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      setStatus('Selecciona o arrastra al menos un archivo.');
      return;
    }

    try {
      setLoading(true);
      setStatus('Subiendo archivos...');

      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append('files', file));

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'No se pudo subir el archivo.');
      }

      const payload = await response.json();
      setStatus(payload.message || 'Archivo subido correctamente.');
      setSelectedFiles([]);
      if (inputRef.current) inputRef.current.value = '';
      await Promise.all([loadRecentFiles(), loadAllFiles()]);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    handlePickFiles(event.dataTransfer.files);
  }

  function removeSelectedFile(indexToRemove) {
    setSelectedFiles((currentFiles) => {
      const nextFiles = currentFiles.filter((_, index) => index !== indexToRemove);
      setStatus(
        nextFiles.length > 0
          ? `${nextFiles.length} archivo(s) listo(s) para subir.`
          : 'Listo para subir archivos.'
      );
      return nextFiles;
    });
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Cloud Taller 3</p>
          <h1>Clon Drive</h1>
          <p className="hero-text">
            Sube y descarga archivos de forma sencilla.
          </p>
        </div>

        <div className="status-card">
          <span className="status-label">Estado</span>
          <p>{status}</p>
        </div>
      </section>

      <section className="workspace">
        <div className="upload-panel">
          <div
            className={`dropzone ${dragActive ? 'dropzone-active' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                openFilePicker();
              }
            }}
          >
            <div className="dropzone-icon">⬆️</div>
            <h2>Arrastra y suelta tus archivos aquí</h2>
            <p>O usa el botón para seleccionar uno o varios archivos.</p>
            <div className="dropzone-actions">
              <button type="button" className="secondary-button" onClick={openFilePicker}>
                Elegir archivos
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleUpload}
                disabled={loading || selectedFiles.length === 0}
              >
                {loading ? 'Subiendo...' : 'Subir archivos'}
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                handlePickFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </div>

          <div className="selected-files">
            <div className="section-header">
              <h3>Archivos listos para subir</h3>
              <span>{selectedFiles.length}</span>
            </div>
            {selectedFiles.length === 0 ? (
              <p className="empty-state">Todavía no hay archivos seleccionados.</p>
            ) : (
              <ul>
                {selectedFiles.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${index}`}>
                    <span>{fileIcon(file.name)}</span>
                    <div>
                      <strong>{file.name}</strong>
                      <p>{formatBytes(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      className="remove-button"
                      onClick={() => removeSelectedFile(index)}
                      aria-label={`Eliminar ${file.name}`}
                    >
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <aside className="recent-panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Recientes</p>
              <h3>Últimos 3 archivos cargados</h3>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => Promise.all([loadRecentFiles(), loadAllFiles()]).catch((error) => setStatus(error.message))}
            >
              Actualizar
            </button>
          </div>

          {recentFiles.length === 0 ? (
            <div className="empty-state box">
              Aún no hay archivos cargados.
            </div>
          ) : (
            <div className="recent-list">
              {recentFiles.map((file) => (
                <article className="file-card" key={file.key}>
                  <div className="file-card-top">
                    <div className="file-badge">{fileIcon(file.originalName)}</div>
                    <a href={`${API_BASE_URL}${file.downloadUrl}`} className="download-link">
                      Descargar
                    </a>
                  </div>
                  <h4>{file.originalName}</h4>
                  <p>{formatBytes(file.size)}</p>
                  <span>{formatDate(file.lastModified)}</span>
                </article>
              ))}
            </div>
          )}
        </aside>
      </section>

      <section className="all-files-panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Biblioteca</p>
            <h3>Todos los archivos cargados</h3>
          </div>
          <span>{allFiles.length}</span>
        </div>

        {allFiles.length === 0 ? (
          <div className="empty-state box">Aún no hay archivos en el bucket.</div>
        ) : (
          <div className="all-files-grid">
            {allFiles.map((file) => (
              <article className="file-card file-card-wide" key={file.key}>
                <div className="file-card-top">
                  <div className="file-badge">{fileIcon(file.originalName)}</div>
                  <a href={`${API_BASE_URL}${file.downloadUrl}`} className="download-link">
                    Descargar
                  </a>
                </div>
                <h4>{file.originalName}</h4>
                <p>{formatBytes(file.size)}</p>
                <span>{formatDate(file.lastModified)}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
