import React, { useState } from 'react'
import Editor from './components/Editor'

export default function App(){
  return (
    <div className="app">
      <header className="app-header">
        <h1>PPTX Konva Editor</h1>
      </header>
      <main>
        <Editor />
      </main>
    </div>
  )
}
