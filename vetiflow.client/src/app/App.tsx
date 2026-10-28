import { Route, Routes } from "react-router-dom";
import { HomeRedirect } from "../components/auth/HomeRedirect";
import { RequireExperience } from "../components/auth/RequireExperience";
import { DemoBar } from "../components/layout/DemoBar";
import { ErBoardPage } from "../routes/ErBoardPage";
import { PetParentHomePage } from "../routes/PetParentHomePage";
import { RecordsPage } from "../routes/RecordsPage";
import { SignInPage } from "../routes/SignInPage";

function App() {
  return (
    <>
      <DemoBar />
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route
          path="/er"
          element={
            <RequireExperience experience="teamMember">
              {(user) => <ErBoardPage user={user} />}
            </RequireExperience>
          }
        />
        <Route
          path="/records"
          element={
            <RequireExperience experience="teamMember">
              {(user) => <RecordsPage user={user} />}
            </RequireExperience>
          }
        />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route
          path="/pet-parent"
          element={
            <RequireExperience experience="petParent">
              {(user) => <PetParentHomePage user={user} />}
            </RequireExperience>
          }
        />
      </Routes>
    </>
  );
}

export default App;
