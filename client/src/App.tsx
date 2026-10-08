import { BrowserRouter, Route, Routes } from "react-router-dom"
import Signup from "./pages/signup"
import Login from "./pages/login"
import Dashboard from "./pages/dashboard"

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<Signup />}></Route>
        <Route path="/login" element={<Login />}></Route>
        <Route path="/dashboard" element={<Dashboard />}></Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App