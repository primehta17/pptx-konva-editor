import React, { useRef, useState, useEffect } from 'react'
import { Stage, Layer, Rect, Text, Image as KImage, Transformer } from 'react-konva'
import { parsePptxFile } from '../lib/pptxParser' 

/* simple image loader hook */
function useImage(url) {
  const [img, setImg] = useState(null)
  useEffect(() => {
    if (!url) { setImg(null); return }
    const image = new window.Image()
    image.crossOrigin = 'Anonymous'
    image.onload = () => setImg(image)
    image.src = url
    // cleanup: optionally revokeObjectURL externally when removing slides
  }, [url])
  return img
}

/* download helper */
function downloadURI(uri, name) {
  const link = document.createElement('a')
  link.download = name
  link.href = uri
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const DEFAULT_SLIDE = () => ({
  id: 'slide-' + Math.random().toString(36).slice(2, 9),
  width: 960,
  height: 540,
  objects: [
    { id: 'txt-' + Math.random().toString(36).slice(2, 6), type: 'text', x: 60, y: 40, text: 'Double-click to edit', fontSize: 28, rotation: 0 },
    { id: 'rect-' + Math.random().toString(36).slice(2, 6), type: 'rect', x: 80, y: 140, width: 200, height: 120, fill: '#4ea3f5', rotation: 10 }
  ]
})

export default function Editor() {
  const [slides, setSlides] = useState([DEFAULT_SLIDE()])
  const [current, setCurrent] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [parsing, setParsing] = useState(false)
  const stageRef = useRef(null)
  const trRef = useRef(null)
  const shapeRefs = useRef({}) // map id -> node ref
  const [editingTextId, setEditingTextId] = useState(null)
  const editableTextareaRef = useRef(null)

  /* Attach transformer to selected node (use refs map first) */
  useEffect(() => {
    if (!trRef.current) return
    const refs = shapeRefs.current
    const node = refs[selectedId] || (stageRef.current && stageRef.current.findOne('#' + selectedId))
    if (node) {
      try {
        trRef.current.nodes([node])
      } catch (err) {
        trRef.current.nodes([])
      }
    } else {
      trRef.current.nodes([])
    }
    try { trRef.current.getLayer().batchDraw() } catch (e) {}
  }, [selectedId, current])

  /* Inline text edit overlay */
  useEffect(() => {
    if (!editingTextId) {
      const ta = editableTextareaRef.current
      if (ta) ta.style.display = 'none'
      return
    }
    const stage = stageRef.current
    if (!stage) return
    const node = shapeRefs.current[editingTextId] || stage.findOne('#' + editingTextId)
    if (!node) return
    const abs = node.getAbsolutePosition()
    const scale = stage.scaleX() || 1
    const area = editableTextareaRef.current
    area.style.display = 'block'
    area.style.position = 'absolute'
    const rect = stage.container().getBoundingClientRect()
    area.style.left = rect.left + abs.x * scale + 'px'
    area.style.top = rect.top + abs.y * scale + 'px'
    area.style.width = Math.max(100, (node.width() || 100) * scale) + 'px'
    area.style.height = Math.max(24, (node.height() || 24) * scale) + 'px'
    if (typeof node.text === 'function') area.value = node.text()
    area.focus()
  }, [editingTextId])

  function handleStageMouseDown(e) {
    // click on empty area - clear selection
    if (e.target === e.target.getStage()) {
      setSelectedId(null)
      return
    }
    // ignore clicks on transformer itself or anchors
    const clicked = e.target
    if (clicked.getParent && clicked.getParent() && clicked.getParent().className === 'Transformer') {
      return
    }
    setSelectedId(clicked.id())
  }

  /* add/update/remove helpers */
  function addRect() {
    const newObj = { id: 'rect-' + Math.random().toString(36).slice(2, 6), type: 'rect', x: 120, y: 120, width: 160, height: 100, fill: '#ff7373', rotation: 0 }
    setSlides(prev => {
      const s = [...prev]
      s[current].objects.push(newObj)
      return s
    })
    setSelectedId(newObj.id)
  }
  function addText() {
    const newObj = { id: 'txt-' + Math.random().toString(36).slice(2, 6), type: 'text', x: 120, y: 80, text: 'New text', fontSize: 22, rotation: 0 }
    setSlides(prev => {
      const s = [...prev]
      s[current].objects.push(newObj)
      return s
    })
    setSelectedId(newObj.id)
  }
  function addImageFromUrl(url) {
    const newObj = { id: 'img-' + Math.random().toString(36).slice(2, 6), type: 'image', x: 120, y: 120, width: 240, height: 160, src: url, rotation: 0 }
    setSlides(prev => {
      const s = [...prev]
      s[current].objects.push(newObj)
      return s
    })
    setSelectedId(newObj.id)
  }

  function updateObject(updated) {
    setSlides(prev => {
      const s = [...prev]
      s[current].objects = s[current].objects.map(o => o.id === updated.id ? { ...o, ...updated } : o)
      return s
    })
  }

  function removeSelected() {
    if (!selectedId) return
    setSlides(prev => {
      const s = [...prev]
      s[current].objects = s[current].objects.filter(o => o.id !== selectedId)
      return s
    })
    setSelectedId(null)
  }

  function exportPNG() {
    if (!stageRef.current) return
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 })
    downloadURI(uri, 'slide-' + current + '.png')
  }
  function saveJSON() {
    const data = JSON.stringify(slides, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    downloadURI(url, 'deck.json')
  }
  function handleJSONLoad(file) {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result)
        setSlides(parsed)
        setCurrent(0)
        setSelectedId(null)
      } catch (err) {
        alert('Invalid JSON')
      }
    }
    reader.readAsText(file)
  }

  /* PPTX upload and parsing */
  async function handlePptxUpload(file) {
    if (!file) return
    setParsing(true)
    try {
      // small UX: append placeholder
      setSlides(prev => {
        const next = [...prev]
        const placeholder = DEFAULT_SLIDE()
        placeholder.objects[0].text = 'Parsing uploaded PPTX...'
        next.push(placeholder)
        return next
      })
      // parse file (File object OK)
      const parsedSlides = await parsePptxFile(file, { width: 960, height: 540 })
      if (!parsedSlides || parsedSlides.length === 0) {
        alert('No slides found (or parser failed).')
        // remove placeholder
        setSlides(prev => prev.slice(0, -1))
        setParsing(false)
        return
      }
      // replace placeholder with parsed slides
      const prevLength = slides.length // capture current slides length
      setSlides(prev => {
        const base = prev.slice(0, -1) // remove placeholder
        return [...base, ...parsedSlides]
      })
      // navigate to first parsed slide (index = previous length)
      setCurrent(prevLength)
      setSelectedId(null)
    } catch (err) {
      console.error('PPTX parse failed', err)
      alert('Failed to parse PPTX: ' + (err && err.message ? err.message : 'unknown'))
      // remove placeholder
      setSlides(prev => prev.slice(0, -1))
    } finally {
      setParsing(false)
    }
  }

  return (
    <div style={{ display: 'flex', width: '100%', gap: 12 }}>
      <aside className="sidebar">
        <div>
          <label className="file-input">
            <input type="file" accept=".pptx" onChange={e => { const f = e.target.files && e.target.files[0]; if (f) handlePptxUpload(f) }} />
            {parsing ? 'Uploading...' : 'Upload .pptx'}
          </label>
          <label className="file-input">
            <input type="file" accept="application/json" onChange={e => { const f = e.target.files && e.target.files[0]; if (f) handleJSONLoad(f) }} />
            Load JSON
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="controls">
            <button onClick={() => setSlides(s => [...s, DEFAULT_SLIDE()])}>Add Slide</button>
            <button onClick={() => setCurrent(c => Math.max(0, c - 1))}>Prev</button>
            <button onClick={() => setCurrent(c => Math.min(c + 1, slides.length - 1))}>Next</button>
            <button onClick={saveJSON}>Save JSON</button>
            <button onClick={exportPNG}>Export PNG</button>
          </div>

          <hr style={{ margin: '8px 0' }} />

          <div className="toolbar">
            <button onClick={addRect}>Add Rect</button>
            <button onClick={addText}>Add Text</button>
            {/* <button onClick={() => { const url = prompt('Image URL'); if (url) addImageFromUrl(url) }}>Add Image(URL)</button> */}
            <button onClick={removeSelected}>Delete</button>
          </div>

          <hr />

          <div style={{ marginTop: 8 }}>
            <strong>Slides</strong>
            <div className="thumb-rail" role="list">
              {slides.map((s, idx) => (
                <div key={s.id} className="thumb" onClick={() => setCurrent(idx)} style={{ border: idx === current ? '2px solid #2563eb' : '1px solid #ddd' }}>
                  <div style={{ fontSize: 12 }}>{'Slide ' + (idx + 1)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="editor-wrap">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><strong>Editing slide {current + 1} / {slides.length}</strong></div>
        </div>

        <div className="stage-container">
          <div style={{ width: slides[current].width + 40, height: slides[current].height + 40, padding: 20 }}>
            <div className="konvawrap" style={{ width: slides[current].width, height: slides[current].height }}>
              <Stage
                width={slides[current].width}
                height={slides[current].height}
                ref={stageRef}
                onMouseDown={handleStageMouseDown}
              >
                <Layer>
                  {/* slide background */}
                  <Rect x={0} y={0} width={slides[current].width} height={slides[current].height} fill={'white'} />
                  {/* render objects */}
                  {slides[current].objects.map(obj => {
                    if (obj.type === 'rect') {
                      return (
                        <Rect
                          key={obj.id}
                          id={obj.id}
                          x={obj.x}
                          y={obj.y}
                          width={obj.width}
                          height={obj.height}
                          fill={obj.fill || '#ddd'}
                          rotation={obj.rotation || 0}
                          draggable
                          ref={node => { if (node) shapeRefs.current[obj.id] = node }}
                          onClick={() => setSelectedId(obj.id)}
                          onTap={() => setSelectedId(obj.id)}
                          onDragEnd={e => updateObject({ id: obj.id, x: e.target.x(), y: e.target.y() })}
                          onTransformEnd={e => {
                            const node = e.target
                            const scaleX = node.scaleX()
                            const scaleY = node.scaleY()
                            node.scaleX(1); node.scaleY(1)
                            updateObject({
                              id: obj.id,
                              x: node.x(),
                              y: node.y(),
                              width: Math.max(5, Math.round(node.width() * scaleX)),
                              height: Math.max(5, Math.round(node.height() * scaleY)),
                              rotation: node.rotation()
                            })
                          }}
                        />
                      )
                    } else if (obj.type === 'text') {
                      return (
                        <Text
                          key={obj.id}
                          id={obj.id}
                          x={obj.x}
                          y={obj.y}
                          text={obj.text}
                          fontSize={obj.fontSize || 20}
                          rotation={obj.rotation || 0}
                          draggable
                          ref={node => { if (node) shapeRefs.current[obj.id] = node }}
                          onClick={() => setSelectedId(obj.id)}
                          onTap={() => setSelectedId(obj.id)}
                          onDblClick={() => setEditingTextId(obj.id)}
                          onDragEnd={e => updateObject({ id: obj.id, x: e.target.x(), y: e.target.y() })}
                          onTransformEnd={e => {
                            const node = e.target
                            const scaleX = node.scaleX()
                            node.scaleX(1)
                            updateObject({
                              id: obj.id,
                              x: node.x(),
                              y: node.y(),
                              fontSize: Math.max(8, Math.round((obj.fontSize || 20) * scaleX)),
                              rotation: node.rotation()
                            })
                          }}
                        />
                      )
                    } else if (obj.type === 'image') {
                      return (
                        <ImageNode
                          key={obj.id}
                          obj={obj}
                          onSelect={() => setSelectedId(obj.id)}
                          onChange={updateObject}
                          registerRef={node => { if (node) shapeRefs.current[obj.id] = node }}
                        />
                      )
                    }
                    return null
                  })}
                  {/* single shared transformer */}
                  <Transformer
                    ref={trRef}
                    anchorSize={8}
                    rotationSnaps={[0, 90, 180, 270]}
                    borderEnabled={true}
                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
                    boundBoxFunc={(oldBox, newBox) => {
                      // don't allow negative or tiny sizes
                      if (newBox.width < 5 || newBox.height < 5) {
                        return oldBox
                      }
                      return newBox
                    }}
                  />
                </Layer>
              </Stage>

              <textarea
                ref={editableTextareaRef}
                style={{ display: 'none', position: 'absolute' }}
                onBlur={() => {
                  const v = editableTextareaRef.current.value
                  updateObject({ id: editingTextId, text: v })
                  setEditingTextId(null)
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Image node component (loads image via hook) */
function ImageNode({ obj, onSelect, onChange, registerRef }) {
  const img = useImage(obj.src)
  const nodeRef = useRef(null)

  useEffect(() => {
    if (nodeRef.current && registerRef) registerRef(nodeRef.current)
  }, [nodeRef.current])

  return (
    <KImage
      ref={nodeRef}
      id={obj.id}
      image={img}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={e => onChange({ id: obj.id, x: e.target.x(), y: e.target.y() })}
      onTransformEnd={e => {
        const node = e.target
        const scaleX = node.scaleX()
        const scaleY = node.scaleY()
        node.scaleX(1); node.scaleY(1)
        onChange({
          id: obj.id,
          x: node.x(),
          y: node.y(),
          width: Math.max(5, Math.round(node.width() * scaleX)),
          height: Math.max(5, Math.round(node.height() * scaleY)),
          rotation: node.rotation()
        })
      }}
    />
  )
}
