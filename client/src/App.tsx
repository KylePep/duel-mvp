// import { useState } from 'react'
import { useEffect } from 'react'
import { connect } from "./ws.js"
import './App.css'

function App() {
  useEffect(()=> {
    connect();
  }, []);

  return <h1>Duel MVP</h1>;
}

export default App
