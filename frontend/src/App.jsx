import { useState } from 'react'
import './assets/css/00_Global_Styles.css'

function App() {
  const [count, setCount] = useState(0) // example of how using state works in react :)

  return (
    <>
        <button
          type="button"
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
    </>
  )
}

export default App
