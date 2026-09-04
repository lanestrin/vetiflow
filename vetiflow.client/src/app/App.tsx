import { Navigate, Route, Routes } from "react-router-dom";
import ErBoardPage from "../routes/ErBoardPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/er" replace />} />
      <Route path="/er" element={<ErBoardPage />} />
    </Routes>
  );
}

export default App;