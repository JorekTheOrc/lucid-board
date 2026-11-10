import React, { useRef, useState, useEffect } from 'react'
import { HTMLContainer, T, ShapeUtil, Rectangle2d, resizeBox, useEditor, useValue, AssetUtil } from 'tldraw'
import type { TLShape, TLResizeInfo, TLAsset } from 'tldraw'
import { db } from '../../db/db'

function fmt(s: number) {
  if (!isFinite(s) || s <= 0) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  return m + ':' + ss;
}

export type AudioAsset = TLAsset<'audio', {
  name: string
  src: string
  w: number
  h: number
  mimeType: string
  isAnimated: boolean
}>

export class AudioAssetUtil extends AssetUtil<AudioAsset> {
  static override type = 'audio' as const

  override getDefaultProps(): AudioAsset['props'] {
    return { name: 'audio.mp3', src: '', w: 0, h: 0, mimeType: 'audio/mpeg', isAnimated: false }
  }

  override async getAssetUrl(asset: AudioAsset) {
    return null
  }
}

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'audio-player': { w: number; h: number; assetId: string; transcript: string; isEditing?: boolean; }
  }
}

export type AudioShape = TLShape<'audio-player'>

function AudioPlayerComponent({ shape }: { shape: AudioShape }) {
  const editor = useEditor()
  const asset = useValue('audio-asset', () => editor.getAsset(shape.props.assetId as any) as AudioAsset, [editor, shape.props.assetId])
  const [audioUrl, setAudioUrl] = useState('')
  const ref = useRef<HTMLAudioElement>(null)
  
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [rate, setRate] = useState(1)
  const [muted, setMuted] = useState(false)
  const [showT, setShowT] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let isMounted = true;
    let objectUrl = '';

    if (asset) {
      db.assets.get(shape.props.assetId).then((data) => {
        if (data && data.blob && isMounted) {
          const blobWithType = new Blob([data.blob], { type: data.blob.type || 'audio/mpeg' })
          objectUrl = URL.createObjectURL(blobWithType);
          setAudioUrl(objectUrl);
          console.log("[Audio] Created URL:", objectUrl);
        }
      }).catch(err => {
        console.error("[Audio] DB Error:", err);
        setErr('Failed to load file from DB');
      });
    }

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset, shape.props.assetId]);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onLoad = () => setDuration(a.duration || 0);
    const onPlay = () => { console.log("[Audio] Play event fired"); setPlaying(true); };
    const onPause = () => { console.log("[Audio] Pause event fired"); setPlaying(false); };
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    const onErr = () => {
      const error = a.error;
      console.error("[Audio] Playback Error:", error);
      if (error?.code === 4) setErr('Format not supported by browser');
      else if (error?.code === 3) setErr('File corrupted or empty');
      else setErr('Cannot play this file');
    };
    
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onLoad);
    a.addEventListener('durationchange', onLoad);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onErr);
    
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onLoad);
      a.removeEventListener('durationchange', onLoad);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onErr);
    };
  }, [audioUrl]);

  useEffect(() => { if (ref.current) ref.current.playbackRate = rate; }, [rate]);
  useEffect(() => { if (ref.current) ref.current.volume = muted ? 0 : volume; }, [volume, muted]);

  const toggle = (e: React.MouseEvent) => {
    console.log("[Audio] Toggle button clicked");
    e.stopPropagation()
    setErr('')
    const a = ref.current;
    if (!a) {
      console.log("[Audio] No audio ref found");
      return;
    }
    console.log("[Audio] Current paused state:", a.paused);
    if (a.paused) {
      a.play().then(() => console.log("[Audio] Play promise resolved")).catch((error) => {
        console.error("[Audio] Play Promise Error:", error);
        setErr('Click again (browser blocked autoplay)')
      })
    } else {
      a.pause()
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const a = ref.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = x * duration;
  };

  if (!audioUrl) return <div style={{ padding: 10, fontSize: '12px', color: '#6b7280' }}>Loading audio data...</div>

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }} onPointerDown={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={toggle} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', fontSize: '0.95rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {playing ? '❚❚' : '▶'}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {asset?.props.name || 'audio'}
          </div>
          <div onClick={seek} style={{ height: 6, background: '#e2e8f0', borderRadius: 3, position: 'relative', cursor: 'pointer' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%', background: '#2563eb', borderRadius: 3 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: 3 }}>
            <span>{fmt(current)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <select value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} style={{ padding: '4px 6px', fontSize: '0.78rem', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff' }}>
            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(r => <option key={r} value={r}>{r}×</option>)}
          </select>
          <span style={{ fontSize: '0.95rem', lineHeight: 1 }}>{muted || volume === 0 ? '🔇' : (volume < 0.5 ? '🔉' : '🔊')}</span>
          <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }} style={{ width: 70 }} />
        </div>
      </div>

      {/* key={audioUrl} заставляет React пересоздать тег при смене URL */}
      <audio key={audioUrl} ref={ref} src={audioUrl} preload="auto" />
      
      {err && <div style={{ color: '#dc2626', fontSize: '0.78rem', fontWeight: 'bold' }}>{err}</div>}

      {shape.props.transcript && (
        <div style={{ marginTop: 4 }}>
          <button onClick={() => setShowT(v => !v)} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>
            {showT ? 'Hide transcript' : 'Show transcript'}
          </button>
          {showT && (
            <div style={{ marginTop: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 12px', fontSize: '0.85rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: '150px', overflowY: 'auto' }}>
              {shape.props.transcript}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export class AudioShapeUtil extends ShapeUtil<AudioShape> {
  static override type = 'audio-player' as const
  static override props = { w: T.number, h: T.number, assetId: T.string, transcript: T.string, isEditing: T.boolean.optional() }

  getDefaultProps(): AudioShape['props'] {
    return { w: 450, h: 100, assetId: '', transcript: '', isEditing: false }
  }

  override canEditInReadonly() { return true }
  override canResize() { return true }
  override onResize(shape: AudioShape, info: TLResizeInfo<AudioShape>) { return resizeBox(shape, info) }

  getGeometry(shape: AudioShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: AudioShape) {
    const editor = useEditor()
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
      if (shape.props.isEditing && textareaRef.current) textareaRef.current.focus()
    }, [shape.props.isEditing])

    return (
      <HTMLContainer style={{ pointerEvents: 'all', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', padding: '16px', border: shape.props.isEditing ? '2px solid #3b82f6' : '2px solid #e5e7eb' }}
        onDoubleClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'audio-player', props: { ...shape.props, isEditing: true } }) }}
      >
        <AudioPlayerComponent shape={shape} />
        {shape.props.isEditing && (
          <textarea ref={textareaRef} value={shape.props.transcript}
            onChange={(e) => editor.updateShape({ id: shape.id, type: 'audio-player', props: { ...shape.props, transcript: e.target.value } })}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={() => editor.updateShape({ id: shape.id, type: 'audio-player', props: { ...shape.props, isEditing: false } })}
            placeholder="Paste audio transcript here..."
            style={{ marginTop: '12px', width: '100%', minHeight: '60px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px' }}
          />
        )}
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: AudioShape): Path2D {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}