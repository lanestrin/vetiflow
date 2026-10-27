import { Navigate, Route, Routes } from "react-router-dom";
import { DemoBar } from "../components/layout/DemoBar";
import { ErBoardPage } from "../routes/ErBoardPage";
import { PetParentHomePage } from "../routes/PetParentHomePage";
import { SignInPage } from "../routes/SignInPage";

function App() {
  return (
    <>
      <DemoBar />
      <Routes>
        <Route path="/" element={<Navigate to="/er" replace />} />
        <Route path="/er" element={<ErBoardPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/pet-parent" element={<PetParentHomePage />} />
      </Routes>
    </>
  );
}

export default App;
